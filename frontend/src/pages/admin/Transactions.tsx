import { useEffect, useState } from "react";
import api from "@/api/client";
import { Transaction } from "@/types";
import { formatAmount, formatDate, formatKeMsisdnReadable, maskMsisdnDisplay } from "@/lib/utils";

type MpesaStatus = {
  short_code: string | null;
  till_display_number: string | null;
  account_type: string;
};

/** Admin table: Paybill = short code on txn; Till/STK = Till no. from Settings when set, else Daraja code */
function payToCell(t: Transaction, mpesa: MpesaStatus | null): { main: string; sub?: string } {
  const api = (t.till_number || t.paybill_number || "").trim();
  if (t.payment_type === "paybill") {
    return { main: api || "—" };
  }
  if (t.payment_type === "till" || t.payment_type === "stk_push") {
    const display = (mpesa?.till_display_number || "").trim();
    if (display) {
      return {
        main: display,
        sub: api && api !== display ? `Daraja ${api}` : undefined,
      };
    }
    return { main: api || "—" };
  }
  return { main: api || "—" };
}

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [mpesa, setMpesa] = useState<MpesaStatus | null>(null);
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
  const [unmaskedPhones, setUnmaskedPhones] = useState<
    Record<string, { display: string; hint?: string }>
  >({});
  const [revealLoadingId, setRevealLoadingId] = useState<string | null>(null);

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

  useEffect(() => {
    api
      .get<MpesaStatus>("/api/admin/mpesa/status")
      .then((r) => setMpesa(r.data))
      .catch(() => setMpesa(null));
  }, []);

  const togglePhoneReveal = async (t: Transaction) => {
    if (unmaskedPhones[t.id]) {
      setUnmaskedPhones((prev) => {
        const next = { ...prev };
        delete next[t.id];
        return next;
      });
      return;
    }
    setRevealLoadingId(t.id);
    try {
      const r = await api.get<{
        phone: string | null;
        raw_stored: string | null;
        was_decoded: boolean;
        still_hashed?: boolean;
        hint?: string | null;
      }>(`/api/admin/transactions/${t.id}/reveal-customer-phone`);
      const rawVal = (r.data.phone || r.data.raw_stored || "").trim();
      let display = rawVal || "—";
      if (r.data.was_decoded && display !== "—" && !/^[a-fA-F0-9]{64}$/i.test(display)) {
        display = formatKeMsisdnReadable(display) || display;
      }
      setUnmaskedPhones((prev) => ({
        ...prev,
        [t.id]: {
          display,
          hint: r.data.hint || undefined,
        },
      }));
    } catch {
      setUnmaskedPhones((prev) => ({
        ...prev,
        [t.id]: { display: "—" },
      }));
    } finally {
      setRevealLoadingId(null);
    }
  };

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

      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Ref</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th
                className="px-4 py-3 text-left whitespace-nowrap"
                title="Till / STK: on-air Till number from Settings when set; Paybill: business short code"
              >
                Pay to
              </th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th
                className="px-4 py-3 text-left"
                title="Kenya-style masked (+2547•••••678). Use Show to reveal (admin); uses hash lookup when available."
              >
                MSISDN
              </th>
              <th className="px-4 py-3 text-left">Bill ref</th>
              <th className="px-4 py-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {transactions.map((t) => {
              const pay = payToCell(t, mpesa);
              return (
              <tr key={t.id}>
                <td className="px-4 py-3 font-mono text-xs">{t.transaction_number}</td>
                <td className="px-4 py-3 capitalize">{t.payment_type}</td>
                <td className="px-4 py-3 text-gray-700">
                  <span className="font-mono text-xs block">{pay.main}</span>
                  {pay.sub && (
                    <span className="text-[10px] text-gray-400 font-mono">{pay.sub}</span>
                  )}
                </td>
                <td className="px-4 py-3">{formatAmount(t.amount)}</td>
                <td className="px-4 py-3 text-gray-600">{t.customer_name || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2 flex-wrap">
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="font-mono text-xs text-gray-600 tabular-nums break-all block">
                        {unmaskedPhones[t.id]?.display ?? maskMsisdnDisplay(t.customer_phone)}
                      </span>
                      {unmaskedPhones[t.id]?.hint ? (
                        <p className="text-[10px] text-amber-900/90 leading-snug max-w-xs">
                          {unmaskedPhones[t.id].hint}
                        </p>
                      ) : null}
                    </div>
                    {t.customer_phone?.trim() ? (
                      <button
                        type="button"
                        onClick={() => togglePhoneReveal(t)}
                        disabled={revealLoadingId === t.id}
                        className="text-[10px] shrink-0 border border-gray-300 rounded px-2 py-0.5 hover:bg-gray-50 disabled:opacity-50 self-start"
                      >
                        {revealLoadingId === t.id ? "…" : unmaskedPhones[t.id] ? "Hide" : "Show"}
                      </button>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {t.bill_ref_number?.trim() || "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(t.payment_date)}</td>
              </tr>
            );
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">No transactions found</td>
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
