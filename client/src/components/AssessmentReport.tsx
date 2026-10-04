import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import type { KnowledgePointResult } from "../types";
import { PageHeader, ProgressBar } from "./Ui";

type ReportPoints = { correct?: KnowledgePointResult[]; partial?: KnowledgePointResult[]; missing?: KnowledgePointResult[] };

export function AssessmentReport({ eyebrow, title, description, scoreLabel, score, scoreDetail, confidence, points, dimensions, misconceptions, why, nextAction, children }: {
  eyebrow: string; title: string; description: string; scoreLabel?: string; score?: string | null; scoreDetail?: string;
  confidence?: { label: string; value: string }; points?: ReportPoints; dimensions?: Record<string, number | null>;
  misconceptions?: string[]; why?: string; nextAction?: ReactNode; children?: ReactNode;
}) {
  const groups = [
    { key: "correct", title: "Strong", Icon: Check, values: points?.correct ?? [] },
    { key: "partial", title: "Developing", Icon: null, values: points?.partial ?? [] },
    { key: "missing", title: "Needs work", Icon: X, values: points?.missing ?? [] },
  ];
  return <div className="report-page">
    <PageHeader eyebrow={eyebrow} title={title} description={description}/>
    {score !== undefined || confidence ? <section className="report-hero card"><div>{scoreLabel?<p className="eyebrow">{scoreLabel}</p>:null}<p className={score==null?"not-assessed":"hero-stat"}>{score??"Not assessed"}</p>{scoreDetail?<p className="muted">{scoreDetail}</p>:null}</div>{confidence?<div className="confidence-report"><span className="eyebrow">CONFIDENCE</span><div><span>{confidence.label}</span><strong>{confidence.value}</strong></div></div>:null}</section>:null}
    {why?<section className="card report-feedback"><h2>Why this result?</h2><p>{why}</p></section>:null}
    {groups.map(({key,title:groupTitle,Icon,values})=>values.length?<section className={`card report-band ${key==="correct"?"strong-band":key==="partial"?"developing-band":"weak-band"}`} key={key}><h2><span className="report-state-icon">{Icon?<Icon size={15}/>:"•"}</span>{groupTitle}</h2><div className="report-points">{values.map((point,index)=><article className="report-point" key={`${point.point}-${index}`}><strong>{point.point}</strong>{point.feedback?<p className="muted">{point.feedback}</p>:null}</article>)}</div></section>:null)}
    {dimensions&&Object.keys(dimensions).length>0?<section className="card"><h2>Evidence across dimensions</h2><div className="dimension-list">{Object.entries(dimensions).map(([name,value])=><div className="report-dimension" key={name}><span>{name.replaceAll("_"," ")}</span>{value===null?<span className="metadata">Not assessed</span>:<><ProgressBar value={value*100} label={`${name} evidence`}/><strong>{Math.round(value*100)}%</strong></>}</div>)}</div></section>:null}
    {misconceptions?.length?<section className="card"><h2>Why did I struggle?</h2><ul className="mistake-list">{misconceptions.map((item,index)=><li key={`${item}-${index}`}>{item}</li>)}</ul></section>:null}
    {children}
    {nextAction?<section className="next-step-card card"><p className="eyebrow">NEXT BEST ACTION</p>{nextAction}</section>:null}
  </div>;
}
