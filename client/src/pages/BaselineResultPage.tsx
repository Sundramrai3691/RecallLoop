import { useEffect, useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { AssessmentReport } from "../components/AssessmentReport";
import { EmptyState } from "../components/Ui";
import { ApiError, type BaselineQuestion, type KnowledgePointResult, type ResourceRecommendation } from "../types";

type BaselineResultData={assessment:{goalId:string;baselineSource:string;baselineConfidence:number|null;observedMastery:number|null;selfDeclaredMastery:number|null;selectedLevel:string};questions:BaselineQuestion[]};

export function BaselineResultPage(){
  const {id}=useParams();const [baseline,setBaseline]=useState<BaselineResultData|null>(null);const [starting,setStarting]=useState<Awaited<ReturnType<typeof api.getStartingPoint>>|null>(null);const [resources,setResources]=useState<ResourceRecommendation[]>([]);const [error,setError]=useState<string|null>(null);
  useEffect(()=>{if(!id)return;let active=true;void api.getBaseline(id).then(async(result)=>{if(!active)return;setBaseline(result.baseline);const point=await api.getStartingPoint(result.baseline.assessment.goalId);if(active){setStarting(point);setResources(point.resources);}}).catch((err)=>{if(active)setError(err instanceof ApiError&&err.status===404?"This starting point could not be found.":"We couldn’t load your starting point.");});return()=>{active=false;};},[id]);
  if(error)return <p className="error" role="alert">{error}</p>;if(!baseline)return <div className="card grid"><div className="skeleton"/><div className="skeleton"/></div>;
  const assessed=baseline.assessment.baselineSource==="assessed";const evidence:KnowledgePointResult[]=baseline.questions.flatMap((question)=>question.knowledgePointResults??[]);const points={correct:evidence.filter((point)=>point.status==="correct"),partial:evidence.filter((point)=>point.status==="partial"),missing:evidence.filter((point)=>point.status==="missing")};const answered=baseline.questions.filter((question)=>question.submittedAt).length;
  const observedStatus=evidence.length===0?"Not assessed":points.missing.length?"Weak":points.partial.length?"Developing":"Strong";
  const score=assessed&&baseline.assessment.observedMastery!=null?`${Math.round(Number(baseline.assessment.observedMastery)*100)}%`:null;
  const firstTopic=starting?.startingConcept?.name;
  return <AssessmentReport eyebrow="Starting point" title="Your learning starts here" description="Your self-assessment and demonstrated recall are kept separate, so you can see what evidence you’ve built." scoreLabel="Observed" score={score} scoreDetail={assessed?`${observedStatus} · ${evidence.length||answered} assessed knowledge point${(evidence.length||answered)===1?"":"s"}`:"No recall evidence yet. Your starting point is self-reported."} confidence={assessed&&answered>0&&baseline.assessment.baselineConfidence!=null?{label:"Self-reported confidence",value:`${Math.round(Number(baseline.assessment.baselineConfidence)*100)}%`}:undefined} points={points}>
    {!assessed?<section className="card"><p className="eyebrow">STARTING POINT YOU CHOSE</p><h2>{baseline.assessment.selectedLevel==="new"?"New to this topic":"Self-reported knowledge"}</h2><p className="muted">This describes where you chose to begin. It isn’t a measure of demonstrated mastery.</p></section>:null}
    {firstTopic?<section className="card"><p className="eyebrow">A GOOD PLACE TO BEGIN</p><h2>{firstTopic}</h2><p className="muted">RecallLoop picked this topic from your assessment results.</p></section>:null}
    <section className="card next-step-action"><p className="eyebrow">NEXT STEP</p><h2>Build your first recall evidence</h2><p className="muted">Study a topic, then explain it from memory. Your learner view will grow from there.</p><div className="actions"><Link className="btn btn-primary" to={`/study/new${firstTopic?`?topic=${encodeURIComponent(firstTopic)}`:""}`}>Start a study session <ArrowRight size={15}/></Link><Link className="btn" to={`/plan?goalId=${baseline.assessment.goalId}`}>Open learning plan</Link></div></section>
    {resources.length?<section><div className="section-heading"><h2>Suggested reading</h2></div><div className="grid grid-2">{resources.map((resource)=><article className="card resource-card" key={resource.id}><span className="status-chip">{resource.resourceType?.replaceAll("_"," ")??"Learning resource"}</span><h2>{resource.title}</h2><p className="muted">{resource.estimatedMinutes} min · {resource.reason}</p><a className="btn" href={resource.url} target="_blank" rel="noreferrer">Open resource <ArrowRight size={14}/></a></article>)}</div></section>:<EmptyState title="No focused reading to suggest yet" to={`/study/new${firstTopic?`?topic=${encodeURIComponent(firstTopic)}`:""}`} action="Start studying" icon={<BookOpen size={18}/>}>Your next recall will give RecallLoop evidence to match resources to what you need.</EmptyState>}
  </AssessmentReport>;
}
