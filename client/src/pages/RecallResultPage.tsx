import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type RecallAttempt, type ReviewState } from "../types";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function RecallResultPage() {
  const { attemptId } = useParams();
  const navigate=useNavigate();
  const [recall, setRecall] = useState<RecallAttempt | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [dimensionScores, setDimensionScores] = useState<Record<string, number | null>>({});
  const [reviewMode,setReviewMode]=useState<"automatic"|"confirm"|"manual">("automatic");
  const [reviewDate,setReviewDate]=useState("");
  const [reviewSaved,setReviewSaved]=useState(false);
  const [nextStepError,setNextStepError]=useState<string|null>(null);
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
        const settings=await api.getSettings();
        if(cancelled)return;
        setReviewMode(settings.reviewMode);
        if(concept.review?.dueAt){const date=new Date(concept.review.dueAt);date.setMinutes(date.getMinutes()-date.getTimezoneOffset());setReviewDate(date.toISOString().slice(0,16));}
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

  async function saveReviewDate(){try{const result=await api.confirmReviewDate(recall!.conceptId,new Date(reviewDate).toISOString());setReview(result.review);setReviewSaved(true);setNextStepError(null);}catch(err){setNextStepError(err instanceof ApiError?err.message:"Could not update review date");}}
  async function startRecommendation(){if(!recall?.recommendation||!['practice','remediation','mastery_check','recall'].includes(recall.recommendation.actionType))return;try{const mode=recall.recommendation.actionType==='practice'?'practice':recall.recommendation.actionType==='mastery_check'?'mastery_check':recall.recommendation.actionType==='remediation'?'deep_recall':'rapid_fire';const run=await api.createAssessment(recall.conceptId,mode);window.location.assign(`/assessments/${run.assessment.id}`);}catch(err){setNextStepError(err instanceof ApiError?err.message:"Could not start the recommended activity");}}

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
        {reviewMode==="confirm"&&review?<div><label htmlFor="confirm-review-date">Confirm or adjust next review</label><input id="confirm-review-date" type="datetime-local" value={reviewDate} onChange={(event)=>{setReviewDate(event.target.value);setReviewSaved(false);}}/><button className="btn" type="button" onClick={()=>void saveReviewDate()}>Confirm review date</button>{reviewSaved?<p>Review date saved.</p>:null}{nextStepError?<p className="error">{nextStepError}</p>:null}</div>:null}
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
        {recall.recommendation?<section><h3>Recommended next step</h3><p><strong>{recall.recommendation.title}</strong></p><p>{recall.recommendation.reason}</p><p>Estimated: {recall.recommendation.estimatedMinutes} minutes</p>{recall.recommendation.actionType==="learn"?<button className="btn" type="button" onClick={()=>navigate(`/resources?conceptId=${recall.conceptId}`)}>Explore focused resources</button>:recall.recommendation.actionType!=="none"?<button className="btn" type="button" onClick={()=>void startRecommendation()}>Practice now</button>:null}{nextStepError?<p className="error">{nextStepError}</p>:null}</section>:null}
        <p className="muted">Suggested question form: {evaluation.suggestedRecallType}</p>
        <div className="actions">
          <Link className="btn btn-primary" to="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </article>
    </div>
  );
}
