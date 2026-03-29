import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Login from "@/pages/Login";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminUsers from "@/pages/admin/Users";
import AdminLotteries from "@/pages/admin/Lotteries";
import AdminPromotions from "@/pages/admin/Promotions";
import AdminTransactions from "@/pages/admin/Transactions";
import AdminSettings from "@/pages/admin/Settings";
import AdminDraws from "@/pages/admin/Draws";
import PresenterDashboard from "@/pages/presenter/Dashboard";
import { homePathForRole } from "@/lib/roles";

export default function App() {
  const role = localStorage.getItem("role");

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Admin routes */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={["admin", "auditor"]}>
              <Layout>
                <Routes>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="lotteries" element={<AdminLotteries />} />
                  <Route path="promotions" element={<AdminPromotions />} />
                  <Route path="draws" element={<AdminDraws />} />
                  <Route path="transactions" element={<AdminTransactions />} />
                  <Route path="settings" element={<AdminSettings />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Presenter routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["presenter"]}>
              <Layout>
                <PresenterDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Root redirect */}
        <Route
          path="/"
          element={<Navigate to={homePathForRole(role)} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
