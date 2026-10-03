import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type Concept, type RecallAttempt, type StudySession } from "../types";

export function StudySessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
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
      if (first) navigate(`/recall/${first.id}`);
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
        <h1>{session.title}</h1>
        <p className="muted">
          Status: {session.status.replace("_", " ")}. {concepts.length} concept
          {concepts.length === 1 ? "" : "s"} extracted.
        </p>
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
            <div className="actions">
              {(["rapid_fire","deep_recall","mastery_check"] as const).map((mode) => <button className="btn" key={mode} type="button" onClick={async () => { try { const run = await api.createAssessment(concept.id,mode); navigate(`/assessments/${run.assessment.id}`); } catch (err) { setError(err instanceof ApiError ? err.message : "Could not start assessment"); } }}>{mode.replace("_"," ")}</button>)}
            </div>
          </article>
        ))}
      </div>
      {session.status !== "completed" ? (
        <div className="actions">
          <button className="btn btn-primary" disabled={busy} onClick={complete} type="button">
            {busy ? "Creating recall…" : "Mark complete and start recall"}
          </button>
        </div>
      ) : pendingRecalls[0] ? (
        <div className="actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate(`/recall/${pendingRecalls[0].id}`)}
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
