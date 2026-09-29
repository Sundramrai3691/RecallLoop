import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type BaselineQuestion } from "../types";

export function BaselinePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [question, setQuestion] = useState<BaselineQuestion | null>(null);
  const [assessment, setAssessment] = useState<any>(null);
  const [answer, setAnswer] = useState("");
  const [confidence, setConfidence] = useState(5);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (id)
      api
        .getBaseline(id)
        .then((result) => {
          setAssessment(result.baseline.assessment);
          setQuestion(
            result.baseline.questions.find((item) => !item.submittedAt) ?? null,
          );
        })
        .catch((err) =>
          setError(
            err instanceof ApiError ? err.message : "Baseline unavailable",
          ),
        );
  }, [id]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!id || !question) return;
    try {
      const result = await api.submitBaselineQuestion(id, {
        questionId: question.id,
        answer,
        confidence,
      });
      const next = result.baseline.questions.find((item) => !item.submittedAt);
      if (next) {
        setQuestion(next);
        setAnswer("");
      } else navigate(`/baseline/${id}/result`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not evaluate baseline answer",
      );
    }
  }
  if (error) return <p className="error">{error}</p>;
  if (!assessment) return <p className="muted">Loading baseline...</p>;
  if (!question)
    return (
      <div className="card">
        <h1>Baseline complete</h1>
        <Link to={`/baseline/${id}/result`}>View result</Link>
      </div>
    );
  return (
    <form className="card" onSubmit={submit}>
      <p className="badge due">{question.level}</p>
      <h1>Baseline assessment</h1>
      <p>{question.question}</p>
      {error ? <p className="error">{error}</p> : null}
      <label htmlFor="answer">Your answer</label>
      <textarea
        id="answer"
        required
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
      />
      <label htmlFor="confidence">Confidence ({confidence}/10)</label>
      <input
        id="confidence"
        type="range"
        min={1}
        max={10}
        value={confidence}
        onChange={(event) => setConfidence(Number(event.target.value))}
      />
      <button className="btn btn-primary" type="submit">
        Submit answer
      </button>
    </form>
  );
}
