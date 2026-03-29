import { useEffect, useState } from "react";
import api from "@/api/client";
import { Lottery } from "@/types";
import { formatAmount } from "@/lib/utils";
import { canMutateAdmin } from "@/lib/roles";

const DEMO_PAYBILL = "174379";

const STEPS = [
  { id: 1, label: "Payment Source" },
  { id: 2, label: "Pricing & Payout" },
  { id: 3, label: "Draw Settings" },
];

interface ConfigForm {
  description: string;
  lottery_type: string;
  payout_amount: string;
  payout_percentage: string;
  settings: { min_amount: string; date_from: string; date_to: string };
}

const emptyConfig = (l: Lottery): ConfigForm => ({
  description: l.description || "",
  lottery_type: l.lottery_type,
  payout_amount: l.payout_amount ? String(l.payout_amount / 100) : "",
  payout_percentage: "",
  settings: {
    min_amount: String((l.settings as Record<string, unknown>)?.["min_amount"] ?? ""),
    date_from: String((l.settings as Record<string, unknown>)?.["date_from"] ?? ""),
    date_to: String((l.settings as Record<string, unknown>)?.["date_to"] ?? ""),
  },
});

export default function AdminLotteries() {
  const canMutate = canMutateAdmin(localStorage.getItem("role"));
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [mpesaActive, setMpesaActive] = useState<boolean | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<{ name: string; description: string; lottery_type: "random_pick" | "sequential"; is_demo: boolean }>({ name: "", description: "", lottery_type: "random_pick", is_demo: false });
  const [createError, setCreateError] = useState("");

  // Configure multi-step modal
  const [configLottery, setConfigLottery] = useState<Lottery | null>(null);
  const [configForm, setConfigForm] = useState<ConfigForm | null>(null);
  const [configStep, setConfigStep] = useState(1);
  const [configError, setConfigError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.get<Lottery[]>("/api/admin/lotteries").then((r) => setLotteries(r.data));

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (showCreate)
      api.get<{ active: boolean }>("/api/admin/mpesa/status").then((r) => setMpesaActive(r.data.active)).catch(() => setMpesaActive(false));
  }, [showCreate]);

  // --- Create ---
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!createForm.is_demo && !mpesaActive) {
      setCreateError("Configure M-Pesa in Settings first, or use Demo mode.");
      return;
    }
    try {
      await api.post("/api/admin/lotteries", createForm);
      setShowCreate(false);
      setCreateForm({ name: "", description: "", lottery_type: "random_pick", is_demo: false });
      load();
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || "Error creating lottery");
    }
  };

  // --- Configure ---
  const openConfig = (l: Lottery) => {
    setConfigLottery(l);
    setConfigForm(emptyConfig(l));
    setConfigStep(1);
    setConfigError("");
  };

  const closeConfig = () => {
    setConfigLottery(null);
    setConfigForm(null);
  };

  const handleSave = async () => {
    if (!configLottery || !configForm) return;
    setSaving(true);
    setConfigError("");
    try {
      const settings: Record<string, any> = {};
      if (configForm.settings.min_amount) settings.min_amount = Number(configForm.settings.min_amount);
      if (configForm.settings.date_from) settings.date_from = configForm.settings.date_from;
      if (configForm.settings.date_to) settings.date_to = configForm.settings.date_to;

      await api.put(`/api/admin/lotteries/${configLottery.id}`, {
        description: configForm.description || null,
        lottery_type: configForm.lottery_type,
        payout_amount: configForm.payout_amount ? Math.round(parseFloat(configForm.payout_amount) * 100) : null,
        payout_percentage: configForm.payout_percentage ? parseFloat(configForm.payout_percentage) : null,
        settings,
      });
      closeConfig();
      load();
    } catch (err: any) {
      setConfigError(err.response?.data?.detail || "Error saving configuration");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (l: Lottery) => {
    await api.put(`/api/admin/lotteries/${l.id}`, { is_active: !l.is_active });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Lotteries</h2>
        {canMutate && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800"
          >
            New Lottery
          </button>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Payment ID</th>
              <th className="px-4 py-3 text-left">Payout</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lotteries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No lotteries yet</td>
              </tr>
            )}
            {lotteries.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{l.name}</p>
                  {l.description && <p className="text-xs text-gray-400 mt-0.5">{l.description}</p>}
                </td>
                <td className="px-4 py-3 capitalize text-gray-600">
                  {l.lottery_type.replace("_", " ")}
                  {l.is_demo && <span className="ml-1 text-xs text-amber-600">(Demo)</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {l.till_display_number && l.till_number ? (
                    <span className="flex flex-col gap-0.5">
                      <span title="Customer Till">Till {l.till_display_number}</span>
                      <span className="text-[10px] text-gray-400" title="Daraja short code">
                        API {l.till_number}
                      </span>
                    </span>
                  ) : (
                    l.till_number || l.paybill_number || <span className="text-gray-300 italic">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {l.payout_amount ? formatAmount(l.payout_amount) : <span className="text-gray-300 italic">not set</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${l.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {l.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {canMutate ? (
                    <div className="flex gap-3">
                      <button onClick={() => openConfig(l)} className="text-xs text-black underline hover:text-gray-600">
                        Configure
                      </button>
                      <button onClick={() => toggleActive(l)} className="text-xs text-gray-400 underline hover:text-black">
                        {l.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Create Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border p-6 w-full max-w-sm shadow-lg">
            <h3 className="font-bold mb-1">New Lottery</h3>
            <p className="text-xs text-gray-400 mb-4">All lotteries use M-Pesa. Demo mode for showcase.</p>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-2">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateForm((f) => ({ ...f, is_demo: true }))}
                    className={`flex flex-col items-start px-4 py-3 rounded-lg border text-left transition-colors ${
                      createForm.is_demo ? "border-black bg-black text-white" : "border-gray-200 hover:border-gray-400 text-gray-700"
                    }`}
                  >
                    <span className="text-sm font-semibold">Demo</span>
                    <span className={`text-xs mt-0.5 ${createForm.is_demo ? "text-gray-300" : "text-gray-400"}`}>
                      Paybill 174379 (showcase)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateForm((f) => ({ ...f, is_demo: false }))}
                    className={`flex flex-col items-start px-4 py-3 rounded-lg border text-left transition-colors ${
                      !createForm.is_demo ? "border-black bg-black text-white" : "border-gray-200 hover:border-gray-400 text-gray-700"
                    }`}
                  >
                    <span className="text-sm font-semibold">Live</span>
                    <span className={`text-xs mt-0.5 ${!createForm.is_demo ? "text-gray-300" : "text-gray-400"}`}>
                      Uses configured M-Pesa
                    </span>
                  </button>
                </div>
                {!createForm.is_demo && mpesaActive === false && (
                  <p className="text-xs text-amber-600 mt-2">Configure M-Pesa in Settings first.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Name *</label>
                <input
                  required
                  autoFocus
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="e.g. Weekend Draw"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Draw Type</label>
                <select
                  value={createForm.lottery_type}
                  onChange={(e) => setCreateForm((f) => ({ ...f, lottery_type: e.target.value as "random_pick" | "sequential" }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                >
                  <option value="random_pick">Random Pick</option>
                  <option value="sequential">Sequential (oldest first)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  rows={2}
                  placeholder="Optional"
                />
              </div>
              {createError && <p className="text-red-500 text-xs">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 bg-black text-white py-2 rounded text-sm">Create</button>
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-gray-300 py-2 rounded text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Configure Multi-step Modal ── */}
      {configLottery && configForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border shadow-lg w-full max-w-md flex flex-col" style={{ maxHeight: "88vh" }}>

            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold">{configLottery.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Step {configStep} of {STEPS.length} — {STEPS[configStep - 1].label}</p>
                </div>
                <button onClick={closeConfig} className="text-gray-400 hover:text-black text-lg leading-none">×</button>
              </div>

              {/* Step indicators */}
              <div className="flex gap-1.5">
                {STEPS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setConfigStep(s.id)}
                    className="flex-1 group flex flex-col items-center gap-1"
                  >
                    <div className={`h-1 w-full rounded-full transition-colors ${
                      configStep >= s.id ? "bg-black" : "bg-gray-200"
                    }`} />
                    <span className={`text-xs ${configStep === s.id ? "text-black font-medium" : "text-gray-400"}`}>
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* Step 1 — Payment Source (read-only, from M-Pesa config or Demo) */}
              {configStep === 1 && (
                <div className="space-y-5">
                  <p className="text-xs text-gray-500">
                    Payment is tied to M-Pesa. Demo lotteries use the showcase paybill; live lotteries use the configured M-Pesa from Settings.
                  </p>
                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <p className="text-xs font-medium text-gray-500 mb-1">Payment Source</p>
                    <p className="font-mono text-sm font-semibold">
                      {configLottery.is_demo ? (
                        <>Demo Paybill: {DEMO_PAYBILL}</>
                      ) : configLottery.till_display_number && configLottery.till_number ? (
                        <span className="block text-left">
                          <span className="block">Till (on-air): {configLottery.till_display_number}</span>
                          <span className="block text-xs text-gray-500 font-normal mt-1 normal-case">
                            API short code: {configLottery.till_number}
                          </span>
                        </span>
                      ) : (
                        <>{configLottery.till_number || configLottery.paybill_number || "—"} (from Settings)</>
                      )}
                    </p>
                    {configLottery.is_demo && (
                      <p className="text-xs text-amber-600 mt-2">For showcasing only. Configure M-Pesa in Settings for live payments.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2 — Pricing & Payout */}
              {configStep === 2 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Set the prize amount or percentage, and the minimum transaction amount that qualifies for a draw.
                  </p>
                  <div>
                    <label className="block text-xs font-medium mb-1">Payout Amount (KES)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={configForm.payout_amount}
                      onChange={(e) => setConfigForm((f) => f ? { ...f, payout_amount: e.target.value } : f)}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                      placeholder="e.g. 5000"
                    />
                    <p className="text-xs text-gray-400 mt-1">Fixed amount paid out to the winner.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Payout Percentage (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={configForm.payout_percentage}
                      onChange={(e) => setConfigForm((f) => f ? { ...f, payout_percentage: e.target.value } : f)}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                      placeholder="e.g. 50"
                    />
                    <p className="text-xs text-gray-400 mt-1">Percentage of the pot paid to the winner. Overrides fixed amount if set.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Minimum Entry Amount (KES)</label>
                    <input
                      type="number"
                      value={configForm.settings.min_amount ?? ""}
                      onChange={(e) => setConfigForm((f) => f ? { ...f, settings: { ...f.settings, min_amount: e.target.value } } : f)}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                      placeholder="e.g. 50"
                    />
                    <p className="text-xs text-gray-400 mt-1">Transactions below this amount are not eligible for draws.</p>
                  </div>
                </div>
              )}

              {/* Step 3 — Draw Settings */}
              {configStep === 3 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Define the draw method and the window of eligible transactions.
                  </p>
                  <div>
                    <label className="block text-xs font-medium mb-1">Draw Type</label>
                    <select
                      value={configForm.lottery_type}
                      onChange={(e) => setConfigForm((f) => f ? { ...f, lottery_type: e.target.value } : f)}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    >
                      <option value="random_pick">Random Pick — winner chosen at random</option>
                      <option value="sequential">Sequential — oldest transaction wins</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Eligible Transactions From</label>
                    <input
                      type="datetime-local"
                      value={configForm.settings.date_from ?? ""}
                      onChange={(e) => setConfigForm((f) => f ? { ...f, settings: { ...f.settings, date_from: e.target.value } } : f)}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Eligible Transactions Until</label>
                    <input
                      type="datetime-local"
                      value={configForm.settings.date_to ?? ""}
                      onChange={(e) => setConfigForm((f) => f ? { ...f, settings: { ...f.settings, date_to: e.target.value } } : f)}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Description</label>
                    <textarea
                      value={configForm.description}
                      onChange={(e) => setConfigForm((f) => f ? { ...f, description: e.target.value } : f)}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                      rows={2}
                      placeholder="Optional notes about this lottery"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer navigation */}
            <div className="px-6 py-4 border-t border-gray-100">
              {configError && <p className="text-red-500 text-xs mb-3">{configError}</p>}
              <div className="flex gap-2">
                {configStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setConfigStep((s) => s - 1)}
                    className="flex-1 border border-gray-300 py-2 rounded text-sm hover:bg-gray-50"
                  >
                    Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeConfig}
                    className="flex-1 border border-gray-300 py-2 rounded text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}

                {configStep < STEPS.length ? (
                  <button
                    type="button"
                    onClick={() => setConfigStep((s) => s + 1)}
                    className="flex-1 bg-black text-white py-2 rounded text-sm hover:bg-gray-800"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-black text-white py-2 rounded text-sm hover:bg-gray-800 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Configuration"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
