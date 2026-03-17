import { useState, useEffect } from "react";
import api from "@/api/client";
import { AuthState, User } from "@/types";

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    token: localStorage.getItem("token"),
    role: localStorage.getItem("role") as AuthState["role"],
    user: null,
  });
  const [loading, setLoading] = useState(!!auth.token);

  useEffect(() => {
    if (auth.token) {
      api
        .get<User>("/api/auth/me")
        .then((res) => setAuth((a) => ({ ...a, user: res.data })))
        .catch(() => logout())
        .finally(() => setLoading(false));
    }
  }, []);

  const login = async (username: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", username);
    form.append("password", password);
    const res = await api.post<{ access_token: string; role: string }>(
      "/api/auth/login",
      form,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const { access_token, role } = res.data;
    localStorage.setItem("token", access_token);
    localStorage.setItem("role", role);
    setAuth({ token: access_token, role: role as AuthState["role"], user: null });
    return role;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setAuth({ token: null, role: null, user: null });
  };

  return { auth, loading, login, logout };
}
