import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type Goal, type Skill } from "../types";

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [skills, setSkills] = useState<Record<string, Skill[]>>({});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const result = await api.listGoals();
      setGoals(result.goals);
      const entries = await Promise.all(
        result.goals.map(
          async (goal) =>
            [goal.id, (await api.listSkills(goal.id)).skills] as const,
        ),
      );
      setSkills(Object.fromEntries(entries));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Sign in to manage goals",
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createGoal(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createGoal({
        title,
        description,
        goalType: "learning",
        weeklyTimeBudgetMinutes: 240,
      });
      setTitle("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create goal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <section className="hero">
        <h1>Your learning goals</h1>
        <p className="muted">
          Turn a meaningful outcome into skills and a practical weekly plan.
        </p>
      </section>
      {error ? (
        <p className="error">
          {error} <Link to="/login">Sign in</Link>
        </p>
      ) : null}
      <form className="card" onSubmit={createGoal}>
        <h2>Start a goal</h2>
        <label htmlFor="goal-title">Title</label>
        <input
          id="goal-title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Become a backend engineer"
        />
        <label htmlFor="goal-description">What does progress look like?</label>
        <textarea
          id="goal-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <button className="btn btn-primary" disabled={busy} type="submit">
          Create goal
        </button>
      </form>
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        {goals.map((goal) => (
          <article className="card" key={goal.id}>
            <h2>{goal.title}</h2>
            <p>{goal.description || "No description yet."}</p>
            <p className="muted">
              {goal.weeklyTimeBudgetMinutes} minutes per week · {goal.status}
            </p>
            <h3>Skills</h3>
            {skills[goal.id]?.length ? (
              <ul>
                {skills[goal.id].map((skill) => (
                  <li key={skill.id}>
                    {skill.name}{" "}
                    <span className="muted">
                      ({Math.round(skill.currentMastery * 100)}% mastery)
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                Add skills through the API to make this goal plan-specific.
              </p>
            )}
            <Link className="btn btn-primary" to={`/plan?goalId=${goal.id}`}>
              View plan
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
