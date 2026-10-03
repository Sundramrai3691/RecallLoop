import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type ResourceRecommendation } from "../types";

export function ResourcesPage() {
  const [params] = useSearchParams();
  const conceptId = params.get("conceptId") ?? undefined;
  const [available,setAvailable]=useState(60);
  const [resources,setResources]=useState<ResourceRecommendation[]>([]);
  const [pack,setPack]=useState<Awaited<ReturnType<typeof api.learningPack>>["pack"]|null>(null);
  const [sources,setSources]=useState<Awaited<ReturnType<typeof api.listGroundingSources>>["sources"]>([]);
  const [title,setTitle]=useState("");
  const [text,setText]=useState("");
  const [reference,setReference]=useState("");
  const [provenance,setProvenance]=useState("");
  const [sourceType,setSourceType]=useState<"text"|"markdown">("text");
  const [notice,setNotice]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);

  async function load(){
    try {
      const [resourceResult,packResult,sourceResult]=await Promise.all([
        api.recommendedResources(conceptId,available),
        conceptId?api.learningPack(conceptId,available):Promise.resolve(null),
        api.listGroundingSources(),
      ]);
      setResources(resourceResult.resources);setPack(packResult?.pack??null);setSources(sourceResult.sources);setError(null);
    }catch(err){setError(err instanceof ApiError?err.message:"Could not load focused resources");}
  }
  useEffect(()=>{void load();},[conceptId]);

  async function addSource(event:FormEvent){
    event.preventDefault();setNotice(null);setError(null);
    try{
      const result=await api.ingestGroundingSource({title,text,sourceType,reference,provenance:provenance.trim()?{attribution:provenance.trim(),submittedBy:"learner"}:{submittedBy:"learner"}});
      setNotice(`${result.source.duplicate?"Source refreshed":"Source added"}: ${result.source.chunkCount} searchable chunks.`);
      setTitle("");setText("");setReference("");setProvenance("");await load();
    }catch(err){setError(err instanceof ApiError?err.message:"Could not process source text");}
  }

  return <div>
    <section className="hero">
      <h1>Focused resources</h1>
      <p>Resources are ranked against the concept gap, learner evidence, source quality, freshness, and your available time.</p>
      <label>Available minutes<input type="number" min={0} max={240} value={available} onChange={(event)=>setAvailable(Number(event.target.value))}/></label>
      <button className="btn btn-primary" type="button" onClick={()=>void load()}>Update recommendations</button>
    </section>
    {error?<p className="error">{error}</p>:null}{notice?<p className="muted">{notice}</p>:null}
    <section className="card">
      <h2>Add source text for grounded remediation</h2>
      <p className="muted">Paste material you own or are allowed to use. Add its original title and URL or file reference so remediation can cite it. RecallLoop does not fetch or crawl the reference.</p>
      <form className="grid" onSubmit={(event)=>void addSource(event)}>
        <label>Source title<input required maxLength={200} value={title} onChange={(event)=>setTitle(event.target.value)} /></label>
        <label>Original URL or file reference<input maxLength={1000} value={reference} onChange={(event)=>setReference(event.target.value)} placeholder="Optional attribution link" /></label>
        <label>Attribution note<input maxLength={500} value={provenance} onChange={(event)=>setProvenance(event.target.value)} placeholder="Author, license, or where this excerpt came from" /></label>
        <label>Format<select value={sourceType} onChange={(event)=>setSourceType(event.target.value as "text"|"markdown")}><option value="text">Plain text</option><option value="markdown">Markdown</option></select></label>
        <label>Text or Markdown<textarea required maxLength={250000} rows={8} value={text} onChange={(event)=>setText(event.target.value)} /></label>
        <button className="btn btn-primary" type="submit" disabled={!title.trim()||!text.trim()}>Process source</button>
      </form>
      {sources.length?<div><h3>Your sources</h3>{sources.slice(0,8).map((source)=><p key={source.id}><strong>{source.title}</strong> · {source.processingStatus} · {source.chunkCount} chunks{source.reference?<> · <span>{source.reference}</span></>:null}{source.processingError?` · ${source.processingError}`:""}</p>)}</div>:null}
    </section>
    {pack?<section className="card"><h2>Learning Pack · {pack.conceptName}</h2><p>{pack.estimatedTotalMinutes} min of {pack.availableMinutes} available · {pack.remainingMinutes} min remaining</p>{pack.items.map((item,index)=><article className="row" key={`${item.kind}-${index}`}><span className="badge">{item.minutes} min · {item.kind}</span>{item.url?<a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>:<strong>{item.title}</strong>}<p className="muted">{item.reason}</p></article>)}</section>:null}
    <section className="grid" style={{marginTop:16}}>{resources.map((resource)=><article className="card" key={resource.id}><a href={resource.url} target="_blank" rel="noreferrer"><h2>{resource.title}</h2></a><p>{resource.description}</p><p className="muted">{resource.estimatedMinutes} min · Difficulty {resource.difficulty} · Trust tier {resource.trustTier}{resource.freshness?` · ${resource.freshness}`:""}</p><p>Concepts covered: {resource.conceptsCovered.join(", ")}</p><p>{resource.reason}</p></article>)}</section>
    {conceptId&&resources.length===0&&!error?<p className="muted">No resource with matching coverage fits this time budget.</p>:null}
  </div>;
}
