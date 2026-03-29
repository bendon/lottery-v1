import { Navigate } from "react-router-dom";
import type { AppRole } from "@/types";
import { homePathForRole } from "@/lib/roles";

interface Props {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: Props) {
  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" replace />;
  if (!userRole || !allowedRoles.includes(userRole as AppRole)) {
    return <Navigate to={homePathForRole(userRole)} replace />;
  }

  return <>{children}</>;
}
