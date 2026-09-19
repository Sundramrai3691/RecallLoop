import { Link, NavLink, Outlet } from "react-router-dom";

export function Layout() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="wordmark" to="/dashboard">
          Recall<span>Loop</span>
        </Link>
        <nav className="nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/study/new">New study</NavLink>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
