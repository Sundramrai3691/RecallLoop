import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type RecallAttempt } from "../types";

export function RecallPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [recall, setRecall] = useState<RecallAttempt | null>(null);
  const [conceptName, setConceptName] = useState("");
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!attemptId) return;
    api
      .getRecall(attemptId)
      .then((data) => {
        setRecall(data.recall);
        setConceptName(data.concept.name);
        if (data.recall.submittedAt) {
          navigate(`/recall/${attemptId}/result`, { replace: true });
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Recall not found"));
  }, [attemptId, navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!attemptId) return;
    setBusy(true);
    setError(null);
    try {
      await api.submitRecall(attemptId, { answer, confidence });
      navigate(`/recall/${attemptId}/result`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit recall");
    } finally {
      setBusy(false);
    }
  }

  if (error && !recall) return <p className="error">{error}</p>;
  if (!recall) return <p className="muted">Loading recall…</p>;

  return (
    <form className="card" onSubmit={onSubmit}>
      <p className="badge due">{recall.questionType}</p>
      <h1>{conceptName}</h1>
      <p>{recall.question}</p>
      <p className="muted">Do not look at notes. Knowledge points stay hidden until after submit.</p>
      {error ? <p className="error">{error}</p> : null}
      <label htmlFor="answer">Your answer</label>
      <textarea
        id="answer"
        required
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Explain from memory, start to finish."
      />
      <label htmlFor="confidence">Confidence ({confidence}/10)</label>
      <div className="range">
        <span className="muted">Guessing</span>
        <input
          id="confidence"
          type="range"
          min={1}
          max={10}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
        />
        <span className="muted">Certain</span>
      </div>
      <div className="actions">
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Evaluating…" : "Submit recall"}
        </button>
      </div>
    </form>
  );
}
