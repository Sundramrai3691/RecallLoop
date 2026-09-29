import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type ResourceRecommendation } from "../types";

export function BaselineResultPage() {
  const { id } = useParams();
  const [baseline, setBaseline] = useState<any>(null);
  const [starting, setStarting] = useState<any>(null);
  const [resources, setResources] = useState<ResourceRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    api
      .getBaseline(id)
      .then(async (result) => {
        setBaseline(result.baseline);
        const point = await api.getStartingPoint(
          result.baseline.assessment.goalId,
        );
        setStarting(point);
        setResources(point.resources);
      })
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not load baseline result",
        ),
      );
  }, [id]);
  if (error) return <p className="error">{error}</p>;
  if (!baseline) return <p className="muted">Loading result...</p>;
  return (
    <div>
      <section className="hero">
        <h1>Starting point</h1>
        <p className="muted">
          Self-declared knowledge is kept separate from observed evidence.
        </p>
      </section>
      <div className="grid grid-2">
        <article className="card">
          <h2>Assessment</h2>
          <p>Source: {baseline.assessment.baselineSource}</p>
          <p>
            Observed mastery:{" "}
            {Math.round(Number(baseline.assessment.observedMastery) * 100)}%
          </p>
          <p>
            Confidence:{" "}
            {Math.round(Number(baseline.assessment.baselineConfidence) * 100)}%
          </p>
        </article>
        <article className="card">
          <h2>Recommended start</h2>
          <p>{starting?.startingConcept?.name ?? "Start with fundamentals"}</p>
          <p className="muted">
            {starting?.conceptsToReview?.length ?? 0} concepts to review ·{" "}
            {starting?.conceptsToSkip?.length ?? 0} concepts to skip
          </p>
          <Link
            className="btn btn-primary"
            to={`/plan?goalId=${baseline.assessment.goalId}`}
          >
            Continue to plan
          </Link>
        </article>
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>Focused resources</h2>
        {resources.map((resource) => (
          <article className="row" key={resource.id}>
            <a href={resource.url} target="_blank" rel="noreferrer">
              <strong>{resource.title}</strong>
            </a>
            <span className="muted">
              {resource.estimatedMinutes} min · {resource.reason}
            </span>
          </article>
        ))}
      </section>
    </div>
  );
}
