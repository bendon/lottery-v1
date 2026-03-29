import { useEffect, useState } from "react";
import api from "@/api/client";
import { formatDate } from "@/lib/utils";
import { Draw } from "@/types";

interface Stats {
  lotteries: { total: number; active: number };
  promotions: { total: number; active: number };
  transactions: { total: number; last_30_days: number };
  draws: { total: number; last_30_days: number };
  users: { total: number };
  recent_draws: Draw[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<Stats>("/api/admin/dashboard/stats").then((r) => setStats(r.data));
  }, []);

  if (!stats) return <div className="text-sm text-gray-500">Loading...</div>;

  const cards = [
    { label: "Total Lotteries", value: stats.lotteries.total, sub: `${stats.lotteries.active} active` },
    { label: "Total Promotions", value: stats.promotions.total, sub: `${stats.promotions.active} active` },
    { label: "Transactions", value: stats.transactions.total, sub: `${stats.transactions.last_30_days} this month` },
    { label: "Draws", value: stats.draws.total, sub: `${stats.draws.last_30_days} this month` },
    { label: "Users", value: stats.users.total },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="min-w-0 border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 break-words">{c.label}</p>
            <p className="text-2xl font-bold mt-1">{c.value}</p>
            {c.sub && <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      <h3 className="font-semibold mb-3">Recent Draws</h3>
      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Winning Number</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Drawn At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stats.recent_draws.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                  No draws yet
                </td>
              </tr>
            ) : (
              stats.recent_draws.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-mono">{d.winning_number}</td>
                  <td className="px-4 py-3 capitalize">{d.draw_type}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(d.drawn_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
