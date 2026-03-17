import { useEffect, useState } from "react";
import api from "@/api/client";
import { Lottery } from "@/types";
import { formatAmount } from "@/lib/utils";

// Card and STK Push are supplementary — Till/Paybill are derived from the short code type selection
const EXTRA_PAYMENT_TYPES = ["card", "stk_push"];

const STEPS = [
  { id: 1, label: "Payment Routing" },
  { id: 2, label: "Pricing & Payout" },
  { id: 3, label: "Draw Settings" },
];

const emptyConfig = (l: Lottery) => {
  const isPaybill = !!l.paybill_number && !l.till_number;
  return {
    description: l.description || "",
    lottery_type: l.lottery_type,
    short_code_type: isPaybill ? "paybill" : "till",
    short_code: l.till_number || l.paybill_number || "",
    api_integration_id: "",
    // payment_types: primary type auto-synced; store only extra types
    extra_payment_types: (l.payment_types || []).filter((t) => EXTRA_PAYMENT_TYPES.includes(t)),
    payout_amount: l.payout_amount ? String(l.payout_amount / 100) : "",
    payout_percentage: "",
    settings: {
      min_amount: (l.settings as any)?.min_amount || "",
      date_from: (l.settings as any)?.date_from || "",
      date_to: (l.settings as any)?.date_to || "",
    },
  };
};

type ConfigForm = ReturnType<typeof emptyConfig>;

export default function AdminLotteries() {
  const [lotteries, setLotteries] = useState<Lottery[]>([]);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "", lottery_type: "random_pick" });
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

  // --- Create ---
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    try {
      await api.post("/api/admin/lotteries", createForm);
      setShowCreate(false);
      setCreateForm({ name: "", description: "", lottery_type: "random_pick" });
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

  const toggleExtraType = (type: string) => {
    setConfigForm((f) => {
      if (!f) return f;
      const has = f.extra_payment_types.includes(type);
      return {
        ...f,
        extra_payment_types: has
          ? f.extra_payment_types.filter((t) => t !== type)
          : [...f.extra_payment_types, type],
      };
    });
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

      const isTill = configForm.short_code_type === "till";
      const payment_types = [configForm.short_code_type, ...configForm.extra_payment_types];

      await api.put(`/api/admin/lotteries/${configLottery.id}`, {
        description: configForm.description || null,
        lottery_type: configForm.lottery_type,
        till_number: isTill ? configForm.short_code || null : null,
        paybill_number: !isTill ? configForm.short_code || null : null,
        api_integration_id: configForm.api_integration_id || null,
        payment_types,
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
        <button
          onClick={() => setShowCreate(true)}
          className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800"
        >
          New Lottery
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
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
                <td className="px-4 py-3 capitalize text-gray-600">{l.lottery_type.replace("_", " ")}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {l.till_number || l.paybill_number || <span className="text-gray-300 italic">not set</span>}
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
                  <div className="flex gap-3">
                    <button onClick={() => openConfig(l)} className="text-xs text-black underline hover:text-gray-600">
                      Configure
                    </button>
                    <button onClick={() => toggleActive(l)} className="text-xs text-gray-400 underline hover:text-black">
                      {l.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
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
            <p className="text-xs text-gray-400 mb-4">Configure payment details after creation.</p>
            <form onSubmit={handleCreate} className="space-y-3">
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
                  onChange={(e) => setCreateForm((f) => ({ ...f, lottery_type: e.target.value }))}
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

              {/* Step 1 — Payment Routing */}
              {configStep === 1 && (
                <div className="space-y-5">
                  <p className="text-xs text-gray-500">
                    M-Pesa uses a single Business Short Code for both Till and Paybill. Select the type, then enter the shared number.
                  </p>

                  {/* Till vs Paybill toggle */}
                  <div>
                    <label className="block text-xs font-medium mb-2">Short Code Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["till", "paybill"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setConfigForm((f) => f ? { ...f, short_code_type: type } : f)}
                          className={`flex flex-col items-start px-4 py-3 rounded-lg border text-left transition-colors ${
                            configForm.short_code_type === type
                              ? "border-black bg-black text-white"
                              : "border-gray-200 hover:border-gray-400 text-gray-700"
                          }`}
                        >
                          <span className="text-sm font-semibold capitalize">{type}</span>
                          <span className={`text-xs mt-0.5 ${configForm.short_code_type === type ? "text-gray-300" : "text-gray-400"}`}>
                            {type === "till"
                              ? "Simple payment, no account ref"
                              : "Supports account reference numbers"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Single short code field */}
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Business Short Code
                    </label>
                    <input
                      value={configForm.short_code}
                      onChange={(e) => setConfigForm((f) => f ? { ...f, short_code: e.target.value } : f)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                      placeholder={configForm.short_code_type === "till" ? "e.g. 123456" : "e.g. 400200"}
                    />
                    {configForm.short_code_type === "paybill" && (
                      <p className="text-xs text-gray-400 mt-1">
                        Players send to this Paybill and use their account reference (e.g. phone or ID) as the account number.
                      </p>
                    )}
                  </div>

                  {/* API Integration ID */}
                  <div>
                    <label className="block text-xs font-medium mb-1">API Integration ID <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      value={configForm.api_integration_id}
                      onChange={(e) => setConfigForm((f) => f ? { ...f, api_integration_id: e.target.value } : f)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                      placeholder="For third-party integrations"
                    />
                  </div>

                  {/* Additional payment channels */}
                  <div>
                    <label className="block text-xs font-medium mb-1">Also accept via</label>
                    <p className="text-xs text-gray-400 mb-2">
                      {configForm.short_code_type === "till" ? "Till" : "Paybill"} is already included. Enable additional channels below.
                    </p>
                    <div className="flex gap-2">
                      {EXTRA_PAYMENT_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleExtraType(type)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            configForm.extra_payment_types.includes(type)
                              ? "bg-black text-white border-black"
                              : "border-gray-300 text-gray-600 hover:border-gray-400"
                          }`}
                        >
                          {type === "stk_push" ? "STK Push" : "Card"}
                        </button>
                      ))}
                    </div>
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
                      value={configForm.settings.min_amount}
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
                      value={configForm.settings.date_from}
                      onChange={(e) => setConfigForm((f) => f ? { ...f, settings: { ...f.settings, date_from: e.target.value } } : f)}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Eligible Transactions Until</label>
                    <input
                      type="datetime-local"
                      value={configForm.settings.date_to}
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
