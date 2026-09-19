import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ApiError } from "../types";

export function NewStudyPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [rawMaterial, setRawMaterial] = useState("");
  const [sourceType, setSourceType] = useState("notes");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.createStudySession({
        title,
        rawMaterial,
        sourceType,
      });
      navigate(`/study/${result.session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create study session");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h1>New study session</h1>
      <p className="muted">
        Capture what you studied. Concepts are extracted now; immediate recall starts when you
        mark the session complete.
      </p>
      {error ? <p className="error">{error}</p> : null}
      <label htmlFor="title">Topic</label>
      <input
        id="title"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Cache Aside Pattern"
      />
      <label htmlFor="sourceType">Source</label>
      <select
        id="sourceType"
        value={sourceType}
        onChange={(e) => setSourceType(e.target.value)}
      >
        <option value="manual">Manual</option>
        <option value="notes">Notes</option>
        <option value="url">URL</option>
        <option value="file">File</option>
      </select>
      <label htmlFor="material">Notes / material (optional)</label>
      <textarea
        id="material"
        value={rawMaterial}
        onChange={(e) => setRawMaterial(e.target.value)}
        placeholder="Paste the ideas you just studied. Mock mode splits headings and sentences into concepts."
      />
      <div className="actions">
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Extracting concepts…" : "Create session"}
        </button>
      </div>
    </form>
  );
}
