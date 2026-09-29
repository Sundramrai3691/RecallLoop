import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useDashboard } from "../hooks/useDashboard";
import type { Goal, LearnerSummary, PlanTask } from "../types";

function formatDue(iso: string): string {
  const due = new Date(iso);
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startDue = new Date(due);
  startDue.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (startDue.getTime() - startToday.getTime()) / 86400000,
  );
  if (diff <= 0) return "Due today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

export function DashboardPage() {
  const { data, mock, error } = useDashboard();
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [todayTasks, setTodayTasks] = useState<PlanTask[]>([]);
  const [learner, setLearner] = useState<LearnerSummary | null>(null);

  useEffect(() => {
    Promise.all([api.listGoals(), api.todayPlan(), api.learnerSummary()])
      .then(([goals, plan, summary]) => {
        setActiveGoal(
          goals.goals.find((goal) => goal.status === "active") ?? null,
        );
        setTodayTasks(plan.tasks);
        setLearner(summary);
      })
      .catch(() => undefined);
  }, []);

  if (error) {
    return (
      <div className="card error">
        <p>{error}</p>
        <p className="muted">
          Start PostgreSQL (`docker compose up -d postgres`), run migrations,
          and `npm run dev`.
        </p>
      </div>
    );
  }

  if (!data) return <p className="muted">Loading dashboard…</p>;

  return (
    <div>
      <section className="hero">
        <h1>Retrieval over time spent</h1>
        <p className="muted">
          Study a topic, then recall it immediately. Mastery is demonstrated
          retrieval, not minutes on a page.
          {mock
            ? " Evaluator is in mock mode (no LLM key)."
            : " Live evaluator is connected."}
        </p>
      </section>
      <div className="grid grid-2">
        <article className="card">
          <h2>Active goal</h2>
          {activeGoal ? (
            <>
              <h3>{activeGoal.title}</h3>
              <p className="muted">
                {activeGoal.weeklyTimeBudgetMinutes} minutes per week
              </p>
              <Link to={`/goals/${activeGoal.id}`}>Open goal</Link>
            </>
          ) : (
            <p className="muted">
              <Link to="/goals/new">Create a goal</Link> to shape your plan.
            </p>
          )}
        </article>
        <article className="card">
          <h2>Today&apos;s plan</h2>
          {todayTasks.length ? (
            <>
              <p className="stat">
                {todayTasks.reduce(
                  (total, task) => total + task.estimatedMinutes,
                  0,
                )}{" "}
                min
              </p>
              <p className="muted">
                {
                  todayTasks.filter((task) => task.status === "completed")
                    .length
                }{" "}
                completed ·{" "}
                {
                  todayTasks.filter((task) => task.status !== "completed")
                    .length
                }{" "}
                remaining
              </p>
              <Link to="/plan/today">Open plan</Link>
            </>
          ) : (
            <p className="muted">No plan generated yet.</p>
          )}
        </article>
        <article className="card">
          <h2>Today's Recall</h2>
          {data.todayDue.length === 0 ? (
            <p className="muted">
              Nothing due. Study a topic to generate an immediate recall.
            </p>
          ) : (
            <div className="list">
              {data.todayDue.map((item) => (
                <Link
                  className="row"
                  key={item.recallId}
                  to={`/recall/${item.recallId}`}
                >
                  <strong>{item.conceptName}</strong>
                  <span className="badge due">Due today</span>
                </Link>
              ))}
            </div>
          )}
        </article>
        <article className="card">
          <h2>Upcoming</h2>
          {data.upcoming.length === 0 ? (
            <p className="muted">No future reviews scheduled yet.</p>
          ) : (
            <div className="list">
              {data.upcoming.map((item) => (
                <div className="row" key={item.conceptId}>
                  <strong>{item.conceptName}</strong>
                  <span className="badge">{formatDue(item.dueAt)}</span>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="card">
          <h2>Recently studied</h2>
          {data.recentlyStudied.length === 0 ? (
            <p className="muted">No sessions yet.</p>
          ) : (
            data.recentlyStudied.map((session) => (
              <Link
                className="row"
                key={session.id}
                to={`/study/${session.id}`}
              >
                <span>{session.title}</span>
                <span className="badge">
                  {session.status.replace("_", " ")}
                </span>
              </Link>
            ))
          )}
        </article>
        <article className="card">
          <h2>Recall attempts</h2>
          <p className="stat">{data.recallAttemptCount}</p>
          <p className="muted">
            {data.submittedRecallCount} submitted · {data.pendingRecallCount}{" "}
            pending
          </p>
        </article>
      </div>
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <article className="card">
          <h2>Weak concepts</h2>
          {learner?.weakConcepts.length ? (
            learner.weakConcepts.slice(0, 4).map((concept) => (
              <div className="row" key={concept.conceptId}>
                <span>{concept.conceptName}</span>
                <span className="badge">
                  {Math.round(concept.mastery * 100)}%
                </span>
              </div>
            ))
          ) : (
            <p className="muted">
              Weakness signals appear after evaluated recall.
            </p>
          )}
        </article>
        <article className="card">
          <h2>Recent progress</h2>
          <p className="stat">
            {learner ? Math.round(learner.averageMastery * 100) : 0}%
          </p>
          <p className="muted">
            Average mastery · {learner?.dueConcepts ?? 0} concepts due
          </p>
          <Link to="/learner">View learner model</Link>
        </article>
      </div>
      <article className="card" style={{ marginTop: 16 }}>
        <h2>Mastery by concept</h2>
        {data.masteryByConcept.length === 0 ? (
          <p className="muted">
            Mastery appears after the first evaluated recall.
          </p>
        ) : (
          data.masteryByConcept.map((c) => (
            <Link className="row" key={c.id} to={`/study/${c.studySessionId}`}>
              <span>{c.name}</span>
              <span className="badge good">{Math.round(c.mastery * 100)}%</span>
            </Link>
          ))
        )}
      </article>
    </div>
  );
}
