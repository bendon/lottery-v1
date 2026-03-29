import { useEffect, useState } from "react";
import api from "@/api/client";
import { Draw, Promotion, Lottery, User } from "@/types";
import { formatAmount, formatDate } from "@/lib/utils";
import { canMutateAdmin } from "@/lib/roles";

type ScheduleStatus = "on_air" | "upcoming" | "ended";

function scheduleStatus(p: Promotion): ScheduleStatus {
  const now = Date.now();
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

interface Transaction {
  id: string;
  transaction_number: string;
  customer_name?: string;
  amount: number;
}

export default function AdminDraws() {
  const canMutate = canMutateAdmin(localStorage.getItem("role"));
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [eligible, setEligible] = useState<Transaction[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [lastDraw, setLastDraw] = useState<Draw | null>(null);
  const [error, setError] = useState("");
  const [, setTick] = useState(0);
  const [winnerModal, setWinnerModal] = useState<{ drawId: string; data: any } | null>(null);

  const lotteryMap = Object.fromEntries(lotteries.map((l) => [l.id, l]));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const loadDraws = () =>
    api.get<Draw[]>("/api/draws").then((r) => setDraws(r.data));

  useEffect(() => {
    Promise.all([
      api.get<Promotion[]>("/api/admin/promotions"),
      api.get<Lottery[]>("/api/admin/lotteries"),
      api.get<User[]>("/api/admin/users"),
    ]).then(([p, l, u]) => {
      const active = p.data.filter((x) => x.status === "active");
      setPromotions(active);
      setLotteries(l.data);
      setUsers(u.data);
      // Auto-select first On Air, else first available
      const onAir = active.find((x) => scheduleStatus(x) === "on_air");
      setSelectedId((onAir ?? active[0])?.id ?? "");
    });
    loadDraws();
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedId) { setEligible([]); return; }
    api
      .get<Transaction[]>(`/api/draws/eligible-transactions/${selectedId}`)
      .then((r) => setEligible(r.data))
      .catch(() => setEligible([]));
  }, [selectedId]);

  const viewWinner = async (drawId: string) => {
    try {
      const r = await api.get(`/api/draws/${drawId}/winner`);
      setWinnerModal({ drawId, data: r.data });
    } catch {
      setWinnerModal(null);
    }
  };

  const handleDraw = async () => {
    setError("");
    setDrawing(true);
    try {
      const res = await api.post<Draw>("/api/draws", {
        promotion_id: selectedId,
        draw_type: "manual",
      });
      setLastDraw(res.data);
      const [eligRes, drawRes] = await Promise.all([
        api.get<Transaction[]>(`/api/draws/eligible-transactions/${selectedId}`),
        api.get<Draw[]>("/api/draws"),
      ]);
      setEligible(eligRes.data);
      setDraws(drawRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Draw failed");
    } finally {
      setDrawing(false);
    }
  };

  const selectedPromo = promotions.find((p) => p.id === selectedId);
  const selectedStatus = selectedPromo ? scheduleStatus(selectedPromo) : null;

  // Resolve promotion name for draw history
  const promoMap = Object.fromEntries(promotions.map((p) => [p.id, p]));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Draws</h2>
          <p className="text-sm text-gray-500 mt-0.5">Execute and manage lottery draws across all promotions</p>
        </div>
      </div>

      {promotions.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-lg px-6 py-10 text-center text-gray-400 text-sm">
          No active promotions. Create a promotion first.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left: promotion selector */}
          <div className="lg:col-span-1 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Select Promotion
            </p>
            {promotions.map((p) => {
              const status = scheduleStatus(p);
              const lottery = lotteryMap[p.lottery_id];
              const presenter = userMap[p.user_id];
              const isSelected = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelectedId(p.id); setLastDraw(null); setError(""); }}
                  className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-all ${
                    isSelected ? "border-black bg-gray-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate pr-2">{p.name || "Unnamed"}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${SCHEDULE_STYLE[status]}`}>
                      {SCHEDULE_LABEL[status]}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 space-y-0.5">
                    {lottery && <div className="truncate">{lottery.name}</div>}
                    {presenter && (
                      <div className="truncate">
                        {presenter.full_name || presenter.username}
                        {presenter.organization ? ` · ${presenter.organization}` : ""}
                      </div>
                    )}
                    <div className={status === "on_air" ? "text-green-600 font-medium" : ""}>
                      {timeHint(p)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: draw panel */}
          <div className="lg:col-span-2">
            {selectedPromo ? (
              <div className="border border-gray-200 rounded-lg p-6">
                {/* Promotion header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="font-semibold text-base">{selectedPromo.name || "Unnamed"}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {lotteryMap[selectedPromo.lottery_id]?.name ?? "—"}
                      {" · "}
                      {new Date(selectedPromo.start_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" → "}
                      {new Date(selectedPromo.end_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      {new Date(selectedPromo.start_date).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  {selectedStatus && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${SCHEDULE_STYLE[selectedStatus]}`}>
                      {SCHEDULE_LABEL[selectedStatus]}
                    </span>
                  )}
                </div>

                {/* Schedule notice for non-on-air */}
                {selectedStatus === "upcoming" && (
                  <div className="mb-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                    This promotion hasn't started yet — starts at{" "}
                    {new Date(selectedPromo.start_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
                    As admin you can still draw if needed.
                  </div>
                )}
                {selectedStatus === "ended" && (
                  <div className="mb-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
                    This promotion has ended. As admin you can still draw if eligible transactions remain.
                  </div>
                )}

                {/* Eligible count + draw button */}
                  <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-900 text-lg">{eligible.length}</span>
                    {" "}eligible transaction{eligible.length !== 1 ? "s" : ""}
                  </div>
                  {canMutate ? (
                    <button
                      onClick={handleDraw}
                      disabled={drawing || eligible.length === 0}
                      className="bg-black text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {drawing ? "Drawing..." : "Draw Winner"}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Auditors cannot execute draws</span>
                  )}
                </div>

                {error && (
                  <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                    {error}
                  </div>
                )}

                {/* Winner result */}
                {lastDraw && (
                  <div className="mb-4 px-5 py-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Winner</p>
                    <p className="text-2xl font-mono font-bold text-green-900">{lastDraw.winning_number}</p>
                    {(lastDraw as any).winner && (
                      <div className="mt-2 text-sm text-green-800 space-y-0.5">
                        <p>{(lastDraw as any).winner.customer_name}</p>
                        <p className="font-mono text-xs">{(lastDraw as any).winner.customer_phone}</p>
                      </div>
                    )}
                    <p className="text-xs text-green-600 mt-1">{formatDate(lastDraw.drawn_at)}</p>
                  </div>
                )}

                {/* Eligible transactions list */}
                {eligible.length > 0 && (
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 uppercase">
                      Eligible Transactions
                    </div>
                    <div className="divide-y divide-gray-100 max-h-56 overflow-auto">
                      {eligible.map((t) => (
                        <div key={t.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <span className="font-mono text-xs text-gray-500">{t.transaction_number}</span>
                          <span className="text-gray-700">{t.customer_name || "—"}</span>
                          <span className="font-medium">{formatAmount(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-6 text-center text-gray-400 text-sm">
                Select a promotion to draw
              </div>
            )}
          </div>
        </div>
      )}

      {/* Draw history */}
      <h3 className="font-semibold mb-3">Draw History</h3>
      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Winning Number</th>
              <th className="px-4 py-3 text-left">Promotion</th>
              <th className="px-4 py-3 text-left">Presenter</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Drawn At</th>
              <th className="px-4 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {draws.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No draws yet
                </td>
              </tr>
            ) : (
              draws.map((d) => {
                const promo = promoMap[d.promotion_id];
                const presenter = d.presenter_id ? userMap[d.presenter_id] : null;
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium">{d.winning_number}</td>
                    <td className="px-4 py-3 text-gray-700">{promo?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {presenter
                        ? (presenter.full_name || presenter.username) +
                          (presenter.organization ? ` · ${presenter.organization}` : "")
                        : <span className="italic text-gray-400">Admin</span>}
                    </td>
                    <td className="px-4 py-3 capitalize">{d.draw_type}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(d.drawn_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => viewWinner(d.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Winner
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Winner modal */}
      {winnerModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setWinnerModal(null)}>
          <div className="bg-white rounded-xl border shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold">Winner Details</h3>
              <button onClick={() => setWinnerModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {winnerModal.data.winner ? (
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Ref:</span> <span className="font-mono">{winnerModal.data.winning_number}</span></p>
                <p><span className="text-gray-500">Name:</span> {winnerModal.data.winner.customer_name}</p>
                <p><span className="text-gray-500">Phone:</span> <span className="font-mono">{winnerModal.data.winner.customer_phone}</span></p>
                <p><span className="text-gray-500">Amount:</span> {formatAmount(winnerModal.data.winner.amount)}</p>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No winner data</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
