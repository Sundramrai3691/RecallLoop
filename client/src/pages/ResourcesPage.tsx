import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, BookOpen, Clock3, FileText, LibraryBig } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, PageHeader } from "../components/Ui";
import { ApiError, type ResourceRecommendation } from "../types";

type MaterialType = "text" | "markdown" | "web_article" | "pdf" | "docx" | "video";
function prettyType(type: string | undefined) { return type ? type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Learning resource"; }

export function ResourcesPage() {
  const [params] = useSearchParams();
  const conceptId = params.get("conceptId") ?? undefined;
  const rawReturnTo = params.get("returnTo") ?? "";
  const returnTo = ["/plan/today", "/review", "/knowledge-check"].includes(rawReturnTo) ? rawReturnTo : "";
  const [available, setAvailable] = useState(60);
  const [resources, setResources] = useState<ResourceRecommendation[]>([]);
  const [pack, setPack] = useState<Awaited<ReturnType<typeof api.learningPack>>["pack"] | null>(null);
  const [sources, setSources] = useState<Awaited<ReturnType<typeof api.listGroundingSources>>["sources"]>([]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [provenance, setProvenance] = useState("");
  const [sourceType, setSourceType] = useState<MaterialType>("text");
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [resourceResult, packResult] = await Promise.all([api.recommendedResources(conceptId, available), conceptId ? api.learningPack(conceptId, available) : Promise.resolve(null)]);
      setResources(resourceResult.resources);
      setPack(packResult?.pack ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Sign in to see your focused resources." : "We couldn’t load resources right now. Please try again.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [conceptId]);
  useEffect(() => { void api.listGroundingSources().then((result) => setSources(result.sources)).catch(() => setSources([])); }, []);

  async function addSource(event: FormEvent) {
    event.preventDefault(); setNotice(null); setError(null); setPreview(null); setSaving(true);
    try {
      if (sourceType === "video") throw new Error("RecallLoop cannot import video transcripts yet. Paste an accessible transcript or excerpt instead.");
      const result = sourceType === "pdf"
        ? await api.ingestGroundingPdf(pdfFile!, { title: title.trim(), reference: reference.trim() || pdfFile!.name, provenance: provenance.trim() ? { attribution: provenance.trim(), submittedBy: "learner" } : { submittedBy: "learner" } })
        : sourceType === "docx"
        ? await api.ingestGroundingDocx(pdfFile!, { title: title.trim(), reference: reference.trim() || pdfFile!.name, provenance: provenance.trim() ? { attribution: provenance.trim(), submittedBy: "learner" } : { submittedBy: "learner" } })
        : await api.ingestGroundingSource({
        title: title.trim() || undefined,
        text: sourceType === "web_article" ? undefined : text,
        sourceType,
        reference: reference.trim() || undefined,
        url: sourceType === "web_article" ? reference.trim() : undefined,
        provenance: provenance.trim() ? { attribution: provenance.trim(), submittedBy: "learner" } : { submittedBy: "learner" },
      });
      if (result.source.processingStatus === "processing") {
        setNotice(`This ${sourceType.toUpperCase()} is already being extracted. Refresh your materials in a moment to check its status.`);
      } else if (result.source.processingStatus !== "processed") {
        setError(result.source.processingError ?? (result.source.processingStatus === "scanned_or_no_extractable_text" ? "No usable text could be extracted. This may be a scanned PDF; OCR is not available yet." : "The source could not be extracted."));
        setNotice(null);
      } else {
        const extraction = result.source.provenance?.extraction as { pageCount?: number; paragraphCount?:number; sections?:string[] } | undefined;
        setNotice(result.source.duplicate ? "This source is already in your library and is ready for focused review." : sourceType === "pdf" ? `Extracted text from ${extraction?.pageCount} PDF pages. Page references are kept with each excerpt.` : sourceType === "docx" ? `Extracted ${extraction?.paragraphCount} DOCX paragraphs${extraction?.sections?.length ? ` across ${extraction.sections.length} sections` : ""}. Section and paragraph references are kept with excerpts.` : "The source was extracted and is ready for focused review.");
        setPreview(result.source.content?.slice(0, 1600) ?? null);
      }
      if (result.source.processingStatus === "processed") { setTitle(""); setText(""); setReference(""); setProvenance(""); setPdfFile(null); }
      const refreshed = await api.listGroundingSources(); setSources(refreshed.sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t process that source. Check the details and try again.");
    } finally { setSaving(false); }
  }
  async function loadDocument(file: File | undefined) {
    if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    if (extension === "pdf"||extension==="docx") {
      if (file.size > 10 * 1024 * 1024) { setError(`This ${extension.toUpperCase()} is too large. Choose a file under 10 MB.`); return; }
      setSourceType(extension); setPdfFile(file); setTitle((current) => !current.trim() || current === pdfFile?.name ? file.name.slice(0, 200) : current); setText(""); setError(null); setNotice(null); setPreview(null); return;
    }
    if (extension !== "txt" && extension !== "md") { setError("Upload a TXT or Markdown file, or paste your material."); return; }
    if (file.size > 250_000) { setError("This file is too large. Choose a TXT or Markdown file under 250 KB."); return; }
    try {
      setPdfFile(null);
      const contents = await file.text();
      if (!contents.trim() || contents.includes("\u0000") || (contents.match(/\uFFFD/g)?.length ?? 0) > 4) throw new Error("The selected file is empty or is not valid UTF-8 text.");
      setSourceType(extension === "md" ? "markdown" : "text");
      setTitle((current) => current.trim() ? current : file.name.slice(0, 200));
      setText(contents);
      setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : "The selected text file could not be read."); }
  }

  const article = sourceType === "web_article";
  const documentUpload=sourceType==="pdf"||sourceType==="docx";
  const canSubmit = !saving && (article ? reference.trim().length > 0 : documentUpload ? Boolean(title.trim() && pdfFile) : sourceType === "video" ? false : Boolean(title.trim() && text.trim()));
  return <div>
    {returnTo ? <Link className="back-link" to={returnTo}>{returnTo === "/plan/today" ? "Return to today’s plan" : returnTo === "/review" ? "Return to review and improve" : "Return to subject choices"}</Link> : null}
    <PageHeader eyebrow="Explore" title={conceptId ? "Focused resources" : "Learning resources"} description={conceptId ? "Material selected to help you revisit this concept." : "A reading list shaped around what you’re learning and what you have time for."} />
    <section className="resource-controls card"><div><label htmlFor="resource-time">Time available</label><select id="resource-time" value={available} onChange={(event) => setAvailable(Number(event.target.value))}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option></select></div><button className="btn btn-primary" type="button" disabled={loading} onClick={() => void load()}>Refresh suggestions</button></section>
    {error && !saving ? <p className="error" role="alert">{error}</p> : null}
    {notice ? <p className="notice" role="status">{notice}</p> : null}
    {pack ? <section className="learning-pack"><div className="section-heading"><div><p className="eyebrow">A focused path</p><h2>{pack.conceptName}</h2></div><span className="metadata">{pack.estimatedTotalMinutes} min · {pack.remainingMinutes} min left</span></div><div className="learning-pack-items">{pack.items.map((item, index) => <article className="pack-item card" key={`${item.kind}-${index}`}><span className="pack-number">{String(index + 1).padStart(2, "0")}</span><div><span className="task-type"><BookOpen size={14} />{prettyType(item.kind)} · {item.minutes} min</span><h3>{item.title}</h3><p className="muted">{item.reason}</p></div>{item.url ? <a className="icon-link" href={item.url} target="_blank" rel="noreferrer" aria-label={`Open ${item.title}`}><ArrowUpRight size={17} /></a> : null}</article>)}</div></section> : null}
    <div className="section-heading"><h2>{conceptId ? "Recommended for this concept" : "Recommended for you"}</h2></div>
    {loading ? <div className="grid grid-2"><div className="card grid"><div className="skeleton" /><div className="skeleton" /></div><div className="card grid"><div className="skeleton" /><div className="skeleton" /></div></div> : resources.length ? <div className="grid grid-2">{resources.map((resource) => <article className="card resource-card" key={resource.id}><div className="resource-card-top"><span className="status-chip"><FileText size={13} />{prettyType(resource.resourceType)}</span><span className="metadata"><Clock3 size={13} />~{resource.estimatedMinutes} min estimate</span></div><h2>{resource.title}</h2><p className="resource-provider">{resource.provider}</p><p className="muted">{resource.description}</p>{resource.conceptsCovered.length ? <p className="resource-focus"><strong>Focus</strong><span>{resource.conceptsCovered.join(", ")}</span></p> : null}<p className="resource-why"><strong>Why this</strong><span>{resource.reason}</span></p><a className="btn btn-primary" href={resource.url} target="_blank" rel="noreferrer">Open resource <ArrowUpRight size={15} /></a></article>)}</div> : !error ? <EmptyState title="No matching resources yet" to="/study/new" action="Study a topic" icon={<LibraryBig size={18} />}>As you study and recall, resources can be matched to the concepts you want to revisit.</EmptyState> : null}
    <details className="source-contribution card"><summary>Have material to study from?</summary>
      <p className="muted">Add notes or excerpts you’re allowed to use, or import a public article. Imported text supports focused remediation when a recall exposes a gap.</p>
      <form className="grid" onSubmit={(event) => void addSource(event)}>
        <label htmlFor="material-type">Material type<select id="material-type" name="materialType" value={sourceType} onChange={(event) => { const next=event.target.value as MaterialType; if(next!==sourceType){if(pdfFile&&title===pdfFile.name)setTitle("");setPdfFile(null);}setSourceType(next);setError(null); }}><option value="text">Pasted text</option><option value="markdown">Markdown</option><option value="pdf">PDF document</option><option value="docx">Word document (DOCX)</option><option value="web_article">Public web article</option><option value="video">Video link</option></select></label>
        {article ? <label htmlFor="material-url">Public article URL<input id="material-url" name="url" type="url" inputMode="url" autoComplete="off" maxLength={1000} placeholder="https://example.com/article" required value={reference} onChange={(event) => setReference(event.target.value)} /></label> : <>
          <label htmlFor="material-title">Title<input id="material-title" name="title" autoComplete="off" maxLength={200} required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label htmlFor="material-reference">Source link or file reference <span className="muted">(optional)</span><input id="material-reference" name="reference" autoComplete="off" maxLength={1000} value={reference} onChange={(event) => setReference(event.target.value)} /></label>
        </>}
        <label htmlFor="material-attribution">Attribution <span className="muted">(optional)</span><input id="material-attribution" name="attribution" autoComplete="off" maxLength={500} value={provenance} onChange={(event) => setProvenance(event.target.value)} /></label>
        {sourceType === "video" ? <p className="muted" role="status">Video transcripts are not available in this setup. You can paste an accessible transcript or excerpt as text.</p> : null}
        {sourceType !== "web_article" && sourceType !== "video" ? <>
          <label htmlFor="material-file">Upload {sourceType === "pdf" ? "a PDF" : sourceType==="docx"?"a Word DOCX":"a TXT, Markdown, PDF, or DOCX file"}<span className="muted">{sourceType === "pdf" ? " (text-based PDFs up to 10 MB and 100 pages; scanned PDFs are not OCR processed)" : sourceType==="docx"?" (DOCX up to 10 MB; headings, lists and tables are retained with section and paragraph references)":" (PDFs are extracted page by page; DOCX structure is retained)"}</span><input id="material-file" name="materialFile" type="file" accept={sourceType === "pdf" ? ".pdf,application/pdf" : sourceType==="docx"?".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document":".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"} onChange={(event) => void loadDocument(event.target.files?.[0])} /></label>
          {!documentUpload ? <label htmlFor="material-text">Notes or excerpt<textarea id="material-text" name="materialText" required maxLength={250000} rows={7} value={text} onChange={(event) => setText(event.target.value)} /></label> : pdfFile ? <p className="muted" role="status">Selected {pdfFile.name} ({Math.ceil(pdfFile.size / 1024)} KB). Extraction runs during upload.</p> : <p className="muted" role="status">Choose a {sourceType.toUpperCase()} file to upload it into your learning materials.</p>}
        </> : null}
        {error && saving ? <p className="error" role="alert">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={!canSubmit}>{saving ? documentUpload ? `Extracting ${sourceType.toUpperCase()}…` : "Extracting…" : article ? "Import article" : documentUpload ? `Upload ${sourceType.toUpperCase()}` : "Save learning material"}</button>
      </form>
      {preview ? <details className="source-preview"><summary>Preview extracted content</summary><p>{preview}{preview.length >= 1600 ? "…" : ""}</p></details> : null}
      {sources.length ? <div className="source-library"><h3>Your materials</h3>{sources.slice(0, 8).map((source) => { const extraction = source.provenance?.extraction as { pageCount?: number } | undefined; const state = source.processingStatus === "scanned_or_no_extractable_text" ? "No extractable text (possibly scanned; OCR unavailable)" : source.processingStatus === "processed" ? `Extracted text ready${source.sourceType === "pdf" ? ` · ${extraction?.pageCount ?? 0} PDF pages` : ""}` : source.processingStatus === "failed" ? source.processingError || "Import failed" : "Being prepared"; return <div className="source-row" key={source.id}><span><strong>{source.title}</strong><span className="metadata">{state}</span></span><span className="actions"><span className="status-chip">{source.processingStatus === "processed" ? "Ready" : source.processingStatus === "scanned_or_no_extractable_text" ? "No text" : source.processingStatus === "failed" ? "Failed" : "Processing"}</span>{source.processingStatus === "processed" ? <Link className="btn btn-primary" to={`/study/new?sourceId=${encodeURIComponent(source.id)}`}>Start learning session</Link> : null}</span></div>; })}</div> : null}
    </details>
  </div>;
}
