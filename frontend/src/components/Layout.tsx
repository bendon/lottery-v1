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
} from "lucide-react";

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

export function Layout({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const role = localStorage.getItem("role");
  const nav = role === "admin" ? adminNav : presenterNav;

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-56 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="font-bold text-lg">L-Gain Lottery</h1>
          <p className="text-xs text-gray-500 capitalize">{role}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
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

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-auto">
        <main className="flex-1 p-6">{children}</main>
        <footer className="border-t border-gray-100 px-6 py-3 flex items-center justify-between text-[11px] text-gray-400 shrink-0">
          <span>© 2026 <a href="https://edgetech.co.ke" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 underline underline-offset-2">EdgeTech Consults Ltd.</a> All rights reserved.</span>
          <span>System Version 2.04.1</span>
        </footer>
      </div>
    </div>
  );
}
