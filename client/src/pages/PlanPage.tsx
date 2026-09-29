import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type PlanTask } from "../types";

export function PlanPage() {
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const goalId = searchParams.get("goalId");

  async function load() {
    try {
      const result = await api.todayPlan();
      setTasks(result.tasks);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load today's plan",
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function generate() {
    if (!goalId) return;
    setBusy(true);
    setError(null);
    try {
      await api.generatePlan(goalId);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not generate plan",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <section className="hero">
        <h1>Today&apos;s plan</h1>
        <p className="muted">
          A deterministic mix of learning, retrieval, and remediation work.
        </p>
      </section>
      {error ? <p className="error">{error}</p> : null}
      {goalId ? (
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={generate}
          type="button"
        >
          {busy ? "Generating..." : "Generate from this goal"}
        </button>
      ) : (
        <p className="muted">
          Open a goal and choose View plan to generate goal-specific work.
        </p>
      )}
      <div className="grid" style={{ marginTop: 16 }}>
        {tasks.length ? (
          tasks.map((task) => (
            <article className="card" key={task.id}>
              <div className="actions">
                <span className="badge due">{task.taskType}</span>
                <span className="badge">{task.estimatedMinutes} min</span>
              </div>
              <h2>{task.title}</h2>
              <p>{task.description}</p>
              <p className="muted">
                Priority {task.priority} · {task.reason}
              </p>
            </article>
          ))
        ) : (
          <p className="muted">No plan yet. Generate one from a goal.</p>
        )}
      </div>
    </div>
  );
}
