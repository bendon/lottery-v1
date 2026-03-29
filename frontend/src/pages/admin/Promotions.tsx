import { useEffect, useState } from "react";
import api from "@/api/client";
import { Promotion, User, Lottery } from "@/types";
import { formatDate } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_META: Record<
  string,
  { label: string; color: string; hasOrg: boolean; orgLabel: string; orgPlaceholder: string; description: string }
> = {
  radio_station: {
    label: "Radio Station",
    color: "bg-purple-100 text-purple-700",
    hasOrg: true,
    orgLabel: "Station Name",
    orgPlaceholder: "e.g. XYZ FM 98.4",
    description: "A broadcast radio station running on-air promotions",
  },
  ad_agency: {
    label: "Ad Agency",
    color: "bg-blue-100 text-blue-700",
    hasOrg: true,
    orgLabel: "Agency Name",
    orgPlaceholder: "e.g. MediaBridge Africa Ltd",
    description: "An advertising agency managing campaigns on behalf of clients",
  },
  influencer: {
    label: "Influencer",
    color: "bg-pink-100 text-pink-700",
    hasOrg: false,
    orgLabel: "",
    orgPlaceholder: "",
    description: "An independent content creator or social media personality",
  },
  promoter: {
    label: "Promoter",
    color: "bg-orange-100 text-orange-700",
    hasOrg: false,
    orgLabel: "",
    orgPlaceholder: "",
    description: "An individual promoter running their own campaigns",
  },
};

const OPERATOR_TYPES = Object.keys(TYPE_META);

function effectiveStatus(p: Promotion): "upcoming" | "active" | "ended" | "cancelled" {
  if (p.status === "cancelled") return "cancelled";
  const now = Date.now();
  const start = new Date(p.start_date).getTime();
  const end = new Date(p.end_date).getTime();
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "active";
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  upcoming: "bg-yellow-100 text-yellow-700",
  ended: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-600",
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  ...OPERATOR_TYPES.map((k) => ({ key: k, label: TYPE_META[k].label + "s" })),
];

function lotteryUsesPaybill(l: Lottery | undefined): boolean {
  return !!(l?.payment_types ?? []).includes("paybill");
}

// ─── Create Operator Modal ────────────────────────────────────────────────────

type OperatorForm = {
  user_type: string;
  // org fields
  organization: string;
  // account fields
  full_name: string;
  username: string;
  email: string;
  password: string;
};

const emptyOperatorForm = (): OperatorForm => ({
  user_type: "",
  organization: "",
  full_name: "",
  username: "",
  email: "",
  password: "",
});

interface CreateOperatorModalProps {
  onClose: () => void;
  onCreated: (user: User) => void;
}

function CreateOperatorModal({ onClose, onCreated }: CreateOperatorModalProps) {
  const [step, setStep] = useState<"type" | "details">("type");
  const [form, setForm] = useState<OperatorForm>(emptyOperatorForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const meta = form.user_type ? TYPE_META[form.user_type] : null;

  const selectType = (t: string) => {
    setForm({ ...emptyOperatorForm(), user_type: t });
    setStep("details");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        username: form.username,
        email: form.email,
        password: form.password,
        role: "presenter",
        user_type: form.user_type,
        full_name: form.full_name,
      };
      if (meta?.hasOrg && form.organization) {
        payload.organization = form.organization;
      }
      const res = await api.post<User>("/api/admin/users", payload);
      onCreated(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error creating operator");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-bold text-base">Add Operator</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === "type" ? "Choose the type of operator" : `Setting up a ${meta?.label}`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
            ✕
          </button>
        </div>

        {/* Step: Type Selection */}
        {step === "type" && (
          <div className="p-6 grid grid-cols-2 gap-3">
            {OPERATOR_TYPES.map((t) => {
              const m = TYPE_META[t];
              return (
                <button
                  key={t}
                  onClick={() => selectType(t)}
                  className="text-left border border-gray-200 rounded-xl p-4 hover:border-black hover:shadow-sm transition-all group"
                >
                  <span
                    className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium mb-2 ${m.color}`}
                  >
                    {m.label}
                  </span>
                  <p className="text-xs text-gray-500 leading-snug">{m.description}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Step: Details */}
        {step === "details" && meta && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Back link */}
            <button
              type="button"
              onClick={() => { setStep("type"); setError(""); }}
              className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1"
            >
              ← Change type
            </button>

            {/* Organization section (only for types that have orgs) */}
            {meta.hasOrg && (
              <section>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  {meta.label} Details
                </h4>
                <div>
                  <label className="block text-xs font-medium mb-1">{meta.orgLabel} *</label>
                  <input
                    required
                    value={form.organization}
                    onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                    placeholder={meta.orgPlaceholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                  />
                </div>
              </section>
            )}

            {/* Account / Contact section */}
            <section>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                {meta.hasOrg ? "Contact Person / Account" : "Personal Details"}
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {meta.hasOrg ? "Contact Name" : "Full Name"} *
                  </label>
                  <input
                    required
                    value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                    placeholder={meta.hasOrg ? "e.g. John Kamau (station manager)" : "e.g. Brian Omondi"}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Username *</label>
                    <input
                      required
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                      placeholder="e.g. xyzfm_john"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Email *</label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="john@xyzfm.co.ke"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Temporary Password *</label>
                  <input
                    required
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="They can change this on first login"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                  />
                </div>
              </div>
            </section>

            {error && <p className="text-red-500 text-xs">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-black text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
              >
                {saving ? "Creating..." : `Create ${meta.label}`}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [lotteries, setLotteries] = useState<Lottery[]>([]);

  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showOperatorModal, setShowOperatorModal] = useState(false);

  const [filterTab, setFilterTab] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [form, setForm] = useState({
    user_id: "",
    lottery_id: "",
    name: "",
    account_number: "",
    start_date: "",
    end_date: "",
  });
  const [presenterTypeFilter, setPresenterTypeFilter] = useState("all");
  const [error, setError] = useState("");

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const lotteryMap = Object.fromEntries(lotteries.map((l) => [l.id, l]));
  const selectedLotteryForForm = form.lottery_id ? lotteryMap[form.lottery_id] : undefined;
  const showPaybillAccountField = lotteryUsesPaybill(selectedLotteryForForm);

  const loadUsers = () =>
    api.get<User[]>("/api/admin/users").then((r) => setUsers(r.data));

  const load = () =>
    api.get<Promotion[]>("/api/admin/promotions").then((r) => setPromotions(r.data));

  useEffect(() => {
    load();
    loadUsers();
    api.get<Lottery[]>("/api/admin/lotteries").then((r) => setLotteries(r.data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/admin/promotions", form);
      setShowPromoModal(false);
      setForm({ user_id: "", lottery_id: "", name: "", account_number: "", start_date: "", end_date: "" });
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error creating promotion");
    }
  };

  const handleOperatorCreated = async (newUser: User) => {
    await loadUsers();
    setForm((f) => ({ ...f, user_id: newUser.id }));
    setPresenterTypeFilter(newUser.user_type ?? "all");
    setShowOperatorModal(false);
  };

  const cancelPromo = async (p: Promotion) => {
    await api.put(`/api/admin/promotions/${p.id}`, { status: "cancelled" });
    load();
  };

  const filtered = promotions.filter((p) => {
    const user = userMap[p.user_id];
    const typeOk = filterTab === "all" || user?.user_type === filterTab;
    const status = effectiveStatus(p);
    const statusOk = filterStatus === "all" || status === filterStatus;
    return typeOk && statusOk;
  });

  const availablePresenters = users.filter(
    (u) =>
      u.role === "presenter" &&
      (presenterTypeFilter === "all" || u.user_type === presenterTypeFilter)
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Promotions</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Campaigns run by radio stations, agencies, influencers, and promoters
          </p>
        </div>
        <button
          onClick={() => setShowPromoModal(true)}
          className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800"
        >
          + New Promotion
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                filterTab === tab.key
                  ? "bg-white text-black shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-700"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="upcoming">Upcoming</option>
          <option value="ended">Ended</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} promotion{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Promotion</th>
              <th className="px-4 py-3 text-left">Operator</th>
              <th className="px-4 py-3 text-left">Lottery</th>
              <th className="px-4 py-3 text-left">Schedule</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No promotions found
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const user = userMap[p.user_id];
              const lottery = lotteryMap[p.lottery_id];
              const status = effectiveStatus(p);
              const meta = user?.user_type ? TYPE_META[user.user_type] : null;
              return (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-gray-900">{p.name || "—"}</span>
                      {p.account_number && (
                        <span className="text-[10px] text-gray-500 font-mono">Account: {p.account_number}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {user ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {user.full_name || user.username}
                          </span>
                          {meta && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.color}`}>
                              {meta.label}
                            </span>
                          )}
                        </div>
                        {user.organization && (
                          <span className="text-xs text-gray-400">{user.organization}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lottery ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-800">{lottery.name}</span>
                        <span className="text-[10px] text-gray-400 uppercase">{lottery.lottery_type}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    <div>{formatDate(p.start_date)}</div>
                    <div className="text-gray-400">→ {formatDate(p.end_date)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLE[status]}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.status !== "cancelled" && status !== "ended" && (
                      <button
                        onClick={() => cancelPromo(p)}
                        className="text-xs text-red-500 hover:text-red-700 underline"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Create Promotion Modal ── */}
      {showPromoModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="font-bold text-base">New Promotion</h3>
                <p className="text-xs text-gray-500 mt-0.5">Assign an operator to run draws for a lottery</p>
              </div>
              <button
                onClick={() => { setShowPromoModal(false); setError(""); }}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Operator selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium">Operator *</label>
                  <button
                    type="button"
                    onClick={() => setShowOperatorModal(true)}
                    className="text-xs text-black font-medium border border-gray-300 rounded px-2 py-0.5 hover:bg-gray-50"
                  >
                    + Add Operator
                  </button>
                </div>

                {/* Type filter */}
                <div className="flex gap-1 bg-gray-100 rounded-md p-0.5 mb-2">
                  {["all", ...OPERATOR_TYPES].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPresenterTypeFilter(t)}
                      className={`flex-1 text-[10px] py-1 rounded font-medium transition-colors ${
                        presenterTypeFilter === t ? "bg-white text-black shadow-sm" : "text-gray-500"
                      }`}
                    >
                      {t === "all" ? "All" : TYPE_META[t].label}
                    </button>
                  ))}
                </div>

                {availablePresenters.length === 0 ? (
                  <div className="border border-dashed border-gray-300 rounded-lg px-4 py-4 text-center">
                    <p className="text-xs text-gray-500 mb-2">No operators found</p>
                    <button
                      type="button"
                      onClick={() => setShowOperatorModal(true)}
                      className="text-xs bg-black text-white px-3 py-1.5 rounded hover:bg-gray-800"
                    >
                      + Add Operator
                    </button>
                  </div>
                ) : (
                  <select
                    required
                    value={form.user_id}
                    onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                  >
                    <option value="">Select operator...</option>
                    {availablePresenters.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.username}
                        {u.organization ? ` — ${u.organization}` : ""}
                        {u.user_type ? ` (${TYPE_META[u.user_type]?.label ?? u.user_type})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Lottery */}
              <div>
                <label className="block text-xs font-medium mb-1">Lottery *</label>
                <select
                  required
                  value={form.lottery_id}
                  onChange={(e) => setForm((f) => ({ ...f, lottery_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                >
                  <option value="">Select lottery...</option>
                  {lotteries.filter((l) => l.is_active).map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium mb-1">Promotion Name</label>
                <input
                  placeholder="e.g. Morning Drive Lottery, Ramadhan Giveaway"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                />
              </div>

              {showPaybillAccountField ? (
                <div>
                  <label className="block text-xs font-medium mb-1">Paybill Account Number</label>
                  <input
                    placeholder="e.g. MORNING, EVENING (customers enter this when paying)"
                    value={form.account_number}
                    onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-black"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    BillRefNumber — unique per promotion for the same Paybill lottery
                  </p>
                </div>
              ) : selectedLotteryForForm ? (
                <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2.5">
                  <p className="text-xs text-amber-900 font-medium">Till lottery</p>
                  <p className="text-[10px] text-amber-800/90 mt-1 leading-snug">
                    Only one active promotion at a time per Till lottery. Paybill account numbers do not apply; all
                    Till and STK payments on this short code are attributed to the current active promotion.
                  </p>
                </div>
              ) : null}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Start *</label>
                  <input
                    required
                    type="datetime-local"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">End *</label>
                  <input
                    required
                    type="datetime-local"
                    value={form.end_date}
                    min={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 bg-black text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-900"
                >
                  Create Promotion
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPromoModal(false); setError(""); }}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create Operator Modal (independent, on top) ── */}
      {showOperatorModal && (
        <CreateOperatorModal
          onClose={() => setShowOperatorModal(false)}
          onCreated={handleOperatorCreated}
        />
      )}
    </div>
  );
}
