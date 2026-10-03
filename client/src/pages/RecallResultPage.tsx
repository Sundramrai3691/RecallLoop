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
  const [dimensionScores, setDimensionScores] = useState<Record<string, number | null>>({});
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
        setDimensionScores(concept.dimensionScores);
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
        <p><strong>{recall.hintsUsed === 0 ? "Solved independently" : "Solved with assistance"}</strong>{recall.hintsUsed ? ` · ${recall.hintsUsed} hint${recall.hintsUsed === 1 ? "" : "s"} used` : ""}</p>
        {recall.confidence ? <p>Confidence: {recall.confidence}/10</p> : null}
        {recall.timeTakenSeconds != null ? <p>Time: {Math.floor(recall.timeTakenSeconds / 60)}m {recall.timeTakenSeconds % 60}s</p> : null}
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
        <h3>Evidence by dimension</h3>
        {Object.entries(dimensionScores).filter(([, score]) => score !== null).map(([dimension, score]) => <p key={dimension}>{dimension}: {Math.round((score ?? 0) * 100)}%</p>)}
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
