import { useEffect, useState } from "react";
import api from "@/api/client";
import { Transaction } from "@/types";
import { formatAmount, formatDate } from "@/lib/utils";

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    transaction_number: "",
    payment_type: "till",
    amount: "",
    customer_name: "",
    customer_phone: "",
    till_number: "",
  });
  const [error, setError] = useState("");

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (paymentType) params.set("payment_type", paymentType);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    api
      .get<Transaction[]>(`/api/admin/transactions?${params}`)
      .then((r) => setTransactions(r.data));
  };

  useEffect(() => {
    load();
  }, [search, paymentType, dateFrom, dateTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/admin/transactions", {
        ...form,
        amount: Math.round(parseFloat(form.amount) * 100),
      });
      setShowModal(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Transactions</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-black text-white text-sm px-4 py-2 rounded hover:bg-gray-800"
        >
          Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          placeholder="Search name, phone, number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-56"
        />
        <select
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
        >
          <option value="">All types</option>
          <option value="till">Till</option>
          <option value="paybill">Paybill</option>
          <option value="card">Card</option>
          <option value="stk_push">STK Push</option>
        </select>
        <input
          type="datetime-local"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
        />
        <input
          type="datetime-local"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
        />
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Ref</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-mono text-xs">{t.transaction_number}</td>
                <td className="px-4 py-3 capitalize">{t.payment_type}</td>
                <td className="px-4 py-3">{formatAmount(t.amount)}</td>
                <td className="px-4 py-3 text-gray-500">{t.customer_name || "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(t.payment_date)}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">No transactions found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border p-6 w-full max-w-md shadow-lg">
            <h3 className="font-bold mb-4">Add Transaction</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { name: "transaction_number", label: "Transaction Number *", required: true },
                { name: "customer_name", label: "Customer Name" },
                { name: "customer_phone", label: "Customer Phone" },
                { name: "till_number", label: "Till Number" },
              ].map(({ name, label, required }) => (
                <div key={name}>
                  <label className="block text-xs font-medium mb-1">{label}</label>
                  <input
                    required={required}
                    value={(form as any)[name]}
                    onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1">Amount (KES) *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Payment Type</label>
                <select
                  value={form.payment_type}
                  onChange={(e) => setForm((f) => ({ ...f, payment_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                >
                  <option value="till">Till</option>
                  <option value="paybill">Paybill</option>
                  <option value="card">Card</option>
                </select>
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-black text-white py-2 rounded text-sm">Create</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 py-2 rounded text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
