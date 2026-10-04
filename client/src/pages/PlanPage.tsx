import { useEffect, useState } from "react";
import { BookOpen, Check, CircleHelp, Clock3, Dumbbell, RefreshCw, Sparkles, Target } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, PageHeader, ProgressBar } from "../components/Ui";
import { WhyThis } from "../components/WhyThis";
import { type PlanTask } from "../types";

const taskIcons = { recall: RefreshCw, learn: BookOpen, practice: Dumbbell, remediation: Sparkles, assessment: Target };
const taskLabels = { recall: "Recall", learn: "Learn", practice: "Practice", remediation: "Fix a gap", assessment: "Verify" };

export function PlanPage() {
  const [searchParams] = useSearchParams(); const navigate = useNavigate(); const goalId = searchParams.get("goalId");
  const [tasks, setTasks] = useState<PlanTask[]>([]); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [availableMinutes, setAvailableMinutes] = useState(60); const [timeBudget, setTimeBudget] = useState<{availableMinutes:number;plannedMinutes:number;remainingMinutes:number}|null>(null);
  async function load() { try { const result = await api.todayPlan(); setTasks(result.tasks); setTimeBudget(result.timeBudget); setError(null); } catch { setError("We couldn’t load today’s plan. Please try again."); } }
  useEffect(() => { void load(); }, []);
  async function generate() { if (!goalId) return; setBusy(true); setError(null); try { await api.generatePlan(goalId, availableMinutes); await load(); } catch { setError("We couldn’t make a plan for this goal. Please try again."); } finally { setBusy(false); } }
  async function taskStatus(id: string, status: "completed" | "in_progress" | "missed") { try { await api.updatePlanTask(id, status); if (status !== "in_progress") await load(); } catch { setError("That update didn’t save. Please try again."); } }
  async function startTask(task: PlanTask) { if (!task.conceptId || task.recallAttemptId) return; try { const run = await api.createAssessment(task.conceptId, task.taskType === "assessment" ? "mastery_check" : "rapid_fire"); await taskStatus(task.id, "in_progress"); navigate(`/assessments/${run.assessment.id}`); } catch { setError("We couldn’t start this practice. Please try again."); } }
  const ordered = [...tasks].sort((a,b) => a.sequenceOrder - b.sequenceOrder);
  const firstPending = ordered.find((task) => task.status !== "completed");
  return <div>
    <PageHeader eyebrow="Today" title="A learning journey for today" description="A focused sequence shaped by what you’ve studied and recalled." />
    {error ? <p className="error" role="alert">{error}</p> : null}
    {timeBudget ? <section className="plan-summary card"><div><p className="eyebrow">TODAY'S JOURNEY</p><h2>{timeBudget.plannedMinutes} <span className="muted">min planned</span></h2></div><div className="plan-summary-meter"><ProgressBar value={timeBudget.plannedMinutes > 0 ? Math.min(100,timeBudget.plannedMinutes / Math.max(1,timeBudget.availableMinutes) * 100) : 0} label="Available time used"/><p className="metadata">{timeBudget.availableMinutes} min available · {timeBudget.remainingMinutes} min remaining</p></div></section> : null}
    {goalId ? <section className="plan-controls"><label htmlFor="available-minutes">Time available today</label><div className="plan-generate"><select id="available-minutes" value={availableMinutes} onChange={(event)=>setAvailableMinutes(Number(event.target.value))}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option></select><button className="btn btn-primary" disabled={busy} type="button" onClick={()=>void generate()}>{busy ? "Planning…" : "Build my plan"}</button></div></section> : !tasks.length ? <p className="muted">Open a goal to create a plan shaped around that outcome.</p> : null}
    {ordered.length ? <section className="journey">{ordered.map((task,index)=>{const Icon=taskIcons[task.taskType];const current=task.id===firstPending?.id;const done=task.status==="completed";return <article className={`journey-step ${current?"current":""} ${done?"complete":""}`} key={task.id}>
      <div className="journey-rail"><span className="journey-number">{done?<Check size={15}/>:String(index+1).padStart(2,"0")}</span>{index<ordered.length-1?<span className="journey-line"/>:null}</div>
      <div className="journey-card card"><div className="journey-meta"><span className="task-type"><Icon size={15}/>{taskLabels[task.taskType]}</span><span className={`status-chip ${task.requiredness}`}>{task.requiredness==="must"?"Required":task.requiredness}</span><span className="metadata"><Clock3 size={13}/>{task.estimatedMinutes} min</span></div><h2>{task.title}</h2><p className="muted">{task.description}</p>{task.resourceUrl?<p><a href={task.resourceUrl} target="_blank" rel="noreferrer">Open focused resource</a></p>:null}<WhyThis reason={task.reason}/>
      {done?<span className="badge good">Completed</span>:<div className="actions">{task.recallAttemptId?<Link className="btn btn-primary" to={`/recall/${task.recallAttemptId}`} onClick={()=>void taskStatus(task.id,"in_progress")}>{current?"Start this step":"Start recall"}</Link>:task.conceptId?<button className="btn btn-primary" type="button" onClick={()=>void startTask(task)}>{current?"Start this step":"Practice now"}</button>:null}<button className="btn" type="button" onClick={()=>void taskStatus(task.id,"completed")}>Done for now</button><button className="btn btn-quiet" type="button" onClick={()=>void taskStatus(task.id,"missed")}>Skip</button></div>}</div>
    </article>;})}</section> : !error ? <EmptyState title="Nothing planned for today" to={goalId?undefined:"/goals"} action={goalId?undefined:"Choose a goal"} icon={<CircleHelp size={18}/>}>{goalId?"Set the time you have available, then build a plan from your goal." : "Choose a goal to create a learning plan around your outcome."}</EmptyState> : null}
  </div>;
}
