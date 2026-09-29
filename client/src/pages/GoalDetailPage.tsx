import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type Goal, type Skill } from "../types";

export function GoalDetailPage() {
  const { id } = useParams();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(50);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    try {
      const [goalResult, skillResult] = await Promise.all([
        api.getGoal(id),
        api.listSkills(id),
      ]);
      setGoal(goalResult.goal);
      setSkills(skillResult.skills);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load goal");
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function addSkill(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    try {
      await api.createSkill(id, { name, description, priority });
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add skill");
    }
  }

  if (error && !goal) return <p className="error">{error}</p>;
  if (!goal) return <p className="muted">Loading goal...</p>;

  return (
    <div>
      <section className="hero">
        <h1>{goal.title}</h1>
        <p className="muted">
          {goal.description ||
            "Define the capabilities that will move this goal forward."}
        </p>
        <p>
          {goal.weeklyTimeBudgetMinutes} minutes per week · {goal.status}
        </p>
      </section>
      {error ? <p className="error">{error}</p> : null}
      <form className="card" onSubmit={addSkill}>
        <h2>Add a skill</h2>
        <label htmlFor="skill-name">Skill or topic</label>
        <input
          id="skill-name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Message queues"
        />
        <label htmlFor="skill-description">Description</label>
        <textarea
          id="skill-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <label htmlFor="priority">Priority</label>
        <input
          id="priority"
          type="number"
          min={0}
          max={100}
          value={priority}
          onChange={(event) => setPriority(Number(event.target.value))}
        />
        <button className="btn btn-primary" type="submit">
          Add skill
        </button>
      </form>
      <section className="grid grid-2" style={{ marginTop: 16 }}>
        {skills.map((skill) => (
          <article className="card" key={skill.id}>
            <h2>{skill.name}</h2>
            <p>{skill.description || "No description yet."}</p>
            <p className="muted">
              Priority {skill.priority} ·{" "}
              {Math.round(skill.currentMastery * 100)}% mastery
            </p>
          </article>
        ))}
      </section>
      <p className="actions">
        <Link className="btn btn-primary" to={`/plan?goalId=${goal.id}`}>
          Generate today&apos;s plan
        </Link>
      </p>
    </div>
  );
}
