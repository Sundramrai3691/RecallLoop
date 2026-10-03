import { query } from "../../db/postgres.js";

export interface ResourceReason { code:"coverage"|"goal_skill"|"learner_level"|"time_fit"|"trust"|"freshness"|"assessment_gap"; text:string; }
export interface RecommendedResource { id:string; title:string; url:string; provider:string; resourceType:string; estimatedMinutes:number; difficulty:number; description:string; trustTier:number; freshness:string; conceptName:string; conceptsCovered:string[]; score:number; reasons:ResourceReason[]; reason:string; }

export async function recommendResources(input: { userId:string; conceptId?:string; goalId?:string; skillId?:string; availableMinutes?:number; limit?:number }) {
  const available=Math.max(0,Math.min(240,Math.floor(Number(input.availableMinutes??60))));
  const limit=Math.min(4,Math.max(1,Math.floor(Number(input.limit??4))));
  if(available===0)return [];
  let dimensions:Record<string,number|null>={};
  if(input.conceptId){
    const personal=await query<any>(`SELECT id FROM personal_concepts WHERE id=$1 AND user_id=$2`,[input.conceptId,input.userId]);
    if(personal.rows[0]){
      const results=await query<any>(`SELECT d.dimension,AVG(d.score)::float AS score FROM recall_dimension_results d JOIN recall_attempts r ON r.id=d.recall_attempt_id WHERE r.user_id=$1 AND r.concept_id=$2 GROUP BY d.dimension`,[input.userId,input.conceptId]);
      dimensions=Object.fromEntries(results.rows.map((row)=>[row.dimension,Number(row.score)]));
    }
  }
  const rows=await query<any>(`SELECT r.id,r.title,r.url,r.provider,r.resource_type AS "resourceType",r.estimated_minutes AS "estimatedMinutes",r.difficulty,r.description,r.trust_tier AS "trustTier",r.freshness,
      MIN(c.name) AS "conceptName",ARRAY_AGG(DISTINCT c.name) AS "conceptsCovered",AVG(rc.coverage_strength)::float AS "coverageStrength",
      AVG(lks.observed_mastery)::float AS mastery,
      BOOL_OR(s.id IS NOT NULL) AS "goalRelevant",
      CASE WHEN $3::uuid IS NOT NULL THEN BOOL_OR(rc.concept_id=$3::uuid OR EXISTS(SELECT 1 FROM personal_concepts pc WHERE pc.id=$3::uuid AND pc.user_id=$1 AND lower(pc.name)=lower(c.name))) ELSE false END AS "requestedConceptCovered"
    FROM resources r JOIN resource_coverage rc ON rc.resource_id=r.id JOIN canonical_concepts c ON c.id=rc.concept_id
    JOIN topics t ON t.id=c.topic_id JOIN canonical_skills cs ON cs.id=t.skill_id
    LEFT JOIN learner_knowledge_states lks ON lks.canonical_concept_id=c.id AND lks.user_id=$1
    LEFT JOIN learner_skills s ON s.user_id=$1 AND ($4::uuid IS NULL OR s.goal_id=$4::uuid) AND lower(s.name)=lower(cs.name)
    WHERE ($2::uuid IS NULL OR c.id=$2::uuid OR EXISTS(SELECT 1 FROM personal_concepts pc WHERE pc.id=$2::uuid AND pc.user_id=$1 AND lower(pc.name)=lower(c.name)))
      AND ($5::uuid IS NULL OR s.id=$5::uuid OR $5::uuid IS NULL)
    GROUP BY r.id
    ORDER BY r.trust_tier ASC,r.estimated_minutes ASC`,[input.userId,input.conceptId??null,input.conceptId??null,input.goalId??null,input.skillId??null]);
  const targetMastery=dimensions.recall??dimensions.explanation??null;
  const appGap=dimensions.application==null&&targetMastery!=null?true:dimensions.application!=null&&targetMastery!=null&&targetMastery-dimensions.application>=.2;
  const currentYear=new Date().getFullYear();
  const ranked:RecommendedResource[]=[];
  for(const row of rows.rows){
    const minutes=Number(row.estimatedMinutes);
    if(minutes>available)continue;
    if(input.conceptId&&row.requestedConceptCovered!==true)continue;
    const coverage=Number(row.coverageStrength);
    const mastery=row.mastery==null?null:Number(row.mastery);
    const desiredDifficulty=mastery==null?3:Math.max(1,Math.min(5,Math.round(mastery*4)+1));
    const difficultyFit=1-Math.abs(Number(row.difficulty)-desiredDifficulty)/4;
    const trustFit=(5-Number(row.trustTier))/4;
    const year=Number.parseInt(String(row.freshness??""),10);
    const freshnessFit=Number.isFinite(year)?Math.max(0,1-Math.max(0,currentYear-year)/6):.35;
    const timeFit=1-(minutes/Math.max(1,available))*.35;
    const goalRelevant=Boolean(row.goalRelevant);
    const score=coverage*.34+(mastery==null?.5:1-mastery)*.2+difficultyFit*.14+trustFit*.14+freshnessFit*.08+timeFit*.1+(goalRelevant?.08:0)+(appGap&&/article|practitioner|tutorial/i.test(row.resourceType)?.04:0);
    const reasons:ResourceReason[]=[{code:"coverage",text:`Covers ${row.conceptName} (${Math.round(coverage*100)}% coverage).`}];
    if(goalRelevant)reasons.push({code:"goal_skill",text:"Matches a skill on your active goal."});
    if(mastery!==null)reasons.push({code:"learner_level",text:`Difficulty ${row.difficulty} is selected against observed mastery ${Math.round(mastery*100)}%.`});
    if(appGap)reasons.push({code:"assessment_gap",text:"Application evidence is weaker or not recorded, so this applied resource may help."});
    reasons.push({code:"time_fit",text:`Fits your ${available}-minute window (${minutes} minutes).`},{code:"trust",text:`Source trust tier ${row.trustTier}.`});
    if(Number.isFinite(year))reasons.push({code:"freshness",text:`Resource metadata marks it ${year}.`});
    ranked.push({...row,estimatedMinutes:minutes,difficulty:Number(row.difficulty),trustTier:Number(row.trustTier),coverageStrength:coverage,mastery,score:Number(score.toFixed(4)),conceptsCovered:row.conceptsCovered,reasons,reason:reasons.map((reason)=>reason.text).join(" ")});
  }
  ranked.sort((a,b)=>b.score-a.score||a.estimatedMinutes-b.estimatedMinutes);
  const selected:RecommendedResource[]=[];let total=0;
  for(const resource of ranked){if(selected.length>=limit)break;if(total+resource.estimatedMinutes>available)continue;selected.push(resource);total+=resource.estimatedMinutes;}
  return selected;
}
