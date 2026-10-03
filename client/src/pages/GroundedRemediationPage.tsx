import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type GroundedRemediation } from "../types";

export function GroundedRemediationPage(){
  const {id}=useParams();const navigate=useNavigate();
  const [remediation,setRemediation]=useState<GroundedRemediation|null>(null);
  const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false);
  useEffect(()=>{if(id)api.getRemediation(id).then((result)=>setRemediation(result.remediation)).catch((err)=>setError(err instanceof ApiError?err.message:"Could not load this remediation"));},[id]);
  async function verify(){if(!id)return;setBusy(true);setError(null);try{const result=await api.verifyRemediation(id);navigate(`/recall/${result.attempt.id}`);}catch(err){setError(err instanceof ApiError?err.message:"Could not start targeted verification");}finally{setBusy(false);}}
  if(error&&!remediation)return <p className="error">{error}</p>;
  if(!remediation)return <p className="muted">Loading focused remediation...</p>;
  const content=remediation.content;
  return <div className="grid">
    <section className="hero"><p className="badge due">{remediation.status.replaceAll("_"," ")}</p><h1>{content?.title??`Focused remediation · ${remediation.conceptName}`}</h1><p><strong>Learning gap:</strong> {remediation.knowledgePoint}</p><p><strong>Why this?</strong> {remediation.reason}</p></section>
    {error?<p className="error">{error}</p>:null}
    {remediation.status==="insufficient_sources"?<article className="card"><h2>Relevant material wasn’t found</h2><p>RecallLoop did not find a source excerpt closely related enough to this exact gap, so it did not generate an explanation.</p>{remediation.fallbackResources.map((resource)=><p key={resource.id}><a href={resource.url} target="_blank" rel="noreferrer">{resource.title}</a> · {resource.estimatedMinutes} min</p>)}</article>:null}
    {remediation.status==="failed"?<article className="card"><h2>Remediation could not be generated</h2><p>{remediation.generationError??"The configured generator was unavailable."} Retrieved source references are retained below.</p>{remediation.fallbackResources.map((resource)=><p key={resource.id}><a href={resource.url} target="_blank" rel="noreferrer">{resource.title}</a> · {resource.estimatedMinutes} min</p>)}</article>:null}
    {content?<article className="card"><h2>Focused explanation</h2><p>{content.explanation}</p><h3>Key points from the material</h3><ul>{content.keyPoints.map((point,index)=><li key={index}>{point}</li>)}</ul><h3>What the evaluation observed</h3><p>{content.commonMistake}</p><h3>Check yourself</h3><ol>{content.checkYourself.map((question,index)=><li key={index}>{question}</li>)}</ol>{content.unsupportedAspects.length?<p className="muted">The retrieved sources do not establish: {content.unsupportedAspects.join("; ")}</p>:null}</article>:null}
    {remediation.sources.length?<article className="card"><h2>Sources used</h2>{remediation.sources.map((source)=><div key={source.chunkId} className="kp-item"><strong>{source.title}</strong><p className="muted">{source.sourceType} · relevance {Math.round(source.relevance*100)}%{source.reference?" · ":""}{/^https?:\/\//i.test(source.reference)?<a href={source.reference} target="_blank" rel="noreferrer">Original source</a>:source.reference}</p>{Object.keys(source.provenance??{}).length?<p className="muted">Provenance: {Object.entries(source.provenance).map(([key,value])=>`${key}: ${String(value)}`).join(" · ")}</p>:null}<p>{source.text.slice(0,650)}{source.text.length>650?"…":""}</p></div>)}</article>:null}
    {remediation.status==="verified"?<article className="card"><h2>Verification result</h2>{remediation.improved?<p>Your evaluated answer showed stronger evidence for this knowledge point than the triggering recall.</p>:<p>The latest answer did not show stronger evidence yet. The result is based on the answer evaluation, not on opening this remediation.</p>}<p>Before: {Math.round((remediation.triggerScore??0)*100)}% evidence · After: {Math.round((remediation.verificationScore??0)*100)}% evidence</p></article>:null}
    {remediation.status==="ready"?<button className="btn btn-primary" disabled={busy} onClick={()=>void verify()} type="button">{busy?"Starting...":"Start targeted verification"}</button>:null}
    {remediation.status==="verification_created"&&remediation.verificationAttemptId?<Link className="btn btn-primary" to={`/recall/${remediation.verificationAttemptId}`}>Continue targeted verification</Link>:null}
  </div>;
}
