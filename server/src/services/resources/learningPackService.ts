import { query } from "../../db/postgres.js";
import { AppError, notFound } from "../../utils/errors.js";
import { recommendResources } from "./resourceRecommendationService.js";

export async function buildLearningPack(input:{userId:string;conceptId:string;availableMinutes:number;goalId?:string}){
  const available=Math.max(0,Math.min(240,Math.floor(input.availableMinutes)));
  if(!Number.isFinite(available))throw new AppError("availableMinutes must be a finite number",400,"VALIDATION_ERROR");
  const conceptResult=await query<any>(`SELECT id,name,mastery FROM personal_concepts WHERE id=$1 AND user_id=$2`,[input.conceptId,input.userId]);
  const concept=conceptResult.rows[0];if(!concept)throw notFound("Concept not found","MISSING_CONCEPT");
  const dimensionsResult=await query<any>(`SELECT d.dimension,AVG(d.score)::float AS score FROM recall_dimension_results d JOIN recall_attempts r ON r.id=d.recall_attempt_id WHERE r.user_id=$1 AND r.concept_id=$2 GROUP BY d.dimension`,[input.userId,input.conceptId]);
  const dimensions=Object.fromEntries(dimensionsResult.rows.map((row)=>[row.dimension,Number(row.score)]));
  const reserve=available>=40?40:Math.floor(available*.4);
  const resources=await recommendResources({userId:input.userId,conceptId:input.conceptId,goalId:input.goalId,availableMinutes:Math.max(0,available-reserve),limit:2});
  const items:Array<{kind:"resource"|"explanation"|"application"|"recall";title:string;minutes:number;reason:string;url?:string}> = resources.map((resource)=>({kind:"resource",title:resource.title,minutes:resource.estimatedMinutes,reason:resource.reason,url:resource.url}));
  let remaining=available-items.reduce((sum,item)=>sum+item.minutes,0);
  const activities:["explanation"|"application"|"recall",number,string][]=[
    ["explanation",12,dimensions.explanation==null?"Explanation evidence is not recorded yet.":`Explanation score is ${Math.round(dimensions.explanation*100)}%.`],
    ["application",20,dimensions.application==null?"Application evidence is not recorded yet.":`Application score is ${Math.round(dimensions.application*100)}%.`],
    ["recall",8,"Retrieve the required knowledge points after study."],
  ];
  for(const [kind,minutes,reason] of activities){if(minutes<=remaining){items.push({kind,title:kind==="explanation"?`Explain · ${concept.name}`:kind==="application"?`Apply · ${concept.name}`:`Quick recall · ${concept.name}`,minutes,reason});remaining-=minutes;}}
  const estimatedTotalMinutes=items.reduce((sum,item)=>sum+item.minutes,0);
  return {conceptId:concept.id,conceptName:concept.name,availableMinutes:available,estimatedTotalMinutes,remainingMinutes:available-estimatedTotalMinutes,items};
}
