import { ArrowRight, BookOpen, BrainCircuit, Compass, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/theme/ThemeToggle";

const areas = ["CS Fundamentals", "Computer Networks", "Operating Systems", "DBMS", "Web & Backend", "System Design", "Programming Languages", "Data Structures & Algorithms"];

export function LandingPage() {
  return <main className="landing">
    <header className="landing-nav"><Link className="wordmark" to="/" aria-label="RecallLoop home"><span className="wordmark-mark">r</span><span>Recall<span className="wordmark-accent">Loop</span></span></Link><div className="actions" style={{ margin: 0 }}><ThemeToggle /><Link to="/login">Sign in</Link></div></header>
    <section className="landing-hero"><div><p className="eyebrow">A better way to learn technical skills</p><h1>Know it.<br/>Recall it.<br/><span className="wordmark-accent">Use it.</span></h1><p>Turn technical study into measurable mastery through retrieval, evaluation, and adaptive practice.</p><Link className="btn btn-primary" to="/register">Start learning <ArrowRight size={16}/></Link></div>
      <div className="loop-diagram" aria-label="Learn, recall, evaluate, adapt"><div className="loop-step"><span><BookOpen size={15}/></span><div>LEARN<small>Study what matters</small></div></div><div className="loop-arrow"/><div className="loop-step"><span><BrainCircuit size={15}/></span><div>RECALL<small>Prove what you remember</small></div></div><div className="loop-arrow"/><div className="loop-step"><span><Target size={15}/></span><div>EVALUATE<small>Understand what you missed</small></div></div><div className="loop-arrow"/><div className="loop-step"><span><Compass size={15}/></span><div>ADAPT<small>Practice what needs work</small></div></div></div>
    </section>
    <section><div className="section-heading"><h2>Built for the things you want to understand</h2></div><div className="topic-grid">{areas.map((area) => <div className="topic-pill" key={area}>{area}</div>)}</div></section>
  </main>;
}
