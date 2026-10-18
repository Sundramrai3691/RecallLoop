import { useEffect, useState } from "react";
import { BookOpen, Check, CircleHelp, Clock3, Dumbbell, RefreshCw, Sparkles, Target } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, PageHeader, ProgressBar } from "../components/Ui";
import { WhyThis } from "../components/WhyThis";
import { type PlanTask } from "../types";
import { readableTitle } from "../utils/presentation";

const taskIcons = { recall: RefreshCw, learn: BookOpen, practice: Dumbbell, remediation: Sparkles, assessment: Target };
const taskLabels = { recall: "Recall", learn: "Learn", practice: "Practice", remediation: "Focused review", assessment: "Check understanding" };
type TaskStatus = "completed" | "in_progress" | "missed" | "planned";

export function PlanPage() {
  const [searchParams] = useSearchParams(); const navigate = useNavigate(); const goalId = searchParams.get("goalId");
  const [tasks, setTasks] = useState<PlanTask[]>([]); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [availableMinutes, setAvailableMinutes] = useState(60); const [timeBudget, setTimeBudget] = useState<{availableMinutes:number;plannedMinutes:number;remainingMinutes:number}|null>(null);
  async function load() { try { const result = await api.todayPlan(); setTasks(result.tasks); setTimeBudget(result.timeBudget); setError(null); } catch { setError("We couldn’t load today’s plan. Please try again."); } }
  useEffect(() => { void load(); }, []);
  async function generate() { if (!goalId) return; setBusy(true); setError(null); try { await api.generatePlan(goalId, availableMinutes); await load(); } catch { setError("We couldn’t make a plan for this goal. Please try again."); } finally { setBusy(false); } }
  async function updateTask(task: PlanTask, status: TaskStatus) {
    setBusyTaskId(task.id); setError(null);
    try { const updated = await api.updatePlanTask(task.id, status); setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: updated.task.status } : item)); }
    catch { setError("That update didn’t save. Your plan is unchanged. Please try again."); throw new Error("Plan task update failed"); }
    finally { setBusyTaskId(null); }
  }
  async function startTask(task: PlanTask) {
    setBusyTaskId(task.id); setError(null);
    try {
      if (task.recallAttemptId) {
        const updated = await api.updatePlanTask(task.id, "in_progress"); setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: updated.task.status } : item));
        navigate(`/recall/${task.recallAttemptId}?returnTo=${encodeURIComponent("/plan/today")}`); return;
      }
      if (task.taskType === "learn") {
        const updated = await api.updatePlanTask(task.id, "in_progress"); setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: updated.task.status } : item));
        const topic = task.title.replace(/^learn\s*[·:]\s*/i, "").trim() || task.title;
        navigate(`/study/new?topic=${encodeURIComponent(topic)}&returnTo=${encodeURIComponent("/plan/today")}`); return;
      }
      if (task.taskType === "remediation" && task.conceptId) { const updated = await api.updatePlanTask(task.id, "in_progress"); setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: updated.task.status } : item)); navigate(`/resources?conceptId=${encodeURIComponent(task.conceptId)}&returnTo=${encodeURIComponent("/plan/today")}`); return; }
      if (!task.conceptId) return;
      const updated = await api.updatePlanTask(task.id, "in_progress"); setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: updated.task.status } : item));
      const run = await api.createAssessment(task.conceptId, task.taskType === "assessment" ? "mastery_check" : "rapid_fire");
      navigate(`/assessments/${run.assessment.id}?returnTo=${encodeURIComponent("/plan/today")}`);
    } catch { setError("We couldn’t open this step. It remains on today’s plan; check your connection and try again."); }
    finally { setBusyTaskId(null); }
  }
  const ordered = [...tasks].sort((a,b) => a.sequenceOrder - b.sequenceOrder);
  const firstPending = ordered.find((task) => task.status === "planned" || task.status === "in_progress");
  return <div>
    <PageHeader eyebrow="Today" title="A learning journey for today" description="Start a step, keep it for later today, or skip it. Completed and skipped steps stay marked in your plan." />
    {error ? <p className="error" role="alert">{error}</p> : null}
    {timeBudget ? <section className="plan-summary card"><div><p className="eyebrow">TODAY’S JOURNEY</p><h2>{timeBudget.plannedMinutes} <span className="muted">min planned</span></h2></div><div className="plan-summary-meter"><ProgressBar value={timeBudget.plannedMinutes > 0 ? Math.min(100,timeBudget.plannedMinutes / Math.max(1,timeBudget.availableMinutes) * 100) : 0} label="Available time used"/><p className="metadata">{timeBudget.availableMinutes} min available · {timeBudget.remainingMinutes} min remaining</p></div></section> : null}
    {goalId ? <section className="plan-controls"><label htmlFor="available-minutes">Time available today</label><div className="plan-generate"><select id="available-minutes" value={availableMinutes} onChange={(event)=>setAvailableMinutes(Number(event.target.value))}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option></select><button className="btn btn-primary" disabled={busy} type="button" onClick={()=>void generate()}>{busy ? "Planning…" : "Build my plan"}</button></div></section> : !tasks.length ? <p className="muted">Open a goal to create a plan shaped around that outcome.</p> : null}
    {ordered.length ? <section className="journey">{ordered.map((task,index)=>{const Icon=taskIcons[task.taskType];const current=task.id===firstPending?.id;const done=task.status==="completed";const skipped=task.status==="missed";const taskBusy=busyTaskId===task.id;return <article className={`journey-step ${current?"current":""} ${done?"complete":""}`} key={task.id}>
      <div className="journey-rail"><span className="journey-number">{done?<Check size={15}/>:String(index+1).padStart(2,"0")}</span>{index<ordered.length-1?<span className="journey-line"/>:null}</div>
      <div className="journey-card card" data-task-id={task.id}><div className="journey-meta"><span className="task-type"><Icon size={15}/>{taskLabels[task.taskType]}</span><span className={`status-chip ${task.requiredness}`}>{task.requiredness==="must"?"Required":task.requiredness}</span>{task.status==="in_progress"?<span className="status-chip">In progress</span>:null}<span className="metadata"><Clock3 size={13}/>~{task.estimatedMinutes} min estimate</span></div><h2>{readableTitle(task.title, `${taskLabels[task.taskType]} session`)}</h2><p className="muted">{task.description}</p>{task.resourceUrl?<p><a href={task.resourceUrl} target="_blank" rel="noreferrer">Open focused resource</a></p>:null}<WhyThis reason={task.reason}/>
      {done?<span className="badge good">Completed</span>:skipped?<><span className="status-chip">Skipped for today</span><div className="actions"><button className="btn" type="button" disabled={!!busyTaskId} onClick={()=>void updateTask(task,"planned").catch(()=>undefined)}>Put back in today’s plan</button></div></>:<div className="actions">{task.recallAttemptId?<button className="btn btn-primary" type="button" disabled={!!busyTaskId} onClick={()=>void startTask(task)}>{taskBusy?"Opening recall…":current?"Start this step":task.status==="in_progress"?"Continue recall":"Start recall"}</button>:task.taskType==="learn"?<button className="btn btn-primary" type="button" disabled={!!busyTaskId} onClick={()=>void startTask(task)}>{taskBusy?"Opening study setup…":task.status==="in_progress"?"Continue this topic":"Study this topic"}</button>:task.taskType==="remediation"&&task.conceptId?<button className="btn btn-primary" type="button" disabled={!!busyTaskId} onClick={()=>void startTask(task)}>{taskBusy?"Opening resources…":"Open focused resources"}</button>:task.conceptId?<button className="btn btn-primary" type="button" disabled={!!busyTaskId} onClick={()=>void startTask(task)}>{taskBusy?"Preparing practice…":task.taskType==="assessment"?"Check understanding":current?"Start this step":task.status==="in_progress"?"Continue practice":"Practice now"}</button>:null}<button className="btn" type="button" disabled={!!busyTaskId} onClick={()=>void updateTask(task,"completed").catch(()=>undefined)}>Mark complete</button>{task.status!=="in_progress"?<button className="btn btn-quiet" type="button" disabled={!!busyTaskId} onClick={()=>void updateTask(task,"in_progress").catch(()=>undefined)}>Keep for later today</button>:null}<button className="btn btn-quiet" type="button" disabled={!!busyTaskId} onClick={()=>void updateTask(task,"missed").catch(()=>undefined)}>Skip today</button></div>}</div>
    </article>;})}</section> : !error ? <EmptyState title="Nothing planned for today" to={goalId?undefined:"/goals"} action={goalId?undefined:"Choose a goal"} icon={<CircleHelp size={18}/>}>{goalId?"Set the time you have available, then build a plan from your goal.":"Choose a goal to create a learning plan around your outcome."}</EmptyState> : null}
  </div>;
}
