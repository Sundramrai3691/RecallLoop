import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgres } from "../db/postgres.js";
import { canonicalHttpPilotQuestions } from "../services/questionBank/pilotQuestionBank.js";
import { canonicalCoreSdeQuestions, validateCoreSdeQuestionBank } from "../services/questionBank/coreSdeQuestionBank.js";
import { questionContentHash, validatePilotQuestionBank } from "../services/questionBank/questionBankQuality.js";
import { listKnowledgeCheckCoverage } from "../services/question/assessmentService.js";

const output=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../../docs/question-bank/core-sde-domain-coverage-report.json");
const blueprints={rapid_fire:{mcq:2,rapid_recall:3},deep_recall:{descriptive:1},practice:{scenario:1},mastery_check:{mcq:1,rapid_recall:1,short_explanation:1,scenario:1,descriptive:1,transfer:1}} as const;

function deficits(counts:Record<string,number>){
  return Object.fromEntries(Object.entries(blueprints).map(([mode,required])=>[mode,Object.fromEntries(Object.entries(required).filter(([type,count])=>(counts[type]??0)<count).map(([type,count])=>[type,{required:count,eligible:counts[type]??0}]))]));
}

async function main(){
  const [catalog,allRevisions,current,eligible,learnerQuestions,coverage]=await Promise.all([
    postgres.query<any>(`SELECT d.name domain,t.id topic_id,t.name topic,t.description topic_description,c.id concept_id,c.name concept,kp.id point_id,kp.statement point
      FROM knowledge_domains d JOIN canonical_skills s ON s.domain_id=d.id JOIN topics t ON t.skill_id=s.id
      LEFT JOIN canonical_concepts c ON c.topic_id=t.id AND c.status='active' LEFT JOIN knowledge_points kp ON kp.concept_id=c.id
      ORDER BY d.name,t.name,c.name,kp.importance DESC,kp.id`),
    postgres.query<any>(`SELECT d.name domain,count(*)::int total_revisions,count(*) FILTER(WHERE r.revision=i.current_revision)::int current_revisions
      FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id
      JOIN canonical_concepts c ON c.id=i.canonical_concept_id JOIN topics t ON t.id=c.topic_id JOIN canonical_skills s ON s.id=t.skill_id JOIN knowledge_domains d ON d.id=s.domain_id
      GROUP BY d.name ORDER BY d.name`),
    postgres.query<any>(`SELECT d.name domain,t.name topic,c.id concept_id,c.name concept,kp.id point_id,kp.statement point,
        i.id item_id,i.slug,r.id revision_id,r.revision,r.content_hash,r.question_type,r.assessment_level,r.difficulty,r.prompt,r.expected_answer,r.rubric,r.options,r.correct_option_id,r.explanation,r.distractor_rationales,r.source_title,r.source_url,r.source_publisher,r.source_license,r.source_accessed_on,r.source_notes,r.question_origin,r.quality_status,r.review_status,r.publication_status,
        count(rp.canonical_knowledge_point_id)::int mappings
      FROM knowledge_domains d JOIN canonical_skills s ON s.domain_id=d.id JOIN topics t ON t.skill_id=s.id JOIN canonical_concepts c ON c.topic_id=t.id AND c.status='active'
      JOIN canonical_question_items i ON i.canonical_concept_id=c.id JOIN canonical_question_revisions r ON r.question_item_id=i.id AND r.revision=i.current_revision
      LEFT JOIN canonical_question_revision_points rp ON rp.question_revision_id=r.id LEFT JOIN knowledge_points kp ON kp.id=rp.canonical_knowledge_point_id
      GROUP BY d.name,t.name,c.id,c.name,kp.id,kp.statement,i.id,i.slug,r.id ORDER BY d.name,t.name,c.name,i.slug`),
    postgres.query<any>(`SELECT r.canonical_concept_id concept_id,r.question_type,count(DISTINCT r.id)::int count FROM (
        SELECT i.canonical_concept_id,r.id,r.question_type,r.assessment_level,r.difficulty FROM canonical_question_items i JOIN canonical_question_revisions r ON r.question_item_id=i.id
          WHERE r.revision=i.current_revision AND r.publication_status='published' AND r.review_status IN ('subject_matter_reviewed','automated_reviewed') AND r.quality_status='valid'
            AND (
              EXISTS(SELECT 1 FROM canonical_question_reviews a JOIN canonical_question_reviewers g ON g.reviewer_user_id=a.reviewer_user_id
                WHERE a.question_revision_id=r.id AND a.decision='approved' AND a.content_hash=r.content_hash AND a.reviewed_at>=g.granted_at
                  AND (g.revoked_at IS NULL OR a.reviewed_at<g.revoked_at)
                  AND NOT EXISTS(SELECT 1 FROM canonical_question_reviews later WHERE later.question_revision_id=r.id AND (later.reviewed_at,later.id)>(a.reviewed_at,a.id)))
              OR EXISTS(SELECT 1 FROM canonical_question_automated_reviews a
                WHERE a.question_revision_id=r.id AND a.decision='approved' AND a.content_hash=r.content_hash
                  AND NOT EXISTS(SELECT 1 FROM canonical_question_automated_reviews later WHERE later.question_revision_id=r.id AND later.decision='approved' AND (later.reviewed_at,later.id)>(a.reviewed_at,a.id)))
            )
        ) r GROUP BY r.canonical_concept_id,r.question_type`),    postgres.query<any>(`SELECT d.name domain,count(DISTINCT q.id)::int learner_created_questions FROM knowledge_domains d JOIN canonical_skills s ON s.domain_id=d.id JOIN topics t ON t.skill_id=s.id JOIN canonical_concepts c ON c.topic_id=t.id JOIN personal_concepts pc ON pc.canonical_concept_id=c.id JOIN questions q ON q.concept_id=pc.id AND q.canonical_question_revision_id IS NULL GROUP BY d.name`),
    listKnowledgeCheckCoverage(),
  ]);
  const authored=[...canonicalHttpPilotQuestions,...canonicalCoreSdeQuestions];
  const sourceBySlug=new Map(authored.map(question=>[question.slug,question]));
  const automaticIssues=[...validatePilotQuestionBank(),...validateCoreSdeQuestionBank()];
  const uniqueCurrent:any[]=[...new Map<string,any>(current.rows.map((row:any)=>[row.revision_id,row])).values()];
  const reviewByConcept=new Map<string,any[]>();
  for(const row of eligible.rows)reviewByConcept.set(row.concept_id,[...(reviewByConcept.get(row.concept_id)??[]),row]);
  const revisionByPoint=new Map<string,any[]>(); const pointCounts=new Map<string,number>(); let mapped=0,provenance=0,hashValid=0;
  for(const row of current.rows){
    const key=`${row.domain}\u0000${row.topic}\u0000${row.concept}\u0000${row.point??"unmapped"}`;
    const list=revisionByPoint.get(key)??[];list.push(row);revisionByPoint.set(key,list);
    pointCounts.set(key,(pointCounts.get(key)??0)+1);
  }
  for(const row of uniqueCurrent){
    if(row.mappings===1&&row.point_id)mapped++;
    if(row.source_title&&row.source_url&&row.source_publisher&&row.source_license&&row.source_accessed_on&&row.source_notes)provenance++;
    const source=sourceBySlug.get(row.slug);
    if(source&&questionContentHash(source)===row.content_hash)hashValid++;
  }
  const catalogByDomain=new Map<string,any>();
  for(const row of catalog.rows){
    if(!catalogByDomain.has(row.domain))catalogByDomain.set(row.domain,{name:row.domain,topics:new Map<string,any>()});
    const domain=catalogByDomain.get(row.domain);
    if(!domain.topics.has(row.topic_id))domain.topics.set(row.topic_id,{id:row.topic_id,name:row.topic,description:row.topic_description,concepts:new Map<string,any>()});
    const topic=domain.topics.get(row.topic_id);
    if(row.concept_id&&!topic.concepts.has(row.concept_id))topic.concepts.set(row.concept_id,{id:row.concept_id,name:row.concept,points:[]});
    if(row.point_id)topic.concepts.get(row.concept_id).points.push({id:row.point_id,statement:row.point,currentRevisionCount:pointCounts.get(`${row.domain}\u0000${row.topic}\u0000${row.concept}\u0000${row.point}`)??0});
  }
  const revisionCounts=new Map<string,{total:number;current:number}>(allRevisions.rows.map((r:any)=>[r.domain,{total:Number(r.total_revisions),current:Number(r.current_revisions)}]));
  const learnerCreatedCounts=new Map(learnerQuestions.rows.map((r:any)=>[r.domain,Number(r.learner_created_questions)]));
  const subjects=coverage;
  const domains=[...catalogByDomain.values()].map((domain:any)=>{
    const concepts=[...domain.topics.values()].flatMap((topic:any)=>[...topic.concepts.values()]);
    const domainRows=uniqueCurrent.filter((r:any)=>r.domain===domain.name);
    const byType=Object.fromEntries([...new Set(domainRows.map((r:any)=>r.question_type))].sort().map(type=>[type,domainRows.filter((r:any)=>r.question_type===type).length]));
    const byLevel=Object.fromEntries([...new Set(domainRows.map((r:any)=>r.assessment_level))].sort().map(level=>[level,domainRows.filter((r:any)=>r.assessment_level===level).length]));
    const byDifficulty=Object.fromEntries([...new Set(domainRows.map((r:any)=>String(r.difficulty)))].sort().map(level=>[level,domainRows.filter((r:any)=>String(r.difficulty)===level).length]));
    const reviewStates=Object.fromEntries([...new Set(domainRows.map((r:any)=>r.review_status))].sort().map(state=>[state,domainRows.filter((r:any)=>r.review_status===state).length]));
    const publicationStates=Object.fromEntries([...new Set(domainRows.map((r:any)=>r.publication_status))].sort().map(state=>[state,domainRows.filter((r:any)=>r.publication_status===state).length]));
    const modes=subjects.flatMap((subject:any)=>subject.topics.flatMap((topic:any)=>topic.concepts.map((concept:any)=>({conceptId:concept.id,concept:concept.name,topic:topic.name,subject:subject.name,domain:subject.domainName,...concept})))).filter((row:any)=>row.domain===domain.name);
    const perConcept=modes.map((concept:any)=>{
      const counts=Object.fromEntries((reviewByConcept.get(concept.id)??[]).map((item:any)=>[item.question_type,Number(item.count)]));
      const missing=deficits(counts);
      const status=concept.availability;
      return {conceptId:concept.id,concept:concept.name,topic:concept.topic,availability:status,eligibleByType:counts,missingBlueprintRequirements:missing,currentQuestionRevisions:domainRows.filter((r:any)=>r.concept_id===concept.id).length,distinctVerificationCandidateAvailable:domainRows.some((r:any)=>r.concept_id===concept.id&&r.question_type==="short_explanation"),distinctVerificationEligible:Object.values(counts).length>0&&((counts.short_explanation??0)>0)};
    });
    const gapRows=perConcept.filter((item:any)=>item.availability!=="available");
    return {domain:domain.name,topicClusterCount:domain.topics.size,knowledgePointCount:concepts.reduce((sum:number,c:any)=>sum+c.points.length,0),topics:[...domain.topics.values()].map((t:any)=>({...t,concepts:[...t.concepts.values()]})),totalQuestionRevisions:revisionCounts.get(domain.name)?.total??0,currentQuestionRevisions:revisionCounts.get(domain.name)?.current??0,learnerCreatedQuestions:learnerCreatedCounts.get(domain.name)??0,canonicalCurrentQuestions:domainRows.length,byQuestionType:byType,byCognitiveLevel:byLevel,byDifficulty:byDifficulty,byReviewState:reviewStates,byPublicationState:publicationStates,mappingCompleteness:{mappedCurrentRevisions:domainRows.filter((r:any)=>r.mappings===1&&r.point_id).length,totalCurrentRevisions:domainRows.length},provenanceCompleteness:{completeCurrentRevisions:domainRows.filter((r:any)=>r.source_title&&r.source_url&&r.source_publisher&&r.source_license&&r.source_accessed_on&&r.source_notes).length,totalCurrentRevisions:domainRows.length},assessmentCoverage:perConcept,coverageGapCount:gapRows.length,reviewBlockerCount:perConcept.filter((item:any)=>item.availability==="awaiting_review").length};
  });
  const databaseIssues=uniqueCurrent.flatMap((row:any)=>{
    const source=sourceBySlug.get(row.slug);const issues:string[]=[];
    if(source&&questionContentHash(source)!==row.content_hash)issues.push(`${row.slug}: authored hash differs from database`);
    if(!source&&row.publication_status!=="retired")issues.push(`${row.slug}: current revision has no authored source in the quality gate`);
    if(row.mappings!==1||!row.point_id)issues.push(`${row.slug}: current revision has incomplete or ambiguous point mapping`);
    if(!(row.source_title&&row.source_url&&row.source_publisher&&row.source_license&&row.source_accessed_on&&row.source_notes))issues.push(`${row.slug}: source provenance is incomplete`);
    return issues;
  });
  const report={reportVersion:1,generatedAt:new Date().toISOString(),scope:"Database-grounded current canonical revisions and active catalog nodes. Counts deduplicate by revision UUID and exclude learner-created questions from canonical-bank coverage.",catalog:{domains:domains.length,topicClusters:domains.reduce((sum,d)=>sum+d.topicClusterCount,0),knowledgePoints:domains.reduce((sum,d)=>sum+d.knowledgePointCount,0)},bank:{totalRevisions:allRevisions.rows.reduce((sum:number,r:any)=>sum+Number(r.total_revisions),0),currentRevisions:uniqueCurrent.length,currentQuestionIdentityCount:new Set(uniqueCurrent.map((r:any)=>r.item_id)).size,mappedCurrentRevisions:mapped,provenanceCompleteCurrentRevisions:provenance,authoredHashMatches:hashValid,engineeringIssueCount:automaticIssues.length+databaseIssues.length,engineeringIssues:[...automaticIssues,...databaseIssues],humanReviewApprovals:uniqueCurrent.filter((r:any)=>r.review_status==="subject_matter_reviewed").length},assessmentBlueprints:blueprints,domains};
  await mkdir(path.dirname(output),{recursive:true});await writeFile(output,`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify({output,domains:domains.map(d=>({domain:d.domain,topics:d.topicClusterCount,points:d.knowledgePointCount,current:d.currentQuestionRevisions,reviewersPending:d.reviewBlockerCount,blueprintGaps:d.coverageGapCount})),reportBank:report.bank},null,2));
}

main().finally(()=>postgres.end());
