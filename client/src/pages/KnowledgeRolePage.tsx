import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { ApiError } from "../types";

export function KnowledgeRolePage() {
  const { id } = useParams();
  const [role, setRole] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (id)
      api
        .knowledgeRoles()
        .then((result) => setRole(result.roles.find((item) => item.id === id)))
        .catch((err) =>
          setError(err instanceof ApiError ? err.message : "Role unavailable"),
        );
  }, [id]);
  if (error) return <p className="error">{error}</p>;
  if (!role) return <p className="muted">Loading knowledge map...</p>;
  return (
    <div>
      <section className="hero">
        <h1>{role.name}</h1>
        <p className="muted">{role.description}</p>
      </section>
      <div className="grid grid-2">
        {role.skills.map((skill: any) => (
          <article className="card" key={skill.id}>
            <h2>{skill.name}</h2>
            <p className="muted">
              Priority {skill.priority} · Target{" "}
              {Math.round(skill.targetMastery * 100)}%
            </p>
            <Link to={`/knowledge/skills/${skill.id}`}>View skill</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
