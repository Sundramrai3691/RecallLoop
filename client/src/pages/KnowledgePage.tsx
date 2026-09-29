import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { ApiError, type KnowledgeRole } from "../types";

export function KnowledgePage() {
  const [roles, setRoles] = useState<KnowledgeRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.knowledgeRoles().then((result) => setRoles(result.roles)).catch((err) => setError(err instanceof ApiError ? err.message : "Knowledge map unavailable")); }, []);
  if (error) return <p className="error">{error}</p>;
  return <div><section className="hero"><h1>Canonical knowledge</h1><p className="muted">A curated reference map of skills and concepts. It describes the target, not your personal mastery.</p></section><div className="grid grid-2">{roles.map((role) => <article className="card" key={role.id}><h2>{role.name}</h2><p>{role.description}</p><p className="muted">{role.domainName}</p><ul>{role.skills.map((skill) => <li key={skill.id}>{skill.name}</li>)}</ul><Link to={`/knowledge/roles/${role.id}`}>Explore role map</Link></article>)}</div></div>;
}
