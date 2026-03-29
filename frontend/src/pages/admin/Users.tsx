import { useEffect, useState } from "react";
import api from "@/api/client";
import { User } from "@/types";
import { useAuth } from "@/hooks/useAuth";

export default function AdminUsers() {
  const { auth } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "presenter",
    user_type: "",
    organization: "",
    full_name: "",
  });
  const [bannerError, setBannerError] = useState("");
  const [createError, setCreateError] = useState("");
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });
  const [passwordError, setPasswordError] = useState("");

  const myId = auth.user?.id;

  const load = () =>
    api.get<User[]>("/api/admin/users").then((r) => setUsers(r.data));

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    try {
      await api.post("/api/admin/users", form);
      setShowModal(false);
      setForm({ username: "", email: "", password: "", role: "presenter", user_type: "", organization: "", full_name: "" });
      load();
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || "Error creating user");
    }
  };

  const toggleActive = async (user: User) => {
    setBannerError("");
    try {
      await api.put(`/api/admin/users/${user.id}`, { is_active: !user.is_active });
      await load();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setBannerError(typeof detail === "string" ? detail : "Could not update user status");
    }
  };

  const submitPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    if (!passwordUser) return;
    if (passwordForm.password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setPasswordError("Passwords do not match");
      return;
    }
    try {
      await api.put(`/api/admin/users/${passwordUser.id}`, { password: passwordForm.password });
      setPasswordUser(null);
      setPasswordForm({ password: "", confirm: "" });
    } catch (err: any) {
      setPasswordError(err.response?.data?.detail || "Failed to set password");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Users</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800"
        >
          Add User
        </button>
      </div>

      {bannerError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {bannerError}
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => {
              const isSelf = myId != null && u.id === myId;
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium">
                    {u.username}
                    {isSelf && (
                      <span className="ml-2 text-[10px] font-normal text-gray-400 normal-case">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3 capitalize">{u.role}</td>
                  <td className="px-4 py-3 text-gray-500">{u.user_type || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordUser(u);
                          setPasswordForm({ password: "", confirm: "" });
                          setPasswordError("");
                        }}
                        className="text-xs text-black hover:underline"
                      >
                        Set password
                      </button>
                      {isSelf ? (
                        <span
                          className="text-xs text-gray-400 cursor-default"
                          title="You cannot deactivate the account you are logged in with. Use another administrator, or change status in the database."
                        >
                          Deactivate unavailable
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleActive(u)}
                          className="text-xs text-gray-500 hover:text-black underline"
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 p-6 w-full max-w-md shadow-lg">
            <h3 className="font-bold mb-4">Add User</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { name: "username", label: "Username", type: "text" },
                { name: "email", label: "Email", type: "email" },
                { name: "password", label: "Password", type: "password" },
                { name: "full_name", label: "Full Name", type: "text" },
                { name: "organization", label: "Organization", type: "text" },
              ].map(({ name, label, type }) => (
                <div key={name}>
                  <label className="block text-xs font-medium mb-1">{label}</label>
                  <input
                    type={type}
                    value={(form as any)[name]}
                    onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                >
                  <option value="presenter">Presenter</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">User Type</label>
                <select
                  value={form.user_type}
                  onChange={(e) => setForm((f) => ({ ...f, user_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                >
                  <option value="">—</option>
                  <option value="radio_station">Radio Station</option>
                  <option value="influencer">Influencer</option>
                  <option value="promoter">Promoter</option>
                </select>
              </div>
              {createError && <p className="text-red-500 text-xs">{createError}</p>}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-black text-white py-2 rounded text-sm hover:bg-gray-800">
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 py-2 rounded text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passwordUser && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6 w-full max-w-md shadow-lg">
            <h3 className="font-bold mb-1">Set password</h3>
            <p className="text-xs text-gray-500 mb-4">
              {passwordUser.username}
              {myId === passwordUser.id ? " — your account" : ""}
            </p>
            <form onSubmit={submitPasswordReset} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">New password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Confirm</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
              {passwordError && <p className="text-red-500 text-xs">{passwordError}</p>}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-black text-white py-2 rounded text-sm hover:bg-gray-800">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setPasswordUser(null); setPasswordError(""); }}
                  className="flex-1 border border-gray-300 py-2 rounded text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
