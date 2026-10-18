import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, BookOpen, BrainCircuit, Compass, Moon, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/theme/ThemeToggle";

const steps = [
  { title: "Learn", text: "Bring a topic and the material you want to understand.", Icon: BookOpen },
  { title: "Recall", text: "Practice retrieving ideas without looking at your notes.", Icon: BrainCircuit },
  { title: "Evaluate", text: "See what your answer covered and where it needs work.", Icon: Target },
  { title: "Adapt", text: "Use that evidence to choose a useful next step.", Icon: Compass },
];

export function LandingPage() {
  const reduceMotion = useReducedMotion();
  return <main className="landing">
    <header className="landing-nav">
      <Link className="wordmark" to="/" aria-label="RecallLoop home"><span className="wordmark-mark">r</span><span>Recall<span className="wordmark-accent">Loop</span></span></Link>
      <div className="actions" style={{ margin: 0 }}><ThemeToggle /><Link to="/login">Sign in</Link><Link className="btn btn-primary" to="/register">Get started <ArrowRight size={15}/></Link></div>
    </header>

    <section className="landing-hero">
      <motion.div initial={reduceMotion ? false : { opacity: 0, y: 13 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, ease: "easeOut" }}>
        <p className="eyebrow">A learning practice built around remembering</p>
        <h1>Make learning<br/> <span className="wordmark-accent">stick.</span></h1>
        <p className="landing-hero-copy">Turn study into a repeatable loop: learn with purpose, recall from memory, and use your answers to guide what comes next.</p>
        <Link className="btn btn-primary" to="/register">Start your learning loop <ArrowRight size={16}/></Link>
        <div className="landing-proofline"><span className="proof-dots" aria-hidden="true"><i/><i/><i/></span><span>Built for steady progress, one useful session at a time</span></div>
      </motion.div>
      <motion.div className="constellation" role="img" aria-label="A visual map of the learning loop: learn, recall, evaluate, and adapt around your knowledge">
        <svg viewBox="0 0 520 390" aria-hidden="true" preserveAspectRatio="none">
          <ellipse className="constellation-orbit" cx="260" cy="195" rx="190" ry="145" />
          <ellipse className="constellation-orbit" cx="260" cy="195" rx="132" ry="101" transform="rotate(-28 260 195)" />
          <motion.path className="constellation-lines" d="M116 83 L260 195 L405 91 M405 91 L401 302 L260 195 M401 302 L113 307 L116 83" initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: .9, delay: .2 }} />
          <circle cx="260" cy="195" r="4" fill="var(--citron)"/><circle cx="116" cy="83" r="3" fill="var(--violet)"/><circle cx="405" cy="91" r="3" fill="var(--violet)"/><circle cx="401" cy="302" r="3" fill="var(--violet)"/><circle cx="113" cy="307" r="3" fill="var(--violet)"/>
        </svg>
        <div className="constellation-node learn"><BookOpen size={17}/><strong>Learn</strong><small>Build a mental model</small></div>
        <div className="constellation-node recall"><BrainCircuit size={17}/><strong>Recall</strong><small>Retrieve from memory</small></div>
        <div className="constellation-node evaluate"><Target size={17}/><strong>Evaluate</strong><small>Notice what is missing</small></div>
        <div className="constellation-node adapt"><Compass size={17}/><strong>Adapt</strong><small>Choose what is next</small></div>
        <div className="constellation-node center"><Sparkles size={19}/><span className="constellation-center">YOUR<br/>KNOWLEDGE</span></div>
      </motion.div>
    </section>

    <section className="landing-section">
      <div className="landing-section-heading"><p className="eyebrow">A simple loop. A clearer signal.</p><h2>Move from reading to knowing.</h2><p>RecallLoop connects study, practice, and feedback so each session can build on the last.</p></div>
      <div className="loop-cards">{steps.map(({ title, text, Icon }, index) => <motion.article className="loop-card" key={title} initial={reduceMotion ? false : { opacity: 0, y: 9 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .25 }} transition={{ duration: .35, delay: reduceMotion ? 0 : index * .06 }}><span className="loop-card-number">0{index + 1}</span><span className="loop-card-icon"><Icon size={19}/></span><h3>{title}</h3><p>{text}</p></motion.article>)}</div>
    </section>
    <footer className="landing-footer"><span>RecallLoop · Learn with intention. Remember with practice.</span><span><Moon size={14}/> Your theme preference is yours to choose.</span></footer>
  </main>;
}
