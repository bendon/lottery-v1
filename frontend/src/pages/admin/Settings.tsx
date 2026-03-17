import { useEffect, useState } from "react";
import api from "@/api/client";
import { SystemSetting } from "@/types";

export default function AdminSettings() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const load = () =>
    api.get<SystemSetting[]>("/api/admin/settings").then((r) => setSettings(r.data));

  useEffect(() => {
    load();
    api.get<any[]>("/api/admin/setting-types").then((r) => setDefinitions(r.data));
  }, []);

  const save = async (key: string) => {
    await api.put(`/api/admin/settings/${key}`, { value: editValue });
    setEditing(null);
    load();
  };

  const create = async (def: any) => {
    await api.post("/api/admin/settings", {
      key: def.key,
      value: def.default,
      description: def.description,
      category: def.category,
    });
    load();
  };

  const existingKeys = new Set(settings.map((s) => s.key));
  const missing = definitions.filter((d) => !existingKeys.has(d.key));

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">System Settings</h2>

      {missing.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
          <p className="font-medium mb-2">Available defaults not yet saved:</p>
          <div className="flex flex-wrap gap-2">
            {missing.map((d) => (
              <button
                key={d.key}
                onClick={() => create(d)}
                className="text-xs border border-yellow-400 px-2 py-1 rounded hover:bg-yellow-100"
              >
                + {d.key}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Key</th>
              <th className="px-4 py-3 text-left">Value</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {settings.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-mono text-xs">{s.key}</td>
                <td className="px-4 py-3">
                  {editing === s.key ? (
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-32"
                      autoFocus
                    />
                  ) : (
                    <span className="font-mono">{s.value}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{s.description}</td>
                <td className="px-4 py-3">
                  {editing === s.key ? (
                    <div className="flex gap-1">
                      <button onClick={() => save(s.key)} className="text-xs text-black underline">Save</button>
                      <button onClick={() => setEditing(null)} className="text-xs text-gray-400 underline">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditing(s.key); setEditValue(s.value || ""); }}
                      className="text-xs text-gray-500 hover:text-black underline"
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {settings.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No settings. Click defaults above to initialize.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
