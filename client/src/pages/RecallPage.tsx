import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type RecallAttempt } from "../types";

export function RecallPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [recall, setRecall] = useState<RecallAttempt | null>(null);
  const [conceptName, setConceptName] = useState("");
  const [answer, setAnswer] = useState("");
  const [partAnswers, setPartAnswers] = useState<Record<string,string>>({});
  const [confidence, setConfidence] = useState(6);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [hintBusy, setHintBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!attemptId) return;
    setRecall(null);setAnswer("");setPartAnswers({});setSelectedOptionId("");setError(null);
    api
      .getRecall(attemptId)
      .then((data) => {
        setRecall(data.recall);
        setConceptName(data.concept.name);
        if (data.recall.submittedAt) {
          navigate(`/recall/${attemptId}/result`, { replace: true });
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Recall not found"));
  }, [attemptId, navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!attemptId) return;
    setBusy(true);
    setError(null);
    try {
      const parts=recall?.questionData?.parts;
      await api.submitRecall(attemptId, { answer:parts?undefined:answer, answers:parts?.map((part)=>({partId:part.id,answer:partAnswers[part.id]??""})), selectedOptionId: selectedOptionId || undefined, confidence });
      navigate(`/recall/${attemptId}/result`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit recall");
    } finally {
      setBusy(false);
    }
  }

  async function revealHint() {
    if (!attemptId || !recall) return;
    setHintBusy(true);
    try {
      await api.revealRecallHint(attemptId);
      const data = await api.getRecall(attemptId);
      setRecall(data.recall);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reveal a hint");
    } finally { setHintBusy(false); }
  }

  if (error && !recall) return <p className="error">{error}</p>;
  if (!recall) return <p className="muted">Loading recall…</p>;

  return (
    <form className="card" onSubmit={onSubmit}>
      <p className="badge due">{recall.questionData?.title ?? recall.questionType} · ~{recall.questionData?.estimatedMinutes ?? 4} min</p>
      <h1>{conceptName}</h1>
      {recall.questionData?.context ? <><h2>Context</h2><p>{recall.questionData.context}</p></> : null}
      <h2>Question</h2><p>{recall.questionData?.prompt ?? recall.question}</p>
      <p className="muted">Do not look at notes. Knowledge points stay hidden until after submit.</p>
      {recall.questionData?.revealedHints.map((hint, index) => <p className="callout" key={index}><strong>Hint {index + 1}:</strong> {hint}</p>)}
      {recall.questionData && recall.questionData.hintsRemaining > 0 ? <button className="btn" disabled={hintBusy} onClick={() => void revealHint()} type="button">{hintBusy ? "Revealing…" : `Need a nudge? Reveal hint ${recall.maxHintLevel + 1}`}</button> : null}
      {error ? <p className="error">{error}</p> : null}
      {recall.questionType === "mcq" && recall.questionData?.options ? <fieldset><legend>Your answer</legend>{recall.questionData.options.map((option) => <label className="option" key={option.id}><input type="radio" name="option" checked={selectedOptionId === option.id} onChange={() => setSelectedOptionId(option.id)} /> {option.text}</label>)}</fieldset> : recall.questionData?.parts?.length ? <div className="structured-answer-parts">{recall.questionData.parts.map((part)=><section className="structured-answer-part" key={part.id}><h2>{part.label}</h2><p>{part.prompt}</p><label htmlFor={`answer-${part.id}`}>Your answer for {part.label}</label><textarea id={`answer-${part.id}`} value={partAnswers[part.id]??""} onChange={(event)=>setPartAnswers((current)=>({...current,[part.id]:event.target.value}))} placeholder="Explain this part from memory." /></section>)}</div> : <><label htmlFor="answer">Your answer</label><textarea
        id="answer"
        required
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Explain from memory, start to finish."
      /></>}
      <label htmlFor="confidence">Confidence ({confidence}/10)</label>
      <div className="range">
        <span className="muted">Guessing</span>
        <input
          id="confidence"
          type="range"
          min={1}
          max={10}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
        />
        <span className="muted">Certain</span>
      </div>
      <div className="actions">
        <button className="btn btn-primary" disabled={busy||(recall.questionData?.parts?.length?!Object.values(partAnswers).some((value)=>value.trim()):false)} type="submit">
          {busy ? "Evaluating…" : "Submit recall"}
        </button>
      </div>
    </form>
  );
}
