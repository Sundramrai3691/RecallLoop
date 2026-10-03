import { query, withTransaction } from "../db/postgres.js";
import type { TextChunk } from "../services/grounding/chunker.js";
import type { EmbeddingProvider } from "../services/grounding/embeddingProvider.js";
import type { GroundedRemediation, GroundingSource } from "../services/grounding/remediationGenerator.js";

export interface GroundingDocument { id:string; userId:string; title:string; sourceType:string; reference:string; provenance:Record<string,unknown>; content:string; contentHash:string; processingStatus:string; processingError:string|null; createdAt:string; updatedAt:string; }
export interface RetrievedChunk extends GroundingSource { relevance:number; }

function mapDocument(row:any):GroundingDocument { return {id:row.id,userId:row.user_id,title:row.title,sourceType:row.source_type,reference:row.reference,provenance:row.provenance,content:row.content,contentHash:row.content_hash,processingStatus:row.processing_status,processingError:row.processing_error,createdAt:row.created_at,updatedAt:row.updated_at}; }

export async function beginSourceProcessing(input:{userId:string;title:string;sourceType:string;reference:string;provenance:Record<string,unknown>;content:string;contentHash:string}) {
  const result=await query<any>(`INSERT INTO grounding_sources(user_id,title,source_type,reference,provenance,content,content_hash,processing_status,processing_error)
    VALUES($1,$2,$3,$4,$5,$6,$7,'processing',NULL)
    ON CONFLICT(user_id,content_hash) DO UPDATE SET title=EXCLUDED.title,source_type=EXCLUDED.source_type,reference=EXCLUDED.reference,provenance=EXCLUDED.provenance,content=EXCLUDED.content,processing_status='processing',processing_error=NULL,updated_at=now()
    RETURNING *, (xmax=0) AS inserted`,[input.userId,input.title,input.sourceType,input.reference,JSON.stringify(input.provenance),input.content,input.contentHash]);
  return {...mapDocument(result.rows[0]),duplicate:!result.rows[0].inserted};
}

export async function finishSourceProcessing(sourceId:string,chunks:Array<TextChunk & {embedding:number[]}>,provider:EmbeddingProvider) {
  await withTransaction(async(client)=>{
    for(const chunk of chunks) await client.query(`INSERT INTO grounding_chunks(id,source_id,chunk_order,content,metadata,embedding,embedding_model,embedding_dimensions)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT(source_id,chunk_order) DO UPDATE SET content=EXCLUDED.content,metadata=EXCLUDED.metadata,embedding=EXCLUDED.embedding,embedding_model=EXCLUDED.embedding_model,embedding_dimensions=EXCLUDED.embedding_dimensions`,[chunk.id,sourceId,chunk.order,chunk.text,JSON.stringify(chunk.metadata),chunk.embedding,provider.name,chunk.embedding.length]);
    await client.query(`UPDATE grounding_sources SET processing_status='processed',processing_error=NULL,updated_at=now() WHERE id=$1`,[sourceId]);
  });
  const result=await query<any>(`SELECT * FROM grounding_sources WHERE id=$1`,[sourceId]);
  return mapDocument(result.rows[0]);
}

export async function failSourceProcessing(sourceId:string,error:string) {
  await query(`UPDATE grounding_sources SET processing_status='failed',processing_error=$2,updated_at=now() WHERE id=$1`,[sourceId,error.slice(0,1000)]);
}

export async function findSource(userId:string,sourceId:string) {
  const result=await query<any>(`SELECT * FROM grounding_sources WHERE id=$1 AND user_id=$2`,[sourceId,userId]);
  return result.rows[0]?mapDocument(result.rows[0]):null;
}

export async function listSources(userId:string) {
  const result=await query<any>(`SELECT id,title,source_type AS "sourceType",reference,provenance,content_hash AS "contentHash",processing_status AS "processingStatus",processing_error AS "processingError",created_at AS "createdAt",updated_at AS "updatedAt",(SELECT count(*)::int FROM grounding_chunks c WHERE c.source_id=s.id) AS "chunkCount" FROM grounding_sources s WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,[userId]);
  return result.rows;
}

export async function retrieveChunks(userId:string,queryEmbedding:number[],providerName:string,limit=40):Promise<Array<GroundingSource & {embedding:number[]}>> {
  const result=await query<any>(`SELECT c.id AS "chunkId",s.id AS "sourceId",s.title,s.source_type AS "sourceType",s.reference,s.provenance,c.content AS text,c.embedding,c.embedding_model AS "embeddingModel",c.embedding_dimensions AS "embeddingDimensions"
    FROM grounding_chunks c JOIN grounding_sources s ON s.id=c.source_id
    WHERE s.user_id=$1 AND s.processing_status='processed' AND c.embedding_model=$2 AND c.embedding_dimensions=$3
    ORDER BY s.created_at DESC,c.chunk_order LIMIT $4`,[userId,providerName,queryEmbedding.length,5000]);
  return result.rows.slice(0,limit).map((row)=>({...row,embedding:row.embedding}));
}

export async function createOrGetRemediation(input:{userId:string;attemptId:string;conceptId:string;knowledgePoint:string;reason:string;evidence:unknown;triggerScore:number}) {
  const result=await query<any>(`INSERT INTO grounded_remediations(user_id,triggering_attempt_id,concept_id,knowledge_point,reason,evidence,trigger_score,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,'pending') ON CONFLICT(triggering_attempt_id) DO UPDATE SET updated_at=now() RETURNING id`,[input.userId,input.attemptId,input.conceptId,input.knowledgePoint,input.reason,JSON.stringify(input.evidence),input.triggerScore]);
  return result.rows[0].id as string;
}

export async function storeRemediationRetrieval(remediationId:string,chunks:RetrievedChunk[]) {
  await withTransaction(async(client)=>{
    await client.query(`DELETE FROM grounded_remediation_chunks WHERE remediation_id=$1`,[remediationId]);
    for(let i=0;i<chunks.length;i++) await client.query(`INSERT INTO grounded_remediation_chunks(remediation_id,chunk_id,rank,relevance) VALUES($1,$2,$3,$4)`,[remediationId,chunks[i].chunkId,i+1,chunks[i].relevance]);
  });
}

export async function updateRemediation(remediationId:string,input:{status:string;content?:GroundedRemediation|null;error?:string|null}) {
  await query(`UPDATE grounded_remediations SET status=$2,content=$3,generation_error=$4,updated_at=now() WHERE id=$1`,[remediationId,input.status,input.content?JSON.stringify(input.content):null,input.error??null]);
}

export async function getRemediation(userId:string,remediationId:string) {
  const result=await query<any>(`SELECT r.*,c.name AS "conceptName",json_agg(json_build_object('chunkId',gc.id,'sourceId',s.id,'title',s.title,'sourceType',s.source_type,'reference',s.reference,'provenance',s.provenance,'relevance',grc.relevance,'chunkOrder',gc.chunk_order,'text',gc.content) ORDER BY grc.rank) FILTER(WHERE gc.id IS NOT NULL) AS sources
    FROM grounded_remediations r JOIN personal_concepts c ON c.id=r.concept_id AND c.user_id=r.user_id
    LEFT JOIN grounded_remediation_chunks grc ON grc.remediation_id=r.id LEFT JOIN grounding_chunks gc ON gc.id=grc.chunk_id LEFT JOIN grounding_sources s ON s.id=gc.source_id
    WHERE r.id=$1 AND r.user_id=$2 GROUP BY r.id,c.name`,[remediationId,userId]);
  return result.rows[0]??null;
}

export async function updateRemediationStatus(remediationId:string,status:string,verificationAttemptId?:string|null) {
  await query(`UPDATE grounded_remediations SET status=$2,verification_attempt_id=COALESCE($3,verification_attempt_id),updated_at=now() WHERE id=$1`,[remediationId,status,verificationAttemptId??null]);
}

export async function getRemediationForVerification(userId:string,remediationId:string) {
  const result=await query<any>(`SELECT * FROM grounded_remediations WHERE id=$1 AND user_id=$2`,[remediationId,userId]);
  return result.rows[0]??null;
}
