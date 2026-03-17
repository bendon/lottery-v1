import { useEffect, useState } from "react";
import api from "@/api/client";
import { Promotion, Transaction, Draw } from "@/types";
import { formatAmount, formatDate } from "@/lib/utils";

type Tab = "draw" | "transactions";

type ScheduleStatus = "on_air" | "upcoming" | "ended";

interface MaskedTransaction {
  id: string;
  transaction_number: string;
  payment_type: string;
  amount: number;
  payment_date: string;
  customer_name: string;
  customer_phone: string;
  product_id: string | null;
}

// Dates from API have no timezone suffix → parse as local time (matches how they were entered)
function scheduleStatus(p: Promotion): ScheduleStatus {
  const now = Date.now();
  // "2026-03-05T06:45:00" → local time parse
  const start = new Date(p.start_date).getTime();
  const end = new Date(p.end_date).getTime();
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "on_air";
}

function timeHint(p: Promotion): string {
  const now = Date.now();
  const start = new Date(p.start_date).getTime();
  const end = new Date(p.end_date).getTime();

  const fmt = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
  };

  if (now < start) return `Starts in ${fmt(start - now)}`;
  if (now > end) return `Ended ${fmt(now - end)} ago`;
  return `Ends in ${fmt(end - now)}`;
}

const SCHEDULE_STYLE: Record<ScheduleStatus, string> = {
  on_air: "bg-green-100 text-green-700 border-green-200",
  upcoming: "bg-yellow-100 text-yellow-700 border-yellow-200",
  ended: "bg-gray-100 text-gray-500 border-gray-200",
};

const SCHEDULE_LABEL: Record<ScheduleStatus, string> = {
  on_air: "On Air",
  upcoming: "Upcoming",
  ended: "Ended",
};

function groupByDay(txns: MaskedTransaction[]): { date: string; count: number; total: number }[] {
  const map: Record<string, { count: number; total: number }> = {};
  txns.forEach((t) => {
    const day = t.payment_date.slice(0, 10);
    if (!map[day]) map[day] = { count: 0, total: 0 };
    map[day].count += 1;
    map[day].total += t.amount;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  till: "Till",
  paybill: "Paybill",
  stk_push: "STK Push",
  card: "Card",
};

export default function PresenterDashboard() {
  const [tab, setTab] = useState<Tab>("draw");
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedPromotion, setSelectedPromotion] = useState<string>("");
  const [eligible, setEligible] = useState<Transaction[]>([]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [drawing, setDrawing] = useState(false);
  const [lastDraw, setLastDraw] = useState<Draw | null>(null);
  const [drawError, setDrawError] = useState("");

  const [transactions, setTransactions] = useState<MaskedTransaction[]>([]);
  const [txnLoading, setTxnLoading] = useState(false);

  // Re-compute schedule status every minute so the UI stays current
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    api.get<Promotion[]>("/api/promotions").then((r) => {
      setPromotions(r.data);
      // Auto-select the first "on air" promotion, else the first one
      const onAir = r.data.find((p) => scheduleStatus(p) === "on_air");
      if (onAir) setSelectedPromotion(onAir.id);
      else if (r.data.length > 0) setSelectedPromotion(r.data[0].id);
    });
    api.get("/api/dashboard/stats").then((r) => setStats(r.data));
    api.get<Draw[]>("/api/draws").then((r) => setDraws(r.data));
  }, []);

  useEffect(() => {
    if (!selectedPromotion) return;
    api
      .get<Transaction[]>(`/api/draws/eligible-transactions/${selectedPromotion}`)
      .then((r) => setEligible(r.data))
      .catch(() => setEligible([]));
  }, [selectedPromotion]);

  useEffect(() => {
    if (tab !== "transactions") return;
    setTxnLoading(true);
    const url = selectedPromotion ? `/api/transactions?promotion_id=${selectedPromotion}` : "/api/transactions";
    api
      .get<MaskedTransaction[]>(url)
      .then((r) => setTransactions(r.data))
      .catch(() => setTransactions([]))
      .finally(() => setTxnLoading(false));
  }, [tab, selectedPromotion]);

  const handleDraw = async () => {
    setDrawError("");
    setDrawing(true);
    try {
      const res = await api.post<Draw>("/api/draws", {
        promotion_id: selectedPromotion,
        draw_type: "manual",
      });
      setLastDraw(res.data);
      const [eligibleRes, drawsRes] = await Promise.all([
        api.get<Transaction[]>(`/api/draws/eligible-transactions/${selectedPromotion}`),
        api.get<Draw[]>("/api/draws"),
      ]);
      setEligible(eligibleRes.data);
      setDraws(drawsRes.data);
    } catch (err: any) {
      setDrawError(err.response?.data?.detail || "Draw failed");
    } finally {
      setDrawing(false);
    }
  };

  const selectedPromo = promotions.find((p) => p.id === selectedPromotion);
  const selectedStatus = selectedPromo ? scheduleStatus(selectedPromo) : null;
  const canDraw = selectedStatus === "on_air" && eligible.length > 0 && !drawing;

  const totalAmount = transactions.reduce((s, t) => s + t.amount, 0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = transactions.filter((t) => t.payment_date.startsWith(todayStr)).length;
  const dailyGroups = groupByDay(transactions);
  const maxDayCount = Math.max(...dailyGroups.map((d) => d.count), 1);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Presenter Dashboard</h2>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Active Promotions", value: stats.active_promotions },
            { label: "Total Draws", value: stats.total_draws },
            { label: "Transactions", value: stats.total_transactions },
            { label: "Total Promotions", value: stats.total_promotions },
          ].map((c) => (
            <div key={c.label} className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-2xl font-bold mt-1">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {(["draw", "transactions"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
              tab === t ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "draw" ? "Draw" : "Transactions"}
          </button>
        ))}
      </div>

      {/* ── Draw Tab ── */}
      {tab === "draw" && (
        <>
          <div className="border border-gray-200 rounded-lg p-5 mb-6">
            <h3 className="font-semibold mb-4">Execute Draw</h3>

            {promotions.length === 0 ? (
              <p className="text-sm text-gray-400">No active promotions assigned to you.</p>
            ) : (
              <>
                {/* Promotion selector cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  {promotions.map((p) => {
                    const status = scheduleStatus(p);
                    const hint = timeHint(p);
                    const isSelected = p.id === selectedPromotion;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPromotion(p.id);
                          setLastDraw(null);
                          setDrawError("");
                        }}
                        className={`text-left rounded-lg border-2 px-4 py-3 transition-all ${
                          isSelected
                            ? "border-black bg-gray-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm text-gray-900">{p.name || "Unnamed"}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${SCHEDULE_STYLE[status]}`}
                          >
                            {SCHEDULE_LABEL[status]}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 space-y-0.5">
                          <div>
                            {new Date(p.start_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {" → "}
                            {new Date(p.end_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {" · "}
                            {new Date(p.start_date).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </div>
                          <div className={status === "on_air" ? "text-green-600 font-medium" : ""}>
                            {hint}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Draw action row */}
                {selectedPromo && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {eligible.length} eligible transaction{eligible.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {selectedStatus === "upcoming" && (
                      <span className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded">
                        This promotion hasn't started yet — draws will open at{" "}
                        {new Date(selectedPromo.start_date).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}

                    {selectedStatus === "ended" && (
                      <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded">
                        This promotion has ended — no more draws can be made
                      </span>
                    )}

                    {selectedStatus === "on_air" && eligible.length === 0 && (
                      <span className="text-xs text-gray-400">
                        Waiting for transactions to come in…
                      </span>
                    )}

                    <button
                      onClick={handleDraw}
                      disabled={!canDraw}
                      className="ml-auto bg-black text-white text-sm px-6 py-2 rounded hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {drawing ? "Drawing..." : "Draw Winner"}
                    </button>
                  </div>
                )}

                {drawError && (
                  <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                    {drawError}
                  </div>
                )}

                {lastDraw && (
                  <div className="mt-3 px-4 py-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm font-semibold text-green-800">Winner drawn!</p>
                    <p className="text-lg font-mono font-bold mt-1">{lastDraw.winning_number}</p>
                    {(lastDraw as any).winner && (
                      <p className="text-sm text-green-700 mt-1">{(lastDraw as any).winner.customer_name} · {(lastDraw as any).winner.customer_phone}</p>
                    )}
                    <p className="text-xs text-green-600 mt-0.5">{formatDate(lastDraw.drawn_at)}</p>
                  </div>
                )}

                {selectedStatus === "on_air" && eligible.length > 0 && (
                  <div className="mt-4 border border-gray-100 rounded overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 uppercase">
                      Eligible Transactions
                    </div>
                    <div className="divide-y divide-gray-100 max-h-48 overflow-auto">
                      {eligible.map((t) => (
                        <div key={t.id} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="font-mono text-xs">{t.transaction_number}</span>
                          <span>{t.customer_name || "—"}</span>
                          <span className="text-gray-500">{formatAmount(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <h3 className="font-semibold mb-3">Draw History</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Winning Number</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Drawn At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {draws.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                      No draws yet
                    </td>
                  </tr>
                ) : (
                  draws.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-3 font-mono">{d.winning_number}</td>
                      <td className="px-4 py-3 capitalize">{d.draw_type}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(d.drawn_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Transactions Tab ── */}
      {tab === "transactions" && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Total Entries</p>
              <p className="text-2xl font-bold mt-1">{transactions.length}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Total Value</p>
              <p className="text-2xl font-bold mt-1">{formatAmount(totalAmount)}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">Today's Entries</p>
              <p className="text-2xl font-bold mt-1">{todayCount}</p>
            </div>
          </div>

          {dailyGroups.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-5 mb-6">
              <h3 className="text-sm font-semibold mb-4 text-gray-700">Daily Activity</h3>
              <div className="flex items-end gap-1.5 h-24">
                {dailyGroups.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="relative w-full">
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                        {d.count} entr{d.count !== 1 ? "ies" : "y"} · {formatAmount(d.total)}
                      </div>
                      <div
                        className="w-full bg-black rounded-t"
                        style={{ height: `${Math.max(4, (d.count / maxDayCount) * 80)}px` }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-400 rotate-45 origin-left translate-x-1">
                      {d.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Entry Log</h3>
              <span className="text-xs text-gray-400">Customer details are masked for privacy</span>
            </div>
            {txnLoading ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 uppercase border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left">Ref</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Phone</th>
                    <th className="px-4 py-3 text-left">Channel</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        No transactions yet for your linked lotteries
                      </td>
                    </tr>
                  ) : (
                    transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                          {t.transaction_number}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{t.customer_name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                          {t.customer_phone}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {PAYMENT_TYPE_LABEL[t.payment_type] ?? t.payment_type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium">
                          {formatAmount(t.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">
                          {formatDate(t.payment_date)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
