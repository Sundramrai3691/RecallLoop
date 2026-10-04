import { BookOpen, BrainCircuit, CalendarDays, Compass, LayoutDashboard, LibraryBig, Settings, Target } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "./theme/ThemeToggle";

const groups = [
  { label: "Workspace", items: [
    { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, end: true },
    { to: "/study/new", label: "New study", Icon: BookOpen },
    { to: "/plan/today", label: "Today's plan", Icon: CalendarDays },
    { to: "/goals", label: "Goals", Icon: Target },
  ] },
  { label: "Explore", items: [
    { to: "/knowledge", label: "Knowledge", Icon: LibraryBig },
    { to: "/resources", label: "Resources", Icon: Compass },
  ] },
  { label: "You", items: [
    { to: "/learner", label: "Learner", Icon: BrainCircuit },
    { to: "/settings", label: "Settings", Icon: Settings },
  ] },
];

export function Layout() {
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="wordmark" to="/dashboard" aria-label="RecallLoop home"><span className="wordmark-mark">r</span><span>Recall<span className="wordmark-accent">Loop</span></span></Link>
      <nav aria-label="Primary navigation" className="side-nav">
        {groups.map((group) => <div className="nav-group" key={group.label}>
          <p className="nav-group-label">{group.label}</p>
          {group.items.map(({ to, label, Icon, end }) => <NavLink key={to} className="nav-link" end={end} to={to}>
            <Icon aria-hidden="true" className="nav-icon" size={17} /><span>{label}</span>
          </NavLink>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom"><div className="loop-note"><span className="loop-note-kicker">THE LEARNING LOOP</span><span>Learn <b>→</b> Recall <b>→</b> Adapt</span></div><ThemeToggle /></div>
    </aside>
    <main className="main-column"><div className="mobile-brand"><Link className="wordmark" to="/dashboard">Recall<span className="wordmark-accent">Loop</span></Link><ThemeToggle /></div><div className="page-content"><Outlet /></div></main>
  </div>;
}
