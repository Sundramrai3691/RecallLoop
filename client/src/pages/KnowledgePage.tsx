import { useEffect, useState } from "react";
import { ArrowRight, LibraryBig } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, PageHeader } from "../components/Ui";
import { ApiError, type KnowledgeRole } from "../types";

export function KnowledgePage() {
  const [roles, setRoles] = useState<KnowledgeRole[]>([]); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; void api.knowledgeRoles().then((result) => { if (active) setRoles(result.roles); }).catch((err) => { if (active) setError(err instanceof ApiError ? "The knowledge map is unavailable right now." : "We couldn’t load the knowledge map. Please try again."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  return <div><PageHeader eyebrow="Explore" title="Knowledge map" description="A curated map of the skills that technical roles call for. Use it to find a direction for your next study session."/>
    {error ? <p className="error" role="alert">{error}</p> : loading ? <div className="grid grid-2"><div className="card grid"><div className="skeleton"/><div className="skeleton"/></div><div className="card grid"><div className="skeleton"/><div className="skeleton"/></div></div> : roles.length ? <div className="grid grid-2">{roles.map((role) => <Link className="card card-interactive knowledge-card" key={role.id} to={`/knowledge/roles/${role.id}`}><span className="knowledge-domain">{role.domainName}</span><h2>{role.name}</h2><p className="muted">{role.description}</p><div className="knowledge-footer"><span>{role.skills.length} focus areas</span><span>Explore map <ArrowRight size={14}/></span></div></Link>)}</div> : <EmptyState title="Knowledge map is being prepared" to="/study/new" action="Study a topic" icon={<LibraryBig size={18}/>}>You can start a study session with any technical topic in the meantime.</EmptyState>}
  </div>;
}
