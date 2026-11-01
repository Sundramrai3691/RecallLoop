import { useState } from "react";
import { BookOpen, BrainCircuit, CalendarDays, Compass, LayoutDashboard, LibraryBig, LogOut, Settings, Target } from "lucide-react";
import { motion } from "motion/react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ThemeToggle } from "./theme/ThemeToggle";

const groups = [
  { label: "Workspace", items: [
    { to: "/dashboard", label: "Dashboard", mobileLabel: "Home", Icon: LayoutDashboard, end: true },
    { to: "/study/new", label: "Learn", mobileLabel: "Learn", Icon: BookOpen },
    { to: "/plan/today", label: "Today's plan", mobileLabel: "Plan", Icon: CalendarDays },
    { to: "/goals", label: "Goals", mobileLabel: "Goals", Icon: Target },
  ] },
  { label: "Explore", items: [
    { to: "/knowledge", label: "Knowledge", mobileLabel: "Map", Icon: LibraryBig },
    { to: "/resources", label: "Resources", mobileLabel: "Read", Icon: Compass },
  ] },
  { label: "You", items: [
    { to: "/readiness", label: "My Readiness", mobileLabel: "Ready", Icon: Target },
    { to: "/learner", label: "Learner", mobileLabel: "You", Icon: BrainCircuit },
    { to: "/settings", label: "Settings", mobileLabel: "Prefs", Icon: Settings },
  ] },
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const token = localStorage.getItem("recallloop_token");

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await api.logout();
    } catch {
      // Clearing the client-held token still signs out if the server is unavailable.
    } finally {
      localStorage.removeItem("recallloop_token");
      navigate("/login", { replace: true });
    }
  }

  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar">
      <Link className="wordmark" to="/dashboard" aria-label="RecallLoop home"><span className="wordmark-mark">r</span><span>Recall<span className="wordmark-accent">Loop</span></span></Link>
      <nav aria-label="Primary navigation" className="side-nav">
        {groups.map((group) => <div className="nav-group" key={group.label}>
          <p className="nav-group-label">{group.label}</p>
          {group.items.map(({ to, label, mobileLabel, Icon, end }) => <NavLink key={to} className="nav-link" end={end} to={to}>
            <Icon aria-hidden="true" className="nav-icon" size={17} /><span className="nav-label">{label}</span><span className="nav-mobile-label">{mobileLabel}</span>
          </NavLink>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom"><div className="loop-note"><span className="loop-note-kicker">THE LEARNING LOOP</span><span>Learn <b>→</b> Recall <b>→</b> Adapt</span></div><button className="btn" type="button" onClick={() => void signOut()} disabled={signingOut}><LogOut size={15} aria-hidden="true"/>{signingOut ? "Signing out…" : "Sign out"}</button><ThemeToggle /></div>
    </aside>
    <main className="main-column" id="main-content" tabIndex={-1}><div className="mobile-brand"><Link className="wordmark" to="/dashboard">Recall<span className="wordmark-accent">Loop</span></Link><button className="btn" type="button" onClick={() => void signOut()} disabled={signingOut}><LogOut size={15} aria-hidden="true"/>{signingOut ? "Signing out…" : "Sign out"}</button><ThemeToggle /></div><motion.div className="page-content" key={location.pathname} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }}><Outlet /></motion.div></main>
  </div>;
}
