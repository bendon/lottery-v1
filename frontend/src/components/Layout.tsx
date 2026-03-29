import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Trophy,
  Megaphone,
  ArrowLeftRight,
  Settings,
  LogOut,
  Shuffle,
  Menu,
} from "lucide-react";
import { isStaffReaderRole, roleDisplayLabel } from "@/lib/roles";

const adminNav = [
  { path: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/lotteries", label: "Lotteries", icon: Trophy },
  { path: "/admin/promotions", label: "Promotions", icon: Megaphone },
  { path: "/admin/draws", label: "Draws", icon: Shuffle },
  { path: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight },
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/settings", label: "Settings", icon: Settings },
];

const presenterNav = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

interface Props {
  children: React.ReactNode;
}

function closeDrawerOnNav() {
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
    return true;
  }
  return false;
}

export function Layout({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const role = localStorage.getItem("role");
  const nav = isStaffReaderRole(role) ? adminNav : presenterNav;

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setSidebarOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const handleNavClick = () => {
    if (closeDrawerOnNav()) setSidebarOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-white">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "max-md:-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-gray-200">
          <h1 className="font-bold text-lg">L-Gain Lottery</h1>
          <p className="text-xs text-gray-500">{roleDisplayLabel(role)}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {nav.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={handleNavClick}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                location.pathname === path
                  ? "bg-black text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-5 py-4 text-sm text-gray-600 hover:bg-gray-100 border-t border-gray-200"
        >
          <LogOut size={16} />
          Logout
        </button>
      </aside>

      <div className="flex flex-1 min-w-0 flex-col overflow-auto">
        <header className="sticky top-0 z-20 flex md:hidden items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 shrink-0">
          <button
            type="button"
            aria-label="Open menu"
            className="rounded p-1.5 text-gray-700 hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>
          <span className="font-bold text-sm truncate">L-Gain Lottery</span>
        </header>
        <main className="flex-1 p-4 md:p-6 min-w-0">{children}</main>
        <footer className="border-t border-gray-100 px-4 md:px-6 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[11px] text-gray-400 shrink-0">
          <span>
            © 2026{" "}
            <a
              href="https://edgetech.co.ke"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-600 underline underline-offset-2"
            >
              EdgeTech Consults Ltd.
            </a>{" "}
            All rights reserved.
          </span>
          <span className="shrink-0">System Version 2.04.1</span>
        </footer>
      </div>
    </div>
  );
}
