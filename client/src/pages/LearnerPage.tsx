import { useEffect, useState } from "react";
import { api } from "../api/client";
import { ApiError, type LearnerSummary } from "../types";

export function LearnerPage() {
  const [summary, setSummary] = useState<LearnerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .learnerSummary()
      .then(setSummary)
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not load learner model",
        ),
      );
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!summary) return <p className="muted">Loading learner model...</p>;

  return (
    <div>
      <section className="hero">
        <h1>Learner model</h1>
        <p className="muted">
          A transparent snapshot of the signals currently shaping your plan.
        </p>
      </section>
      <div className="grid grid-2">
        <article className="card">
          <h2>Progress</h2>
          <p className="stat">{Math.round(summary.averageMastery * 100)}%</p>
          <p className="muted">
            Average mastery across {summary.totalConcepts} concepts
          </p>
          <p>
            {summary.dueConcepts} concepts due · {summary.weakConceptCount} weak
            concepts
          </p>
        </article>
        <article className="card">
          <h2>Weak skills</h2>
          {summary.weakSkills.length ? (
            <ul>
              {summary.weakSkills.map((skill) => (
                <li key={skill.skillId}>
                  {skill.name}{" "}
                  <span className="muted">
                    {Math.round(skill.currentMastery * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No skill weaknesses recorded yet.</p>
          )}
        </article>
        <article className="card">
          <h2>Weak concepts</h2>
          {summary.weakConcepts.length ? (
            <ul>
              {summary.weakConcepts.map((concept) => (
                <li key={concept.conceptId}>
                  {concept.conceptName}{" "}
                  <span className="muted">
                    {Math.round(concept.mastery * 100)}% ·{" "}
                    {concept.mistakeCount} mistakes
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No weak concepts recorded yet.</p>
          )}
        </article>
        <article className="card">
          <h2>Recent mistakes</h2>
          {summary.recentMistakes.length ? (
            summary.recentMistakes.map((item) => (
              <p key={`${item.conceptId}-${item.submittedAt}`}>
                {item.mistakes.join("; ")}
              </p>
            ))
          ) : (
            <p className="muted">
              Mistakes from evaluated recall will appear here.
            </p>
          )}
        </article>
      </div>
    </div>
  );
}
