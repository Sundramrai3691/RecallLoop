import {
  BookOpen,
  BrainCircuit,
  CalendarDays,
  LayoutDashboard,
  LibraryBig,
  Target,
} from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "./theme/ThemeToggle";

export function Layout() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="wordmark" to="/dashboard">
          Recall<span>Loop</span>
        </Link>
        <nav aria-label="Primary navigation" className="nav">
          <NavLink className="nav-link" end to="/dashboard">
            <LayoutDashboard
              aria-hidden="true"
              className="nav-icon"
              size={17}
            />
            <span>Dashboard</span>
          </NavLink>
          <NavLink className="nav-link" to="/study/new">
            <BookOpen aria-hidden="true" className="nav-icon" size={17} />
            <span>New study</span>
          </NavLink>
          <NavLink className="nav-link" to="/goals">
            <Target aria-hidden="true" className="nav-icon" size={17} />
            <span>Goals</span>
          </NavLink>
          <NavLink className="nav-link" to="/plan">
            <CalendarDays aria-hidden="true" className="nav-icon" size={17} />
            <span>Today&apos;s plan</span>
          </NavLink>
          <NavLink className="nav-link" to="/learner">
            <BrainCircuit aria-hidden="true" className="nav-icon" size={17} />
            <span>Learner</span>
          </NavLink>
          <NavLink className="nav-link" to="/knowledge">
            <LibraryBig aria-hidden="true" className="nav-icon" size={17} />
            <span>Knowledge</span>
          </NavLink>
        </nav>
        <ThemeToggle />
      </header>
      <Outlet />
    </div>
  );
}
