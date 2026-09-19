import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type RecallAttempt, type ReviewState } from "../types";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function RecallResultPage() {
  const { attemptId } = useParams();
  const [recall, setRecall] = useState<RecallAttempt | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getRecall(attemptId);
        if (cancelled) return;
        setRecall(data.recall);
        const concept = await api.getConcept(data.concept.id);
        if (cancelled) return;
        setReview(concept.review);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Result not found");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  if (error) return <p className="error">{error}</p>;
  if (!recall) return <p className="muted">Loading evaluation…</p>;
  if (!recall.evaluation) {
    return (
      <div className="card">
        <p>This recall has not been submitted yet.</p>
        <Link to={`/recall/${recall.id}`}>Answer it now</Link>
      </div>
    );
  }

  const evaluation = recall.evaluation;
  const coverage = Math.round(evaluation.overallCoverage * 100);

  return (
    <div className="grid">
      <article className="card">
        <h1>Retrieval result</h1>
        <p className="stat">{coverage}%</p>
        <p className="muted">
          Coverage across required knowledge points — not an arbitrary 1–10 score.
        </p>
        <p>{evaluation.feedback}</p>
        {review ? (
          <p>
            Next review: <strong>{formatWhen(review.dueAt)}</strong> ({review.lastOutcome},{" "}
            {review.intervalDays} day interval)
          </p>
        ) : null}
        <p className="muted">Evaluator {evaluation.evaluatorVersion}</p>
      </article>
      <article className="card">
        <h2>Knowledge points</h2>
        <div className="kp">
          {evaluation.knowledgePointResults.map((kp) => (
            <div className={`kp-item ${kp.status}`} key={kp.point}>
              <strong>{kp.point}</strong>
              <div className="badge">{kp.status}</div>
              <p className="muted">{kp.feedback}</p>
            </div>
          ))}
        </div>
      </article>
      <article className="card">
        <h2>Signals stored</h2>
        <p>Missing: {evaluation.missingConcepts.join("; ") || "none"}</p>
        <p>Mistakes: {evaluation.mistakes.join("; ") || "none"}</p>
        <p>Strengths: {evaluation.strengths.join("; ") || "none"}</p>
        <p>Suggested next task: {evaluation.suggestedRecallType}</p>
        <div className="actions">
          <Link className="btn btn-primary" to="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </article>
    </div>
  );
}
