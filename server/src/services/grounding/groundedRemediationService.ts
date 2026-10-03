import { createHash } from "node:crypto";
import { query } from "../../db/postgres.js";
import { AppError, conflict, notFound } from "../../utils/errors.js";
import { recommendResources } from "../resources/resourceRecommendationService.js";
import { beginSourceProcessing, createOrGetRemediation, failSourceProcessing, finishSourceProcessing, findSource, getRemediation, getRemediationForVerification, listSources, retrieveChunks, storeRemediationRetrieval, updateRemediation, updateRemediationStatus } from "../../repositories/groundingRepository.js";
import { chunkText } from "./chunker.js";
import { cosineSimilarity, createEmbeddingProvider, type EmbeddingProvider } from "./embeddingProvider.js";
import { createGroundedRemediator, type GroundedRemediator, type GroundingSource } from "./remediationGenerator.js";
import { significantTokens } from "../../lib/llm/json.js";

const MAX_SOURCE_CHARS=250_000;
const MIN_RELEVANCE=0.22;
const scoreForStatus=(status:string)=>status==="correct"?1:status==="partial"?0.5:0;

export async function ingestGroundingSource(userId:string,input:{title:string;text:string;sourceType?:string;reference?:string;provenance?:Record<string,unknown>;resourceId?:string},options:{embeddingProvider?:EmbeddingProvider}={}) {
  if(typeof input.title!=="string"||!input.title.trim()||input.title.trim().length>200)throw new AppError("title is required and must be at most 200 characters",400,"VALIDATION_ERROR");
  if(typeof input.text!=="string"||!input.text.trim()||input.text.length>MAX_SOURCE_CHARS)throw new AppError("text is required and must be at most 250,000 characters",400,"VALIDATION_ERROR");
  const sourceType=input.sourceType??"text";
  if(sourceType!=="text"&&sourceType!=="markdown")throw new AppError("sourceType must be text or markdown",400,"VALIDATION_ERROR");
  const reference=input.reference?.trim()??"";
  if(reference.length>1000)throw new AppError("reference must be at most 1,000 characters",400,"VALIDATION_ERROR");
  const text=input.text.replace(/\r\n?/g,"\n").trim();
  const contentHash=createHash("sha256").update(text).digest("hex");
  const document=await beginSourceProcessing({userId,title:input.title.trim(),sourceType,reference,provenance:input.provenance??{},content:text,contentHash});
  try {
    if(input.resourceId){const resource=await query(`SELECT 1 FROM resources WHERE id=$1`,[input.resourceId]);if(!resource.rowCount)throw notFound("Resource not found","RESOURCE_NOT_FOUND");await query(`UPDATE grounding_sources SET resource_id=$3 WHERE id=$1 AND user_id=$2`,[document.id,userId,input.resourceId]);}
    const chunks=chunkText(document.id,contentHash,text);
    if(!chunks.length)throw new AppError("No text could be parsed from this source",400,"EMPTY_SOURCE");
    const provider=options.embeddingProvider??createEmbeddingProvider();
    const vectors=await provider.embed(chunks.map((chunk)=>chunk.text));
    if(vectors.length!==chunks.length||vectors.some((vector)=>!vector.length||vector.some((value)=>!Number.isFinite(value))))throw new AppError("Embedding provider returned missing or invalid vectors",503,"EMBEDDING_INVALID_RESPONSE");
    const dimensions=vectors[0].length;
    if(vectors.some((vector)=>vector.length!==dimensions))throw new AppError("Embedding provider returned inconsistent vector dimensions",503,"EMBEDDING_INVALID_RESPONSE");
    const processed=await finishSourceProcessing(document.id,chunks.map((chunk,index)=>({...chunk,embedding:vectors[index]})),provider);
    return {...processed,chunkCount:chunks.length,duplicate:document.duplicate};
  }catch(error){
    await failSourceProcessing(document.id,error instanceof Error?error.message:"Source processing failed");
    throw error;
  }
}

export async function getGroundingSources(userId:string){return listSources(userId);}
export async function getGroundingSource(userId:string,sourceId:string){const source=await findSource(userId,sourceId);if(!source)throw notFound("Source not found","SOURCE_NOT_FOUND");return source;}

function reasonFromEvidence(point:string,rows:any[],current:any):string {
  if(Number(current.confidence)>=8)return `Your confidence was ${current.confidence}/10, but evaluation marked “${point}” as ${current.status}.`;
  const missed=rows.filter((row)=>row.point.trim().toLowerCase()===point.trim().toLowerCase()&&row.status!=="correct").length;
  if(missed>=2)return `You missed “${point}” in ${missed} of your last ${Math.min(5,new Set(rows.map((row)=>row.attempt_id)).size)} recalls.`;
  return `Your latest evaluated recall marked “${point}” as ${current.status}.`;
}

export async function retrieveForGap(input:{userId:string;conceptName:string;knowledgePoint:string;misconception?:string|null;limit?:number}) {
  const provider=createEmbeddingProvider();
  const searchText=[input.conceptName,input.knowledgePoint,input.misconception].filter(Boolean).join(". ");
  const [embedding]=await provider.embed([searchText]);
  const candidates=await retrieveChunks(input.userId,embedding,provider.name,40);
  return rankRetrievedChunks(searchText,embedding,candidates,input.limit??5,MIN_RELEVANCE);
}

export function rankRetrievedChunks(searchText:string,embedding:number[],candidates:Array<GroundingSource & {embedding:number[]}>,limit=5,threshold=MIN_RELEVANCE) {
  const queryTokens=new Set(significantTokens(searchText));
  return candidates.map((chunk)=>{
    const chunkTokens=new Set(significantTokens(chunk.text));
    const lexical=queryTokens.size?[...queryTokens].filter((token)=>chunkTokens.has(token)).length/queryTokens.size:0;
    const semantic=Math.max(0,cosineSimilarity(embedding,chunk.embedding));
    return {...chunk,relevance:Number((semantic*.55+lexical*.45).toFixed(4))};
  }).filter((chunk)=>chunk.relevance>=threshold).sort((a,b)=>b.relevance-a.relevance||a.chunkId.localeCompare(b.chunkId)).slice(0,limit).map(({embedding,...chunk})=>chunk);
}

export async function createGroundedRemediation(userId:string,attemptId:string,options:{remediator?:GroundedRemediator}={}) {
  const attemptResult=await query<any>(`SELECT a.id,a.user_id AS "userId",a.concept_id AS "conceptId",a.confidence,a.evidence_weight AS "evidenceWeight",a.answer,a.submitted_at AS "submittedAt",c.name AS "conceptName",e.mistakes,json_agg(json_build_object('point',kp.point,'status',kp.status,'feedback',kp.feedback) ORDER BY kp.id) FILTER(WHERE kp.id IS NOT NULL) AS "knowledgePointResults"
    FROM recall_attempts a JOIN personal_concepts c ON c.id=a.concept_id AND c.user_id=a.user_id JOIN recall_evaluations e ON e.recall_attempt_id=a.id LEFT JOIN recall_knowledge_point_results kp ON kp.evaluation_id=e.id
    WHERE a.id=$1 AND a.user_id=$2 GROUP BY a.id,c.name,e.id`,[attemptId,userId]);
  const attempt=attemptResult.rows[0];
  if(!attempt)throw notFound("Recall attempt not found","RECALL_NOT_FOUND");
  if(!attempt.submittedAt)throw conflict("Submit this recall before creating remediation","RECALL_NOT_SUBMITTED");
  const gaps=(attempt.knowledgePointResults??[]).filter((item:any)=>item.status==="missing"||item.status==="partial");
  if(!gaps.length)throw conflict("This recall did not identify a knowledge point that needs remediation","NO_REMEDIATION_GAP");
  const recent=await query<any>(`WITH recent_attempts AS (SELECT id,confidence,evidence_weight FROM recall_attempts WHERE user_id=$1 AND concept_id=$2 AND submitted_at IS NOT NULL ORDER BY submitted_at DESC LIMIT 5)
    SELECT r.id AS attempt_id,r.confidence,r.evidence_weight AS "evidenceWeight",kp.point,kp.status,kp.feedback FROM recent_attempts r JOIN recall_evaluations e ON e.recall_attempt_id=r.id JOIN recall_knowledge_point_results kp ON kp.evaluation_id=e.id ORDER BY r.id=$3 DESC`,[userId,attempt.conceptId,attemptId]);
  const ranked=gaps.map((gap:any)=>({gap,misses:recent.rows.filter((row:any)=>row.point.trim().toLowerCase()===gap.point.trim().toLowerCase()&&row.status!=="correct").length})).sort((a:any,b:any)=>b.misses-a.misses||scoreForStatus(a.gap.status)-scoreForStatus(b.gap.status)||a.gap.point.localeCompare(b.gap.point));
  const chosen=ranked[0].gap;
  const evidenceRows=recent.rows.filter((row:any)=>row.point.trim().toLowerCase()===chosen.point.trim().toLowerCase());
  const latest=evidenceRows.find((row:any)=>row.attempt_id===attemptId)??{...chosen,confidence:attempt.confidence,evidenceWeight:attempt.evidenceWeight};
  const reason=reasonFromEvidence(chosen.point,evidenceRows,latest);
  const triggerScore=Number((scoreForStatus(chosen.status)*Number(attempt.evidenceWeight??1)).toFixed(4));
  const remediationId=await createOrGetRemediation({userId,attemptId,conceptId:attempt.conceptId,knowledgePoint:chosen.point,reason,evidence:{status:chosen.status,feedback:chosen.feedback,confidence:attempt.confidence,mistakes:attempt.mistakes,attemptCount:evidenceRows.length},triggerScore});
  const existing=await getRemediation(userId,remediationId);
  if(existing&&["ready","verification_created","verified"].includes(existing.status))return await remediationResponse(userId,existing,attempt.conceptId);
  try {
    const sources=await retrieveForGap({userId,conceptName:attempt.conceptName,knowledgePoint:chosen.point,misconception:attempt.mistakes?.[0]??null});
    await storeRemediationRetrieval(remediationId,sources);
    if(!sources.length){await updateRemediation(remediationId,{status:"insufficient_sources"});const saved=await getRemediation(userId,remediationId);return await remediationResponse(userId,saved,attempt.conceptId);}
    const remediator=options.remediator??createGroundedRemediator();
    const content=await remediator.generate({conceptName:attempt.conceptName,knowledgePoint:chosen.point,whyThis:reason,evaluationEvidence:{status:chosen.status,feedback:chosen.feedback,mistakes:attempt.mistakes??[],confidence:attempt.confidence==null?null:Number(attempt.confidence)},sources});
    await updateRemediation(remediationId,{status:"ready",content});
  }catch(error){
    await updateRemediation(remediationId,{status:"failed",error:error instanceof Error?error.message:"Remediation generation failed"});
  }
  const saved=await getRemediation(userId,remediationId);
  return await remediationResponse(userId,saved,attempt.conceptId);
}

async function remediationResponse(userId:string,remediation:any,conceptId:string) {
  if(!remediation)return null;
  const sources=(remediation.sources??[]).map((source:any)=>({...source,relevance:Number(source.relevance)}));
  const fallbackResources=remediation.status==="insufficient_sources"||remediation.status==="failed"&&!sources.length?await recommendResources({userId,conceptId,availableMinutes:30,limit:3}).catch(()=>[]):[];
  return {id:remediation.id,conceptId:remediation.concept_id,conceptName:remediation.conceptName,triggeringAttemptId:remediation.triggering_attempt_id,knowledgePoint:remediation.knowledge_point,reason:remediation.reason,evidence:remediation.evidence,status:remediation.status,content:remediation.content,generationError:remediation.generation_error,triggerScore:remediation.trigger_score==null?null:Number(remediation.trigger_score),verificationAttemptId:remediation.verification_attempt_id,verificationScore:remediation.verification_score==null?null:Number(remediation.verification_score),improved:remediation.improved,sources,fallbackResources,createdAt:remediation.created_at,updatedAt:remediation.updated_at};
}

export async function getGroundedRemediation(userId:string,remediationId:string) {
  const remediation=await getRemediation(userId,remediationId);
  if(!remediation)throw notFound("Remediation not found","REMEDIATION_NOT_FOUND");
  return remediationResponse(userId,remediation,remediation.concept_id);
}

export async function createVerification(userId:string,remediationId:string) {
  const remediation=await getRemediationForVerification(userId,remediationId);
  if(!remediation)throw notFound("Remediation not found","REMEDIATION_NOT_FOUND");
  if(remediation.status==="verified"||remediation.status==="verification_created"){
    const {createTargetedVerification}=await import("../question/assessmentService.js");
    return {attempt:await createTargetedVerification(userId,remediationId),remediationId};
  }
  if(remediation.status!=="ready")throw conflict("Generate grounded remediation before starting verification","REMEDIATION_NOT_READY");
  const {createTargetedVerification}=await import("../question/assessmentService.js");
  const attempt=await createTargetedVerification(userId,remediationId);
  return {attempt,remediationId};
}

export async function setVerificationStatus(remediationId:string,status:string,attemptId?:string|null){await updateRemediationStatus(remediationId,status,attemptId);}
