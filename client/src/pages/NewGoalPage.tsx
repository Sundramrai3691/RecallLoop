import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ApiError } from "../types";

export function NewGoalPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goalType, setGoalType] = useState("learning");
  const [targetDate, setTargetDate] = useState("");
  const [weeklyTimeBudgetMinutes, setWeeklyTimeBudgetMinutes] = useState(240);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api.createGoal({
        title,
        description,
        goalType,
        targetDate: targetDate || undefined,
        weeklyTimeBudgetMinutes,
      });
      navigate(`/goals/${result.goal.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create goal");
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>New learning goal</h1>
      {error ? <p className="error">{error}</p> : null}
      <label htmlFor="title">Goal</label>
      <input
        id="title"
        required
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Become a backend engineer"
      />
      <label htmlFor="description">Description</label>
      <textarea
        id="description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <label htmlFor="type">Goal type</label>
      <select
        id="type"
        value={goalType}
        onChange={(event) => setGoalType(event.target.value)}
      >
        <option value="learning">Learning</option>
        <option value="exam">Exam</option>
        <option value="career">Career</option>
        <option value="project">Project</option>
      </select>
      <label htmlFor="targetDate">Deadline</label>
      <input
        id="targetDate"
        type="date"
        value={targetDate}
        onChange={(event) => setTargetDate(event.target.value)}
      />
      <label htmlFor="weekly">Weekly time (minutes)</label>
      <input
        id="weekly"
        type="number"
        min={60}
        value={weeklyTimeBudgetMinutes}
        onChange={(event) =>
          setWeeklyTimeBudgetMinutes(Number(event.target.value))
        }
      />
      <button className="btn btn-primary" type="submit">
        Create goal
      </button>
    </form>
  );
}
