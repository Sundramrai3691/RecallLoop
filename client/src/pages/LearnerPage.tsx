import { useEffect, useState } from "react";
import { ArrowRight, BrainCircuit, Target } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, PageHeader } from "../components/Ui";
import { ApiError, type LearnerSummary } from "../types";
import { readableTitle } from "../utils/presentation";

export function LearnerPage() {
  const [summary, setSummary] = useState<LearnerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [busyConceptId, setBusyConceptId] = useState<string | null>(null);
  const navigate = useNavigate();
  useEffect(() => { void api.learnerSummary().then(setSummary).catch((err) => setError(err instanceof ApiError && err.status === 401 ? "Sign in to see your learner view." : "We couldn’t load your learner evidence. Please try again.")); }, []);
  async function practice(conceptId: string) {
    setBusyConceptId(conceptId); setPracticeError(null);
    try { const run = await api.createAssessment(conceptId, "practice"); navigate(`/assessments/${run.assessment.id}`); }
    catch { setPracticeError("This concept doesn’t have an approved practice question yet. Use its resources or choose another study topic."); }
    finally { setBusyConceptId(null); }
  }
  return <div>
    <PageHeader eyebrow="Your learning evidence" title="What do you actually know?" description="A view of what your recall has demonstrated so far. Knowledge grows through evidence, one attempt at a time." />
    {error ? <section className="error" role="alert">{error} {error.startsWith("Sign in") ? <Link to="/login">Sign in</Link> : null}</section> : !summary ? <div className="card grid"><div className="skeleton"/><div className="skeleton"/></div> : summary.assessedConcepts === 0 ? <EmptyState title="No recall evidence yet" to="/study/new" action="Start a study session" icon={<BrainCircuit size={18}/>}>Complete your first recall to establish your learner model. What you tell us you know stays separate from what recall demonstrates.</EmptyState> : <>
      <section className="learner-overview"><article className="card learner-score"><p className="eyebrow">AVERAGE RECALL SIGNAL</p>{summary.averageMastery === null ? <p className="not-assessed">Not assessed</p> : <p className="hero-stat">{Math.round(summary.averageMastery * 100)}<span className="score-unit">%</span></p>}<p className="muted">Equal average of each assessed concept’s rolling recall score, across {summary.assessedConcepts} {summary.assessedConcepts === 1 ? "concept" : "concepts"}.</p><details className="why-this"><summary>How this is calculated</summary><p>Each submitted recall blends its coverage with the previous concept score (60% new coverage, 40% previous score). This screen averages those concept scores equally. It is a changing recall signal, not a count of mastered knowledge points.</p></details></article><article className="card learner-signal"><div className="empty-icon"><Target size={18}/></div><h2>What needs attention</h2><p className="muted">{summary.weakConceptCount ? `${summary.weakConceptCount} concept${summary.weakConceptCount === 1 ? "" : "s"} could use another focused recall.` : "Your assessed concepts have no current weakness signals."}</p><p className="metadata">{summary.dueConcepts} due for review</p></article></section>
      <div className="section-heading"><h2>Concept evidence</h2><Link to="/study/new">Study something new <ArrowRight size={14}/></Link></div>
      {practiceError ? <p className="error" role="alert">{practiceError}</p> : null}
      {summary.weakConcepts.length ? <section className="card">{summary.weakConcepts.map((concept) => <article className="learner-concept" key={concept.conceptId}><span className="learner-concept-copy"><strong>{readableTitle(concept.conceptName, "Recent study topic")}</strong><span className="metadata">{concept.mistakeCount ? `${concept.mistakeCount} missed knowledge point${concept.mistakeCount === 1 ? "" : "s"}` : "Recall evidence"}</span></span><span className={`mastery-label ${concept.status.toLowerCase()}`}>{concept.status.replaceAll("_", " ")}</span><span className="mastery-track"><span className="mastery-fill" style={{ width: `${Math.max(0,Math.min(100,Math.round(concept.mastery * 100)))}%` }}/></span><span className="metadata">{Math.round(concept.mastery * 100)}%</span><div className="actions"><button className="btn btn-primary" type="button" disabled={!!busyConceptId} onClick={()=>void practice(concept.conceptId)}>{busyConceptId===concept.conceptId?"Preparing…":"Practice this concept"}</button><Link className="btn" to={`/resources?conceptId=${encodeURIComponent(concept.conceptId)}`}>View resources</Link></div></article>)}</section> : <EmptyState title="No weak concepts identified" to="/study/new" action="Keep learning">New recall attempts add evidence and help identify where practice will matter.</EmptyState>}
      {summary.weakSkills.length ? <><div className="section-heading"><h2>Goal skills</h2><Link to="/goals">View goals</Link></div><section className="card">{summary.weakSkills.map((skill) => <div className="skill-evidence" key={skill.skillId}><strong>{skill.name}</strong><span className="metadata">{skill.currentMastery === null ? "Not assessed" : `${Math.round(skill.currentMastery * 100)}% demonstrated`}</span></div>)}</section></> : null}
      {summary.recentMistakes.length ? <><div className="section-heading"><h2>Recent recall notes</h2></div><section className="grid grid-2">{summary.recentMistakes.map((item, index) => <article className="card" key={`${item.conceptId}-${item.submittedAt ?? index}`}><p className="eyebrow">{readableTitle(item.conceptName, "Recall note")}</p><p className="metadata">{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : "Recent"}</p><ul className="mistake-list">{item.mistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul></article>)}</section></> : null}
    </>}
  </div>;
}
