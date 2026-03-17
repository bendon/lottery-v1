import { useEffect, useState } from "react";
import api from "@/api/client";
import { User } from "@/types";

export default function AdminUsers() {
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
  const [error, setError] = useState("");

  const load = () =>
    api.get<User[]>("/api/admin/users").then((r) => setUsers(r.data));

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/admin/users", form);
      setShowModal(false);
      setForm({ username: "", email: "", password: "", role: "presenter", user_type: "", organization: "", full_name: "" });
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error creating user");
    }
  };

  const toggleActive = async (user: User) => {
    await api.put(`/api/admin/users/${user.id}`, { is_active: !user.is_active });
    load();
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

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
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
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3 capitalize">{u.role}</td>
                <td className="px-4 py-3 text-gray-500">{u.user_type || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(u)}
                    className="text-xs text-gray-500 hover:text-black underline"
                  >
                    {u.is_active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
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
              {error && <p className="text-red-500 text-xs">{error}</p>}
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
    </div>
  );
}
