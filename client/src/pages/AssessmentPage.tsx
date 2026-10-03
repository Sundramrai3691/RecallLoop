import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type RecallAttempt } from "../types";

export function AssessmentPage() {
  const { id } = useParams();
  const [assessment, setAssessment] = useState<{ id: string; conceptId:string; mode: string; status: string; current: number; total: number } | null>(null);
  const [questions, setQuestions] = useState<RecallAttempt[]>([]);
  const [result, setResult] = useState<{ correct: number; total: number; dimensionScores: Record<string, number | null>; weakArea: string | null; recommendation: NonNullable<RecallAttempt["recommendation"]>|null } | null>(null);
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState("");
  const [confidence, setConfidence] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    try { const data = await api.getAssessment(id); setAssessment(data.assessment); setQuestions(data.questions); setResult(data.result); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Assessment not found"); }
  }
  useEffect(() => { void load(); }, [id]);
  const current = questions.find((item) => !item.submittedAt) ?? null;
  useEffect(() => { setAnswer(""); setSelected(""); setConfidence(6); }, [current?.id]);

  async function revealHint() {
    if (!current) return;
    try { await api.revealRecallHint(current.id); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not reveal hint"); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!current) return;
    setBusy(true); setError(null);
    try { await api.submitRecall(current.id,{ answer, selectedOptionId: selected || undefined, confidence }); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not submit answer"); }
    finally { setBusy(false); }
  }
  async function startRecommended(){if(!assessment||!result?.recommendation)return;const action=result.recommendation.actionType;if(action==="learn"){window.location.assign(`/resources?conceptId=${encodeURIComponent(assessment.conceptId)}`);return;}const mode=action==="practice"?"practice":action==="mastery_check"?"mastery_check":action==="remediation"?"deep_recall":"rapid_fire";try{const run=await api.createAssessment(assessment.conceptId,mode);window.location.assign(`/assessments/${run.assessment.id}`);}catch(err){setError(err instanceof ApiError?err.message:"Could not start the recommended activity");}}
  if (error && !assessment) return <p className="error">{error}</p>;
  if (!assessment) return <p className="muted">Loading assessment…</p>;
  const rapid = assessment.mode === "rapid_fire";
  return <div>
    <section className="hero"><p className="badge due">{assessment.mode.replace("_"," ")}</p><h1>{result ? "Assessment result" : rapid ? "Rapid Fire" : assessment.mode === "mastery_check" ? "Mastery Check" : assessment.mode === "practice" ? "Apply" : "Deep Recall"}</h1><p className="muted">{result ? "Your evidence across this session." : `Question ${assessment.current} / ${assessment.total}`}</p></section>
    {error ? <p className="error">{error}</p> : null}
    {result ? <article className="card"><h2>{result.correct} / {result.total} correct</h2>{result.weakArea ? <p>Weak area: {result.weakArea}</p> : null}<h3>What you demonstrated</h3>{Object.entries(result.dimensionScores).map(([dimension,score]) => <p key={dimension}>{dimension}: {score == null ? "Not sampled" : `${Math.round(score*100)}%`}</p>)}{result.recommendation?<section><h3>Recommended next step</h3><p><strong>{result.recommendation.title}</strong></p><p>Why: {result.recommendation.reason}</p><p>Estimated: {result.recommendation.estimatedMinutes} minutes</p>{result.recommendation.actionType!=="none"?<button className="btn" type="button" onClick={()=>void startRecommended()}>Practice now</button>:null}</section>:null}<div className="actions"><Link className="btn btn-primary" to="/dashboard">Done for now</Link></div></article> : current ? <form className={`card ${rapid ? "rapid-fire" : ""}`} onSubmit={(event) => void submit(event)}>
      <p className="badge">{current.questionData?.title ?? current.questionType} · ~{current.questionData?.estimatedMinutes ?? 2} min</p>
      {current.questionData?.context ? <p>{current.questionData.context}</p> : null}<h2>{current.questionData?.prompt ?? current.question}</h2>
      {current.questionData?.revealedHints.map((hint,index) => <p key={index}><strong>Hint {index+1}:</strong> {hint}</p>)}
      {current.questionData && current.questionData.hintsRemaining > 0 ? <button className="btn" type="button" onClick={() => void revealHint()}>Reveal hint {current.maxHintLevel+1}</button> : null}
      {current.questionType === "mcq" ? <fieldset><legend>Select one</legend>{current.questionData?.options?.map((option) => <label className="option" key={option.id}><input type="radio" name="answer" checked={selected===option.id} onChange={()=>setSelected(option.id)} /> {option.text}</label>)}</fieldset> : <><label htmlFor="assessment-answer">Your answer</label><textarea id="assessment-answer" required value={answer} onChange={(event)=>setAnswer(event.target.value)} placeholder={rapid ? "One line is enough." : "Answer from memory."}/></>}
      <label htmlFor="assessment-confidence">Confidence ({confidence}/10)</label><input id="assessment-confidence" type="range" min={1} max={10} value={confidence} onChange={(event)=>setConfidence(Number(event.target.value))}/>
      <button className="btn btn-primary" disabled={busy || (current.questionType === "mcq" ? !selected : !answer.trim())} type="submit">{busy ? "Saving…" : "Submit and continue"}</button>
    </form> : <p className="muted">This assessment is complete.</p>}
  </div>;
}
