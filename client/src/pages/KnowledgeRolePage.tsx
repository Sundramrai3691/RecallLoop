import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, PageHeader } from "../components/Ui";
import { type KnowledgeRole } from "../types";

export function KnowledgeRolePage() {
  const { id } = useParams(); const [role, setRole] = useState<KnowledgeRole | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (id) void api.knowledgeRoles().then((result) => setRole(result.roles.find((item) => item.id === id) ?? null)).catch(() => setError("We couldn’t load this part of the knowledge map.")); }, [id]);
  if (error) return <p className="error" role="alert">{error} <Link to="/knowledge">Back to knowledge map</Link></p>;
  if (!role) return <div className="card grid"><div className="skeleton"/><div className="skeleton"/></div>;
  return <div><Link className="back-link" to="/knowledge"><ArrowLeft size={15}/> Knowledge map</Link><PageHeader eyebrow={role.domainName} title={role.name} description={role.description}/>
    {role.skills.length ? <section className="knowledge-skills">{role.skills.map((skill,index) => <article className="knowledge-skill card" key={skill.id}><span className="knowledge-skill-number">{String(index+1).padStart(2,"0")}</span><div><h2>{skill.name}</h2><p className="metadata">Focus area in {role.name}</p></div></article>)}</section> : <EmptyState title="No focus areas listed" to="/study/new" action="Study a topic" icon={<BookOpen size={18}/>}>Start with a topic you want to understand.</EmptyState>}
  </div>;
}
