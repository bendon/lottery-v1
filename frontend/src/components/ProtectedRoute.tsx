import { Navigate } from "react-router-dom";

interface Props {
  children: React.ReactNode;
  role?: "admin" | "presenter";
}

export function ProtectedRoute({ children, role }: Props) {
  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" replace />;
  if (role && userRole !== role) {
    return <Navigate to={userRole === "admin" ? "/admin/dashboard" : "/dashboard"} replace />;
  }

  return <>{children}</>;
}
