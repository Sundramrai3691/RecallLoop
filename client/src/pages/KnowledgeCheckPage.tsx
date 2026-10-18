import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, BookOpen, CircleHelp } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/Ui";
import type { KnowledgeCheckSubject } from "../types";

const modeDetails = {
  rapid_fire: { title: "Quick knowledge check", detail: "5 short questions: 2 multiple choice and 3 direct recall." },
  deep_recall: { title: "Explain the idea", detail: "1 descriptive question to check your own explanation." },
  practice: { title: "Apply the concept", detail: "1 scenario question to test how you use the idea." },
  mastery_check: { title: "Mixed assessment", detail: "6 questions across recall, explanation, application, depth, and transfer." },
} as const;

export function KnowledgeCheckPage() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<KnowledgeCheckSubject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [conceptId, setConceptId] = useState("");
  const [mode, setMode] = useState<keyof typeof modeDetails | "">("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void api.knowledgeCheckCoverage().then((result) => setSubjects(result.subjects)).catch(() => setError("We couldn’t load the current approved question coverage. Refresh to try again."))
      .finally(() => setLoading(false));
  }, []);

  const subject = subjects.find((item) => item.id === subjectId) ?? null;
  const topics = subject?.topics ?? [];
  const topic = topics.find((item) => item.id === topicId) ?? null;
  const concepts = useMemo(() => (topic?.concepts ?? []).filter((item) => !search.trim() || `${item.name} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase())), [topic, search]);
  const concept = topic?.concepts.find((item) => item.id === conceptId) ?? null;

  function selectSubject(id: string) { setSubjectId(id); setTopicId(""); setConceptId(""); setMode(""); }
  function selectTopic(id: string) { setTopicId(id); setConceptId(""); setMode(""); setSearch(""); }
  function selectConcept(id: string) { setConceptId(id); setMode(""); }

  async function startAssessment() {
    if (!concept || !mode) return;
    setBusy(true); setError(null);
    try {
      const result = await api.createCanonicalKnowledgeCheck(concept.id, mode);
      navigate(`/assessments/${result.assessment.id}?returnTo=${encodeURIComponent("/knowledge-check")}`);
    } catch {
      setError("Approved question coverage changed or is no longer sufficient. Choose another supported topic or learn this one first.");
      setBusy(false);
    }
  }

  if (loading) return <div className="grid"><PageHeader eyebrow="Test my knowledge" title="Choose a subject"/><p className="muted" role="status">Loading subjects and approved question coverage…</p></div>;
  return <div className="intent-page">
    <PageHeader eyebrow="Test my knowledge" title="What would you like to check?" description="Choose a subject and a specific concept. We show a test only when the current approved question bank can create it." />
    {error ? <p className="error" role="alert">{error}</p> : null}
    {subjects.length === 0 ? <section className="card"><h2>No canonical subjects are available</h2><p className="muted">The knowledge catalog has no active subjects yet. You can still learn from your own notes.</p><Link className="btn btn-primary" to="/study/new">Learn something new</Link></section> : <div className="knowledge-check-flow">
      <section className="card intent-step"><p className="eyebrow">1 · SUBJECT</p><label htmlFor="knowledge-subject">Choose a subject</label><select id="knowledge-subject" name="subject" value={subjectId} onChange={(event) => selectSubject(event.target.value)}><option value="">Select a subject…</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.domainName}</option>)}</select>{subject ? <p className="metadata">{subject.description || subject.domainName}</p> : null}</section>
      {subject ? <section className="card intent-step"><p className="eyebrow">2 · TOPIC</p><label htmlFor="knowledge-topic">Choose a topic</label><select id="knowledge-topic" name="topic" value={topicId} onChange={(event) => selectTopic(event.target.value)}><option value="">Select a topic…</option>{topics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{topic?.description ? <p className="metadata">{topic.description}</p> : null}
        {topic ? <div className="topic-concept-list">{topic.concepts.length > 20 ? <label className="concept-search" htmlFor="concept-search">Filter concepts<input id="concept-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search concepts…"/></label> : null}{concepts.map((item) => <label className={`concept-choice ${conceptId === item.id ? "selected" : ""}`} key={item.id}><input type="radio" name="concept" checked={conceptId === item.id} onChange={() => selectConcept(item.id)}/><span><strong>{item.name}</strong><span className="metadata">{item.description}</span><span className="metadata">{item.supportedModes.length ? `Supported checks: ${item.supportedModes.map((value) => modeDetails[value].title).join(", ")}` : "No assessment mode has enough approved questions yet."}</span></span></label>)}</div> : null}
      </section> : null}
      {concept ? <section className="card intent-step"><p className="eyebrow">3 · CHECK</p><h2>Choose a supported check</h2><p className="muted">Coverage is based on eligible published question revisions linked to this concept’s canonical knowledge points.</p><p className="metadata">Available bank coverage: {Object.entries(concept.coverage).length ? Object.entries(concept.coverage).map(([type, count]) => `${type.replaceAll("_", " ")}: ${count}`).join(" · ") : "No approved questions"}</p>
        {concept.supportedModes.length ? <fieldset className="mode-choice-list"><legend>Assessment mode</legend>{concept.supportedModes.map((item) => <label className={`mode-choice ${mode === item ? "selected" : ""}`} key={item}><input type="radio" name="assessment-mode" checked={mode === item} onChange={() => setMode(item)}/><span><strong>{modeDetails[item].title}</strong><span className="metadata">{modeDetails[item].detail}</span></span></label>)}</fieldset> : <div className="coverage-empty"><CircleHelp size={18}/><span><strong>This topic is not testable yet.</strong><span className="muted">Its bank coverage does not meet any complete assessment blueprint. No test will be created.</span></span></div>}
        <div className="actions"><button className="btn btn-primary" type="button" disabled={!mode || busy} onClick={() => void startAssessment()}>{busy ? "Preparing your check…" : "Start knowledge check"} <ArrowRight size={16}/></button><Link className="btn" to={`/study/new?topic=${encodeURIComponent(concept.name)}&topicId=${encodeURIComponent(topicId)}&conceptId=${encodeURIComponent(concept.id)}&returnTo=${encodeURIComponent("/knowledge-check")}`}><BookOpen size={15}/> Learn this topic</Link></div>
      </section> : null}
    </div>}
    <Link className="back-link" to="/dashboard"><BrainCircuit size={15}/> Back to Home</Link>
  </div>;
}
