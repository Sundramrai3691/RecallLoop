import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, PageHeader } from "../components/Ui";
import { type KnowledgeRoadmapRole } from "../types";

const statusLabel = (status:string) => status === "assessed" ? "Evidence available" : status === "studied" ? "Studied · not assessed" : "Not started";

export function KnowledgeRolePage() {
  const { id } = useParams();
  const [role, setRole] = useState<KnowledgeRoadmapRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (id) void api.knowledgeRoleRoadmap(id).then((result) => setRole(result.role)).catch(() => setError("We couldn’t load this part of the knowledge map.")); }, [id]);
  if (error) return <p className="error" role="alert">{error} <Link to="/knowledge">Back to knowledge map</Link></p>;
  if (!role) return <div className="card grid"><div className="skeleton"/><div className="skeleton"/></div>;
  const returnTo=`/knowledge/roles/${role.id}`;
  const studyLink=(title:string,topicId:string,conceptId?:string)=>`/study/new?${new URLSearchParams({topic:title,topicId,...(conceptId?{conceptId}:{}),returnTo:`${returnTo}#topic-${topicId}`}).toString()}`;
  return <div><Link className="back-link" to="/knowledge"><ArrowLeft size={15}/> Knowledge map</Link><PageHeader eyebrow={role.domainName} title={role.name} description={role.description}/>
    {role.skills.length ? <section className="knowledge-skills">{role.skills.map((skill,index) => <article className="knowledge-skill card" key={skill.id} id={`skill-${skill.id}`}><span className="knowledge-skill-number">{String(index+1).padStart(2,"0")}</span><div className="grid"><div><h2>{skill.name}</h2><p className="metadata">{skill.description || `Focus area in ${role.name}`} · {statusLabel(skill.status)}</p></div>
      {skill.topics.map((topic)=><section className="card" key={topic.id} id={`topic-${topic.id}`}><div className="actions" style={{justifyContent:"space-between"}}><div><h3>{topic.name}</h3><p className="metadata">{topic.description || statusLabel(topic.status)}</p></div><Link className="btn btn-primary" to={studyLink(topic.name,topic.id)}><BookOpen size={15}/> Study topic</Link></div>
        {topic.concepts.map((concept)=><article className="card" key={concept.id} id={`concept-${concept.id}`}><div className="actions" style={{justifyContent:"space-between"}}><div><h4>{concept.name}</h4><p className="metadata">{concept.description || `Difficulty ${concept.difficulty}`} · {statusLabel(concept.status)}</p></div><Link className="btn" to={studyLink(concept.name,topic.id,concept.id)}>Study concept</Link></div>
          {concept.prerequisites.length ? <div><strong>Prerequisites</strong><ul>{concept.prerequisites.map((item)=><li key={item.id}><Link to={studyLink(item.name,item.topicId,item.id)}>{item.name}</Link> <span className="metadata">{statusLabel(item.status)}</span></li>)}</ul></div>:null}
          {concept.knowledgePoints.length ? <details><summary>{concept.knowledgePoints.length} knowledge points</summary><ul>{concept.knowledgePoints.map((point)=><li key={point.id}>{point.statement} <span className="metadata">· {point.evidence.status.replaceAll("_"," ")}{point.evidence.attemptCount?` (${point.evidence.attemptCount} recall attempts)`:""}</span></li>)}</ul></details>:null}
          {concept.resources.length ? <div><strong>Resources</strong><ul>{concept.resources.map((resource)=><li key={resource.id}><a href={resource.url} target="_blank" rel="noreferrer">{resource.title}</a> <span className="metadata">Approx. {resource.estimatedMinutes} min · {resource.provider}</span></li>)}</ul></div>:null}
        </article>)}
      </section>)}
    </div></article>)}</section> : <EmptyState title="No focus areas listed" to="/study/new" action="Study a topic" icon={<BookOpen size={18}/>}>Start with a topic you want to understand.</EmptyState>}
  </div>;
}
