import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type Concept, type RecallAttempt, type StudySession } from "../types";
import { studySessionDisplayTitle } from "../utils/presentation";

export function StudySessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawReturnTo=searchParams.get("returnTo") ?? "";
  const returnTo=rawReturnTo==="/plan/today"||rawReturnTo==="/review"||rawReturnTo==="/knowledge-check"||/^\/knowledge\/roles\/[0-9a-f-]+(?:#topic-[0-9a-f-]+)?$/i.test(rawReturnTo)?rawReturnTo:"";
  const learningIntent=searchParams.get("intent")==="apply"?"apply":searchParams.get("intent")==="remember"?"remember":"new";
  const [session, setSession] = useState<StudySession | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [pendingRecalls, setPendingRecalls] = useState<RecallAttempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .getStudySession(id)
      .then((data) => {
        setSession(data.session);
        setConcepts(data.concepts);
        setPendingRecalls(data.pendingRecalls ?? []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Session not found"));
  }, [id]);

  async function complete() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.completeStudySession(id);
      setSession(result.session);
      const first = result.recalls[0];
      if (first) navigate(`/recall/${first.id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete session");
    } finally {
      setBusy(false);
    }
  }

  if (error && !session) return <p className="error">{error}</p>;
  if (!session) return <p className="muted">Loading session…</p>;

  return (
    <div>
      <div className="hero">
        {returnTo ? <Link className="back-link" to={returnTo}>{returnTo==="/plan/today"?"Return to today’s plan":returnTo==="/review"?"Return to review and improve":returnTo==="/knowledge-check"?"Return to knowledge check":"Return to roadmap"}</Link> : null}
        <h1>{studySessionDisplayTitle(session.title, concepts)}</h1>
        <p className="muted">
          Status: {session.status.replace("_", " ")}. {concepts.length} concept
          {concepts.length === 1 ? "" : "s"} extracted.
        </p>
        <p className="muted">{learningIntent === "apply" ? "You chose to practise this material. Choose a supported practice mode for an extracted concept, or finish the review to start recall." : learningIntent === "remember" ? "You chose to strengthen your recall. Review the extracted concepts, then start a recall question." : "Review the extracted concepts, then start recall when you’re ready."}</p>
        {session.sourceUrl ? <p><a href={session.sourceUrl} target="_blank" rel="noreferrer">Open saved source link</a></p> : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="grid">
        {concepts.map((concept) => (
          <article className="card" key={concept.id}>
            <h2>{concept.name}</h2>
            <p>{concept.description}</p>
            <p className="muted">Required knowledge points (hidden during recall):</p>
            <ul>
              {concept.requiredKnowledgePoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <details className="practice-options" open={learningIntent === "apply"}><summary>Choose a practice mode for this concept</summary><div className="actions">
              {(["rapid_fire","deep_recall","mastery_check"] as const).map((mode) => <button className="btn" key={mode} type="button" onClick={async () => { try { const run = await api.createAssessment(concept.id,mode); navigate(`/assessments/${run.assessment.id}${returnTo?`?returnTo=${encodeURIComponent(returnTo)}`:""}`); } catch (err) { setError(err instanceof ApiError ? err.message : "Could not start assessment"); } }}>{mode === "rapid_fire" ? "Start Rapid Fire" : mode === "deep_recall" ? "Start deep recall" : "Start mastery check"}</button>)}
            </div></details>
          </article>
        ))}
      </div>
      {session.status !== "completed" ? (
        <div className="actions">
          <button className="btn btn-primary" disabled={busy} onClick={complete} type="button">
            {busy ? "Preparing recall…" : learningIntent === "remember" ? "Start recall practice" : "Finish review and start recall"}
          </button>
        </div>
      ) : pendingRecalls[0] ? (
        <div className="actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate(`/recall/${pendingRecalls[0].id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`)}
          >
            Continue pending recall
          </button>
        </div>
      ) : (
        <p className="muted">Session completed. Immediate recalls for this session are submitted.</p>
      )}
    </div>
  );
}
