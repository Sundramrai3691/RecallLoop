import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, FileText, Link as LinkIcon, StickyNote } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/Ui";
import { ApiError, type GroundingSourceDetail, type KnowledgeRoadmapRole } from "../types";

const sourceOptions = [
  { value: "url", label: "Web page excerpt", Icon: LinkIcon },
  { value: "file", label: "Book or document text", Icon: FileText },
  { value: "notes", label: "My notes", Icon: StickyNote },
  { value: "manual", label: "Other notes", Icon: StickyNote },
] as const;

function learningSourceReferences(source: GroundingSourceDetail): string[] {
  const extraction = source.provenance.extraction as { pages?: Array<{ pageNumber: number; hasText: boolean }>; sections?: string[]; sectionHeadings?: string[]; paragraphCount?: number } | undefined;
  if (source.sourceType === "pdf" && extraction?.pages?.length) return extraction.pages.filter((page) => page.hasText).map((page) => `PDF page ${page.pageNumber}`);
  if (source.sourceType === "docx") {
    const sections = extraction?.sections ?? extraction?.sectionHeadings ?? [];
    return [...sections, ...(extraction?.paragraphCount ? [`${extraction.paragraphCount} extracted paragraphs`] : [])];
  }
  return source.reference ? [source.reference] : [];
}

export function NewStudyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialIntent = searchParams.get("intent");
  const groundingSourceId = searchParams.get("sourceId") ?? "";
  const [learningIntent, setLearningIntent] = useState<"new" | "remember" | "apply">(initialIntent === "remember" || initialIntent === "apply" ? initialIntent : "new");
  const [title, setTitle] = useState(() => searchParams.get("topic") ?? "");
  const [canonicalTopicId, setCanonicalTopicId] = useState(() => searchParams.get("topicId") ?? "");
  const [canonicalConceptId, setCanonicalConceptId] = useState(() => searchParams.get("conceptId") ?? "");
  const rawReturnTo = searchParams.get("returnTo") ?? "";
  const returnTo = rawReturnTo === "/plan/today" || rawReturnTo === "/review" || rawReturnTo === "/knowledge-check" || /^\/knowledge\/roles\/[0-9a-f-]+(?:#topic-[0-9a-f-]+)?$/i.test(rawReturnTo) ? rawReturnTo : "";
  const [rawMaterial, setRawMaterial] = useState("");
  const [groundingSource, setGroundingSource] = useState<GroundingSourceDetail | null>(null);
  const [sourceLoading, setSourceLoading] = useState(Boolean(groundingSourceId));
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState<string>("notes");
  const [roles, setRoles] = useState<KnowledgeRoadmapRole[]>([]);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retryBlocked, setRetryBlocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitLock = useRef(false);
  const sourceReferences = groundingSource ? learningSourceReferences(groundingSource) : [];

  useEffect(() => { void api.knowledgeRoadmaps().then((result) => setRoles(result.roles)).catch(() => setRoles([])); }, []);
  useEffect(() => {
    if (!groundingSourceId) return;
    let active = true;
    setSourceLoading(true);
    void api.getGroundingSource(groundingSourceId).then(({ source }) => {
      if (!active) return;
      setGroundingSource(source);
      setTitle((current) => current.trim() ? current : source.title);
      if (source.processingStatus !== "processed" || !source.content.trim()) {
        setError(source.processingError ?? "This material has no usable extracted text to study.");
      }
    }).catch((err) => {
      if (active) setError(err instanceof ApiError && err.status === 404 ? "This learning material is unavailable." : "We couldn’t load this learning material. Refresh the library and try again.");
    }).finally(() => { if (active) setSourceLoading(false); });
    return () => { active = false; };
  }, [groundingSourceId]);
  const suggestions = useMemo(() => {
    const query = title.trim().toLowerCase();
    if (!query) return [];
    const matches=roles.flatMap((role) => role.skills.flatMap((skill) => skill.topics.flatMap((topic) => [
      ...(topic.name.toLowerCase().includes(query) ? [{ label: topic.name, value: topic.name, detail: `${role.name} → ${skill.name}`, topicId: topic.id, conceptId: "" }] : []),
      ...topic.concepts.filter((concept) => concept.name.toLowerCase().includes(query)).map((concept) => ({ label: concept.name, value: concept.name, detail: `${role.name} → ${skill.name} → ${topic.name}`, topicId: topic.id, conceptId: concept.id })),
    ])));
    return [...new Map(matches.map((item)=>[`${item.topicId}:${item.conceptId}`,item])).values()].slice(0,7);
  }, [roles, title]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitLock.current) return;
    if (/^(?:https?:\/\/|www\.)/i.test(title.trim())) { setError("Enter a topic name here. Put the link in Source link below."); return; }
    if (sourceUrl.trim()) {
      try { const parsed = new URL(sourceUrl.trim()); if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(); }
      catch { setError("Enter a valid http(s) source link."); return; }
    }
    if (groundingSourceId && (!groundingSource || groundingSource.processingStatus !== "processed" || !groundingSource.content.trim())) { setError("This material is not ready to study. Return to your library and refresh its status."); return; }
    if (!groundingSourceId && (!rawMaterial.trim() || /^https?:\/\/\S+$/i.test(rawMaterial.trim()))) { setError("Add notes or source text. RecallLoop saves links as provenance but does not fetch webpage or video contents."); return; }
    submitLock.current = true;
    setBusy(true); setError(null); setAuthError(false);
    try {
      const result = groundingSourceId
        ? await api.createStudySessionFromSource({ title: title.trim(), groundingSourceId, canonicalTopicId: canonicalTopicId || undefined, canonicalConceptId: canonicalConceptId || undefined })
        : await api.createStudySession({ title: title.trim(), rawMaterial, sourceType, sourceUrl: sourceUrl.trim() || undefined, canonicalTopicId: canonicalTopicId || undefined, canonicalConceptId: canonicalConceptId || undefined });
      const query = new URLSearchParams(); query.set("intent", learningIntent); if (returnTo) query.set("returnTo", returnTo);
      navigate(`/study/${result.session.id}?${query.toString()}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Authentication middleware rejects the request before session creation,
        // so this response is definitive rather than an ambiguous write outcome.
        setRetryBlocked(false);
        setAuthError(true);
        setError("Your sign-in is missing or has expired. Sign in, then return here and retry; your topic and notes are still on this page.");
      } else if (err instanceof ApiError && err.code === "SOURCE_NOT_READY") {
        setRetryBlocked(false);
        setError("This material has no processed text to study yet. Refresh your library after extraction finishes.");
      } else if (err instanceof ApiError && err.code === "SOURCE_NOT_FOUND") {
        setRetryBlocked(true);
        setError("This learning material is no longer available in your library.");
      } else if (err instanceof ApiError && err.code === "LLM_RATE_LIMITED") {
        setRetryBlocked(false);
        const delay = err.retryAfterSeconds !== undefined ? ` Retry after ${err.retryAfterSeconds} seconds.` : " Please retry in a moment.";
        setError(`The AI service is temporarily rate-limited. No study session was created. Your topic, source link, and notes are preserved.${delay}`);
      } else if (err instanceof ApiError && err.code === "LLM_QUOTA_EXHAUSTED") {
        setRetryBlocked(true);
        setError("The configured AI provider has exhausted its available quota. No study session was created. Your topic, source link, and notes are preserved. Check provider usage or try again when quota is available.");
      } else if (err instanceof ApiError && ["LLM_AUTHENTICATION_FAILED", "LLM_ACCESS_DENIED"].includes(err.code)) {
        setRetryBlocked(true);
        setError("The AI provider credentials or permissions are invalid. No study session was created; your form is preserved. Contact the application administrator.");
      } else {
        setRetryBlocked(true);
        setError("We couldn’t confirm whether the study session was created. Your topic, source link, and notes are preserved. Check your study sessions before retrying.");
      }
    }
    finally { submitLock.current = false; setBusy(false); }
  }

  function onTopicKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => (index + 1) % suggestions.length); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => (index - 1 + suggestions.length) % suggestions.length); }
    if (event.key === "Enter" && focused) { event.preventDefault(); const item=suggestions[active]; setTitle(item.value); setCanonicalTopicId(item.topicId); setCanonicalConceptId(item.conceptId); setFocused(false); }
    if (event.key === "Escape") setFocused(false);
  }

  return <div className="study-setup">
    {returnTo ? <Link className="back-link" to={returnTo}><ArrowLeft size={15}/> {returnTo === "/plan/today" ? "Today’s plan" : returnTo === "/review" ? "Review and improve" : "Knowledge map"}</Link> : null}
    <PageHeader eyebrow="Learn something new" title="What would you like to learn?" description="Choose a topic, then paste notes or an excerpt. RecallLoop extracts concepts from the text you provide and saves the source link separately." />
    <ol className="study-next-steps" aria-label="What happens next"><li><strong>1. Add text</strong><span>Paste notes or an excerpt.</span></li><li><strong>2. Review concepts</strong><span>Check the session’s extracted concepts.</span></li><li><strong>3. Recall</strong><span>Answer a question when you’re ready.</span></li></ol>
    <form className="card study-form" onSubmit={(event) => void onSubmit(event)}>
      {error ? <p className="error" role="alert">{error}{authError ? <> <a href="/login" target="_blank" rel="noreferrer">Open sign in in a new tab</a>.</> : null}</p> : null}
      <label htmlFor="study-topic">What are you studying?</label>
      <div className="suggestion-wrap"><input ref={inputRef} id="study-topic" name="topic" required autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={focused && suggestions.length > 0} aria-controls="topic-suggestions" aria-activedescendant={focused && suggestions[active] ? `topic-option-${active}` : undefined} value={title} onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => setFocused(false), 100)} onKeyDown={onTopicKeyDown} onChange={(event) => { setTitle(event.target.value); setCanonicalTopicId(""); setCanonicalConceptId(""); setActive(0); }} placeholder="Try ‘Computer Networks’ or ‘Caching’" />
        {focused && suggestions.length > 0 ? <ul className="suggestion-list" id="topic-suggestions" role="listbox">{suggestions.map((item, index) => <li key={`${item.topicId}-${item.conceptId}`} id={`topic-option-${index}`} role="option" aria-selected={index === active}><button role="presentation" tabIndex={-1} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setTitle(item.value); setCanonicalTopicId(item.topicId); setCanonicalConceptId(item.conceptId); setFocused(false); inputRef.current?.focus(); }}><span>{item.label}</span><small>{item.detail}</small></button></li>)}</ul> : null}</div>
      <p className="metadata">{canonicalTopicId ? "Linked to the selected knowledge map node. Edit the title to make this a custom topic." : "Suggestions come from the knowledge map. You can also enter your own topic."}</p>
      {groundingSourceId ? sourceLoading ? <p className="metadata" role="status">Loading your extracted material…</p> : groundingSource ? <section className="card source-study-preview" aria-labelledby="source-study-title">
        <h2 id="source-study-title">Material to learn from</h2>
        <p><strong>{groundingSource.title}</strong> · {groundingSource.sourceType.replaceAll("_", " ")}</p>
        <p className="metadata">{groundingSource.content.length.toLocaleString()} extracted characters in {groundingSource.chunkCount} source chunks. Text extraction is ready; this does not guarantee a canonical question-bank assessment is available, and reading it does not count as demonstrated knowledge.</p>
        {sourceReferences.length ? <p className="metadata"><strong>Source references:</strong> {sourceReferences.join(" · ")}</p> : null}
        <details><summary>Preview extracted text</summary><p>{groundingSource.content.slice(0, 1200)}{groundingSource.content.length > 1200 ? "…" : ""}</p></details>
        <p className="metadata">RecallLoop will extract session concepts from the full owned source. You can inspect their learning objectives before starting recall.</p>
      </section> : <p className="error" role="alert">The selected learning material could not be loaded.</p> : null}
      <fieldset className="learning-intent-options"><legend>What brings you to this topic?</legend>
        <label><input type="radio" name="learningIntent" value="new" checked={learningIntent === "new"} onChange={() => setLearningIntent("new")}/><span><strong>It’s new to me</strong><span className="metadata">Review the extracted ideas, then start a recall check.</span></span></label>
        <label><input type="radio" name="learningIntent" value="remember" checked={learningIntent === "remember"} onChange={() => setLearningIntent("remember")}/><span><strong>I’ve studied it, but don’t remember it confidently</strong><span className="metadata">Review the concepts and move into recall practice.</span></span></label>
        <label><input type="radio" name="learningIntent" value="apply" checked={learningIntent === "apply"} onChange={() => setLearningIntent("apply")}/><span><strong>I want to apply or practise it</strong><span className="metadata">Open the extracted concept’s practice option when the session is ready.</span></span></label>
      </fieldset>
      {!groundingSourceId ? <fieldset className="source-fieldset"><legend>How are you learning this?</legend><div className="source-options">{sourceOptions.map(({ value, label, Icon }) => <button key={value} type="button" className={`source-option ${sourceType === value ? "selected" : ""}`} aria-pressed={sourceType === value} onClick={() => setSourceType(value)}><Icon size={18}/><span>{label}</span></button>)}</div></fieldset> : null}
      <div hidden={Boolean(groundingSourceId)}>
      <p className="metadata">This records where your text came from. RecallLoop uses the text you paste; it does not fetch web pages or upload files.</p>
      <label htmlFor="source-url">Source link <span className="muted">(optional)</span></label>
      <input id="source-url" name="sourceUrl" type="url" inputMode="url" autoComplete="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" />
      <p className="metadata">The link is saved with this session. Pages, video transcripts, and files are not fetched or uploaded; paste usable text below.</p>
      </div>
      {!groundingSourceId ? <><label htmlFor="material">Notes or source text</label>
      <textarea id="material" name="material" autoComplete="off" rows={6} required value={rawMaterial} onChange={(event) => setRawMaterial(event.target.value)} placeholder="Paste notes or a short source excerpt. Concepts and recall questions are based on this text." /></> : null}
      <div className="study-form-footer"><span className="metadata"><BookOpen size={14}/> {groundingSourceId ? "Imported source is preserved with this session." : "Local mock extraction is deterministic; it is not semantic LLM extraction."}</span><button className="btn btn-primary" disabled={busy || sourceLoading || retryBlocked || !title.trim() || (groundingSourceId ? !groundingSource || groundingSource.processingStatus !== "processed" : !rawMaterial.trim())} type="submit">{busy ? "Creating session…" : retryBlocked ? "Retry unavailable" : groundingSourceId ? "Start learning session" : "Create study session"}</button></div>
    </form>
  </div>;
}
