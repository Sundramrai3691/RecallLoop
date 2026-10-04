import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, FileText, Link as LinkIcon, StickyNote, Video } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/Ui";
import { ApiError, type KnowledgeRole } from "../types";

const sourceOptions = [
  { value: "url", label: "Article or docs", Icon: LinkIcon },
  { value: "file", label: "PDF or book", Icon: FileText },
  { value: "notes", label: "My notes", Icon: StickyNote },
  { value: "manual", label: "Video or other", Icon: Video },
] as const;

export function NewStudyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState(() => searchParams.get("topic") ?? "");
  const [rawMaterial, setRawMaterial] = useState("");
  const [sourceType, setSourceType] = useState<string>("notes");
  const [roles, setRoles] = useState<KnowledgeRole[]>([]);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void api.knowledgeRoles().then((result) => setRoles(result.roles)).catch(() => setRoles([])); }, []);
  const suggestions = useMemo(() => {
    const query = title.trim().toLowerCase();
    if (!query) return [];
    return roles.flatMap((role) => [
      ...(role.name.toLowerCase().includes(query) ? [{ label: role.name, value: role.name, detail: role.domainName }] : []),
      ...role.skills.filter((skill) => skill.name.toLowerCase().includes(query) || `${role.name} ${skill.name}`.toLowerCase().includes(query)).map((skill) => ({ label: `${role.name} → ${skill.name}`, value: skill.name, detail: "Knowledge map" })),
    ]).slice(0, 7);
  }, [roles, title]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const result = await api.createStudySession({ title: title.trim(), rawMaterial, sourceType });
      navigate(`/study/${result.session.id}`);
    } catch (err) { setError(err instanceof ApiError ? "We couldn’t start this study session. Please try again." : "We couldn’t reach the study service. Please try again."); }
    finally { setBusy(false); }
  }

  function onTopicKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => (index + 1) % suggestions.length); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => (index - 1 + suggestions.length) % suggestions.length); }
    if (event.key === "Enter" && focused) { event.preventDefault(); setTitle(suggestions[active].value); setFocused(false); }
    if (event.key === "Escape") setFocused(false);
  }

  return <div className="study-setup">
    <PageHeader eyebrow="Learn" title="What are you studying?" description="Choose a topic and capture the material you’re learning from. Recall practice follows when you’re ready." />
    <form className="card study-form" onSubmit={(event) => void onSubmit(event)}>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <label htmlFor="study-topic">What are you studying?</label>
      <div className="suggestion-wrap"><input ref={inputRef} id="study-topic" required autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={focused && suggestions.length > 0} aria-controls="topic-suggestions" aria-activedescendant={focused && suggestions[active] ? `topic-option-${active}` : undefined} value={title} onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => setFocused(false), 100)} onKeyDown={onTopicKeyDown} onChange={(event) => { setTitle(event.target.value); setActive(0); }} placeholder="Try ‘Computer Networks’ or ‘Caching’" />
        {focused && suggestions.length > 0 ? <ul className="suggestion-list" id="topic-suggestions" role="listbox">{suggestions.map((item, index) => <li key={`${item.value}-${item.detail}`} id={`topic-option-${index}`} role="option" aria-selected={index === active}><button role="presentation" tabIndex={-1} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setTitle(item.value); setFocused(false); inputRef.current?.focus(); }}><span>{item.label}</span><small>{item.detail}</small></button></li>)}</ul> : null}</div>
      <p className="metadata">Suggestions come from the knowledge map. You can also enter your own topic.</p>
      <fieldset className="source-fieldset"><legend>How are you learning this?</legend><div className="source-options">{sourceOptions.map(({ value, label, Icon }) => <button key={value} type="button" className={`source-option ${sourceType === value ? "selected" : ""}`} aria-pressed={sourceType === value} onClick={() => setSourceType(value)}><Icon size={18}/><span>{label}</span></button>)}</div></fieldset>
      <label htmlFor="material">Notes or material <span className="muted">(optional)</span></label>
      <textarea id="material" rows={6} value={rawMaterial} onChange={(event) => setRawMaterial(event.target.value)} placeholder="Jot down key ideas or paste a short excerpt to help identify concepts." />
      <div className="study-form-footer"><span className="metadata"><BookOpen size={14}/> You’ll be able to review extracted concepts before recall.</span><button className="btn btn-primary" disabled={busy || !title.trim()} type="submit">{busy ? "Starting session…" : "Continue to study"}</button></div>
    </form>
  </div>;
}
