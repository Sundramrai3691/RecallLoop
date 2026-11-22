import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, CircleDashed, Clock3, RotateCcw, Sparkles } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type RecallSprint } from "../types";
import { PageHeader } from "../components/Ui";

export function RecallSprintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sprint, setSprint] = useState<RecallSprint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setError(null);
      const result = id ? await api.getSprint(id) : await api.getActiveSprint();
      setSprint(result.sprint);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn’t load this Recall Sprint.");
    }
  }

  useEffect(() => { void load(); }, [id]);

  const current = useMemo(
    () => sprint?.items.find((item) => !item.submitted) ?? null,
    [sprint],
  );

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const key = window.crypto.randomUUID();
      const existing = await api.getActiveSprint();
      if (existing.sprint) {
        setSprint(existing.sprint);
        navigate(`/sprint/${existing.sprint.id}`, { replace: true });
        return;
      }
      const result = await api.startSprint(key);
      setSprint(result.sprint);
      navigate(`/sprint/${result.sprint.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError
        ? err.code === "SPRINT_NO_ELIGIBLE_WORK"
          ? "There is no supported eligible work for a Sprint yet. Test a topic or add learning material, then come back."
          : err.message
        : "We couldn’t start a Recall Sprint.");
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!sprint) return;
    setBusy(true);
    setError(null);
    try { setSprint((await api.completeSprint(sprint.id)).sprint); }
    catch (err) { setError(err instanceof ApiError ? err.message : "We couldn’t complete this Sprint."); }
    finally { setBusy(false); }
  }

  async function abandon() {
    if (!sprint) return;
    setBusy(true);
    setError(null);
    try {
      setSprint((await api.abandonSprint(sprint.id)).sprint);
    } catch (err) { setError(err instanceof ApiError ? err.message : "We couldn’t leave this Sprint."); }
    finally { setBusy(false); }
  }

  async function repair() {
    if (!sprint) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.openSprintRepair(sprint.id);
      setSprint(result.sprint);
      navigate(`/remediations/${result.remediation.id}?returnTo=${encodeURIComponent(`/sprint/${sprint.id}`)}&sprintId=${encodeURIComponent(sprint.id)}`);
    } catch (err) { setError(err instanceof ApiError ? err.message : "We couldn’t open focused repair."); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!sprint) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.startSprintVerification(sprint.id);
      setSprint(result.sprint);
      navigate(`/recall/${result.attempt.id}?returnTo=${encodeURIComponent(`/sprint/${sprint.id}`)}`);
    } catch (err) { setError(err instanceof ApiError ? err.message : "We couldn’t start verification."); }
    finally { setBusy(false); }
  }

  if (!id && !sprint) {
    return <div className="sprint-page">
      <PageHeader eyebrow="Today" title="Recall Sprint" description="A short, bounded set of due, weak and recently studied work." />
      {error ? <p className="error" role="alert">{error}</p> : null}
      <section className="card sprint-entry">
        <div className="sprint-entry-mark"><RotateCcw size={24}/></div>
        <p className="eyebrow">START WHEN YOU ARE READY</p>
        <h2>Your next Recall Sprint</h2>
        <p className="muted">Up to three questions, selected in priority order from due work, submitted weaknesses and recent study.</p>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void start()}>{busy ? "Preparing…" : "Start Recall Sprint"} <ArrowRight size={15}/></button>
        <Link className="btn" to="/knowledge-check">Choose a topic to diagnose</Link>
      </section>
    </div>;
  }

  if (!sprint) return <div className="card" role="status">Loading your Recall Sprint…</div>;

  const allSubmitted = sprint.progress.total > 0 && sprint.progress.submitted === sprint.progress.total;

  return <div className="sprint-page">
    <PageHeader
      eyebrow={sprint.status === "completed" ? "SPRINT COMPLETE" : sprint.status === "abandoned" ? "SPRINT PAUSED" : "TODAY"}
      title={sprint.status === "completed" ? "Your Sprint is complete" : sprint.status === "abandoned" ? "Sprint paused" : "Recall Sprint"}
      description={sprint.status === "in_progress"
        ? `${sprint.progress.submitted} of ${sprint.progress.total} questions submitted`
        : "Completing this session records activity; it does not mean every concept is mastered."}
    />
    {error ? <p className="error" role="alert">{error}</p> : null}

    {sprint.status === "in_progress" ? <section className="card sprint-progress" aria-label="Sprint progress">
      <div className="sprint-progress-copy">
        <p className="eyebrow">SPRINT PROGRESS</p>
        <h2>{current ? current.conceptName : "All questions submitted"}</h2>
        {current ? <p className="muted">{current.reason}</p> : <p className="muted">You can complete the Sprint and open one meaningful repair opportunity.</p>}
      </div>
      <div className="sprint-progress-count"><Clock3 size={16}/><strong>{sprint.progress.submitted}/{sprint.progress.total}</strong></div>
    </section> : null}

    <section className="sprint-items" aria-label="Sprint questions">
      {sprint.items.map((item) => <article className={`card sprint-item ${item.submitted ? "submitted" : ""}`} key={item.id}>
        <div className="sprint-item-index">{item.submitted ? <Check size={15}/> : String(item.position).padStart(2, "0")}</div>
        <div className="sprint-item-copy">
          <p className="eyebrow">{item.source === "due" ? "DUE REVIEW" : item.source === "weak" ? "WEAK CONCEPT" : "RECENT STUDY"}</p>
          <h2>{item.conceptName}</h2>
          <p className="muted">{item.reason}</p>
          {item.submitted && item.recall.resultStatus ? <p className="metadata">Outcome: {item.recall.resultStatus.replaceAll("_", " ")}</p> : null}
        </div>
        {!item.submitted && sprint.status === "in_progress"
          ? <Link className="btn btn-primary" to={`/recall/${item.recallAttemptId}?returnTo=${encodeURIComponent(`/sprint/${sprint.id}`)}`}>Answer <ArrowRight size={15}/></Link>
          : item.submitted
            ? <Link className="btn" to={`/recall/${item.recallAttemptId}/result?returnTo=${encodeURIComponent(`/sprint/${sprint.id}`)}`}>View evidence</Link>
            : null}
      </article>)}
    </section>

    {sprint.status === "in_progress" && sprint.progress.total === 0 ? <section className="card">
      <h2>No questions are available</h2>
      <p className="muted">There is no supported eligible work for this Sprint. Use Test a topic or add material to build evidence honestly.</p>
      <Link className="btn" to="/knowledge-check">Choose a topic</Link>
    </section> : null}

    {sprint.status === "in_progress" && allSubmitted ? <section className="card sprint-repair">
      <div className="sprint-repair-icon"><Sparkles size={20}/></div>
      <div><p className="eyebrow">ONE MOST-VALUABLE NEXT STEP</p><h2>Repair and verify the strongest gap</h2><p className="muted">Use one submitted gap, original source context and a distinct eligible verification when available.</p></div>
      <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void repair()}>{busy ? "Preparing…" : "Open focused repair"} <ArrowRight size={15}/></button>
    </section> : null}

    {sprint.status === "completed" ? <section className="card sprint-completed">
      <CircleDashed size={22}/>
      <div><p className="eyebrow">ACTIVITY COMPLETE</p><h2>{sprint.progress.submitted} submitted · {sprint.progress.total - sprint.progress.submitted} unanswered</h2><p className="muted">This Sprint is complete. It does not by itself establish durable mastery.</p></div>
    </section> : null}

    {sprint.status === "completed" && sprint.repairRemediationId
      ? <section className="card sprint-repair"><Sparkles size={20}/><div><p className="eyebrow">FOCUSED REPAIR</p><h2>{sprint.verificationAttemptId ? "Verification is connected to this Sprint" : "A repair opportunity is available"}</h2></div>
        {!sprint.verificationAttemptId ? <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void verify()}>Start distinct verification <ArrowRight size={15}/></button>
          : <Link className="btn btn-primary" to={`/recall/${sprint.verificationAttemptId}?returnTo=${encodeURIComponent(`/sprint/${sprint.id}`)}`}>Continue verification <ArrowRight size={15}/></Link>}
      </section>
      : null}

    {sprint.status === "in_progress" ? <div className="actions sprint-actions">
      {allSubmitted ? <button className="btn" type="button" disabled={busy} onClick={() => void complete()}>{busy ? "Completing…" : "Complete Sprint"}</button> : null}
      <button className="btn btn-quiet" type="button" disabled={busy} onClick={() => void abandon()}>{busy ? "Saving…" : "Leave for later"}</button>
    </div> : <div className="actions"><Link className="btn btn-primary" to="/today">Back to Today</Link></div>}
  </div>;
}
