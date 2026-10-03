import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type PlanTask } from "../types";
import { WhyThis } from "../components/WhyThis";

export function PlanPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [availableMinutes, setAvailableMinutes] = useState(60);
  const [timeBudget, setTimeBudget] = useState<{availableMinutes:number;plannedMinutes:number;remainingMinutes:number}|null>(null);
  const [backlog,setBacklog]=useState({carriedForwardCount:0,deferredCount:0});
  const goalId = searchParams.get("goalId");

  async function load() {
    try {
      const result = await api.todayPlan();
      setTasks(result.tasks);
      setTimeBudget(result.timeBudget);
      setBacklog(result.backlog ?? {carriedForwardCount:0,deferredCount:0});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load today's plan");
    }
  }
  useEffect(() => { void load(); }, []);

  async function generate() {
    if (!goalId) return;
    setBusy(true); setError(null);
    try { await api.generatePlan(goalId, availableMinutes); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not generate plan"); }
    finally { setBusy(false); }
  }
  async function taskStatus(taskId: string, status: "completed" | "in_progress" | "missed") {
    await api.updatePlanTask(taskId,status);
    if (status === "completed" || status === "missed") await load();
  }
  const renderTask=(task:PlanTask)=><article className="card" key={task.id}>
    <div className="actions"><span className="badge due">{task.requiredness.toUpperCase()}</span><span className="badge">{task.sequenceOrder}. {task.taskType}</span><span className="badge">{task.estimatedMinutes} min</span></div>
    <h2>{task.title}</h2><p>{task.description}</p>{task.resourceUrl?<p><a href={task.resourceUrl} target="_blank" rel="noreferrer">Open focused resource</a></p>:null}<WhyThis reason={task.reason} />
    {task.status === "completed" ? <span className="badge good">Completed</span> : <div className="actions">
      {task.recallAttemptId ? <Link className="btn btn-primary" to={`/recall/${task.recallAttemptId}`} onClick={() => void taskStatus(task.id,"in_progress")}>Start</Link> : null}
      {task.conceptId && !task.recallAttemptId ? <button className="btn btn-primary" type="button" onClick={async () => { try { const run = await api.createAssessment(task.conceptId!,task.taskType==="assessment"?"mastery_check":"rapid_fire"); await taskStatus(task.id,"in_progress"); navigate(`/assessments/${run.assessment.id}`); } catch (err) { setError(err instanceof ApiError ? err.message : "Could not start practice"); } }}>{task.taskType==="assessment"?"Start mastery check":"Practice now"}</button> : null}
      <button className="btn" onClick={() => void taskStatus(task.id,"in_progress")} type="button">Do later</button><button className="btn" onClick={() => void taskStatus(task.id,"completed")} type="button">Done for now</button><button className="btn" onClick={() => void taskStatus(task.id,"missed")} type="button">Skip</button>
    </div>}
  </article>;

  return <div>
    <section className="hero"><h1>Today&apos;s plan</h1><p className="muted">A focused sequence of recall, learning, practice, and remediation.</p>{timeBudget?<p>{timeBudget.availableMinutes} min available</p>:null}</section>
    {error ? <p className="error">{error}</p> : null}
    {goalId ? <div className="actions"><label>Available today (minutes)<input type="number" min={0} max={240} value={availableMinutes} onChange={(event) => setAvailableMinutes(Number(event.target.value))} /></label><button className="btn btn-primary" disabled={busy} onClick={() => void generate()} type="button">{busy ? "Generating…" : "Generate plan"}</button></div> : <p className="muted">Open a goal and choose View plan to generate goal-specific work.</p>}
    {timeBudget?<p className="muted">{timeBudget.availableMinutes} min available · {timeBudget.plannedMinutes} min planned · {timeBudget.remainingMinutes} min remaining</p>:null}
    {(backlog.carriedForwardCount>0||backlog.deferredCount>0)?<p className="muted">{backlog.carriedForwardCount} tasks carried forward · {backlog.deferredCount} lower-priority tasks deferred</p>:null}
    <div className="grid" style={{ marginTop: 16 }}>
      {tasks.length ? (["must","recommended","optional"] as const).map((requiredness)=>{const sectionTasks=tasks.filter((task)=>task.requiredness===requiredness);return sectionTasks.length?<section key={requiredness}><h2>{requiredness==="must"?"Must do":requiredness[0].toUpperCase()+requiredness.slice(1)}</h2><div className="grid">{sectionTasks.map(renderTask)}</div></section>:null;}) : <p className="muted">No plan yet. Generate one from a goal.</p>}
    </div>
  </div>;
}
