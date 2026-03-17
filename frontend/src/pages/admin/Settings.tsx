import { useEffect, useState } from "react";
import api from "@/api/client";
import { SystemSetting } from "@/types";

type Tab = "general" | "mpesa";

interface MpesaConfig {
  mpesa_consumer_key: string;
  mpesa_consumer_secret: string;
  mpesa_business_short_code: string;
  mpesa_passkey: string;
  mpesa_base_url: string;
  mpesa_account_type: string;
  mpesa_callback_url: string;
  mpesa_c2b_confirmation_url: string;
  mpesa_c2b_validation_url: string;
  mpesa_decode_msisdn_url: string;
}

export default function AdminSettings() {
  const [tab, setTab] = useState<Tab>("general");
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // M-Pesa
  const [mpesaConfig, setMpesaConfig] = useState<MpesaConfig | null>(null);
  const [mpesaForm, setMpesaForm] = useState<Partial<MpesaConfig>>({});
  const [mpesaSaving, setMpesaSaving] = useState(false);
  const [mpesaAction, setMpesaAction] = useState<string | null>(null);
  const [mpesaError, setMpesaError] = useState("");

  const load = () =>
    api.get<SystemSetting[]>("/api/admin/settings").then((r) => setSettings(r.data));

  const loadMpesa = () =>
    api.get<{ config: MpesaConfig }>("/api/admin/mpesa/config").then((r) => {
      const c = r.data.config;
      setMpesaConfig(c);
      // Pre-fill non-secrets; leave secrets empty (masked values not editable)
      setMpesaForm({
        mpesa_business_short_code: c.mpesa_business_short_code,
        mpesa_base_url: c.mpesa_base_url,
        mpesa_account_type: c.mpesa_account_type,
        mpesa_callback_url: c.mpesa_callback_url,
        mpesa_c2b_confirmation_url: c.mpesa_c2b_confirmation_url,
        mpesa_c2b_validation_url: c.mpesa_c2b_validation_url,
        mpesa_decode_msisdn_url: c.mpesa_decode_msisdn_url,
      });
    });

  useEffect(() => {
    load();
    api.get<any[]>("/api/admin/setting-types").then((r) => setDefinitions(r.data));
  }, []);

  useEffect(() => {
    if (tab === "mpesa") loadMpesa();
  }, [tab]);

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

  const saveMpesa = async () => {
    setMpesaSaving(true);
    setMpesaError("");
    try {
      await api.put("/api/admin/mpesa/config", mpesaForm);
      loadMpesa();
    } catch (e: any) {
      setMpesaError(e.response?.data?.detail || "Failed to save");
    } finally {
      setMpesaSaving(false);
    }
  };

  const testOauth = async () => {
    setMpesaAction("oauth");
    setMpesaError("");
    try {
      const r = await api.post<{ success: boolean; message: string }>("/api/admin/mpesa/test-oauth");
      setMpesaError(r.data.success ? "OAuth token retrieved successfully" : r.data.message);
    } catch (e: any) {
      setMpesaError(e.response?.data?.detail || "OAuth test failed");
    } finally {
      setMpesaAction(null);
    }
  };

  const registerC2b = async () => {
    setMpesaAction("c2b");
    setMpesaError("");
    try {
      const r = await api.post<{ success?: boolean; message?: string }>("/api/admin/mpesa/register-c2b");
      setMpesaError(r.data.message || "C2B URLs registered successfully");
      loadMpesa();
    } catch (e: any) {
      setMpesaError(e.response?.data?.detail || "C2B registration failed");
    } finally {
      setMpesaAction(null);
    }
  };

  const existingKeys = new Set(settings.map((s) => s.key));
  const missing = definitions.filter((d) => !existingKeys.has(d.key));

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Settings</h2>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab("general")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "general" ? "border-black text-black" : "border-transparent text-gray-500 hover:text-black"
          }`}
        >
          General
        </button>
        <button
          onClick={() => setTab("mpesa")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "mpesa" ? "border-black text-black" : "border-transparent text-gray-500 hover:text-black"
          }`}
        >
          M-Pesa
        </button>
      </div>

      {tab === "general" && (
        <>
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
        </>
      )}

      {tab === "mpesa" && (
        <div className="space-y-6">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <p className="font-medium text-blue-900 mb-1">Cloud hosting required</p>
            <p className="text-blue-800">
              M-Pesa callbacks (STK Push, C2B) must be reachable via public HTTPS. Deploy to a cloud server
              (e.g. AWS, DigitalOcean, Railway) and set the callback URLs to your domain. Localhost will not work.
            </p>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 space-y-4 max-w-2xl">
            <h3 className="font-semibold">M-Pesa Daraja API</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Consumer Key</label>
                {mpesaConfig?.mpesa_consumer_key && (
                  <p className="text-xs text-gray-400 mb-0.5 font-mono">Current: {mpesaConfig.mpesa_consumer_key}</p>
                )}
                <input
                  value={mpesaForm.mpesa_consumer_key ?? ""}
                  onChange={(e) => setMpesaForm((f) => ({ ...f, mpesa_consumer_key: e.target.value }))}
                  placeholder="Enter new value to change"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Consumer Secret</label>
                {mpesaConfig?.mpesa_consumer_secret && (
                  <p className="text-xs text-gray-400 mb-0.5 font-mono">Current: {mpesaConfig.mpesa_consumer_secret}</p>
                )}
                <input
                  type="password"
                  value={mpesaForm.mpesa_consumer_secret ?? ""}
                  onChange={(e) => setMpesaForm((f) => ({ ...f, mpesa_consumer_secret: e.target.value }))}
                  placeholder="Enter new value to change"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Business Short Code (Till/Paybill)</label>
                <input
                  value={mpesaForm.mpesa_business_short_code ?? ""}
                  onChange={(e) => setMpesaForm((f) => ({ ...f, mpesa_business_short_code: e.target.value }))}
                  placeholder="e.g. 4561783"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Passkey</label>
                {mpesaConfig?.mpesa_passkey && (
                  <p className="text-xs text-gray-400 mb-0.5 font-mono">Current: {mpesaConfig.mpesa_passkey}</p>
                )}
                <input
                  type="password"
                  value={mpesaForm.mpesa_passkey ?? ""}
                  onChange={(e) => setMpesaForm((f) => ({ ...f, mpesa_passkey: e.target.value }))}
                  placeholder="Enter new value to change"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Base URL</label>
              <select
                value={mpesaForm.mpesa_base_url ?? "https://api.safaricom.co.ke"}
                onChange={(e) => setMpesaForm((f) => ({ ...f, mpesa_base_url: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="https://api.safaricom.co.ke">Production (api.safaricom.co.ke)</option>
                <option value="https://sandbox.safaricom.co.ke">Sandbox (sandbox.safaricom.co.ke)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Account Type</label>
              <select
                value={mpesaForm.mpesa_account_type ?? "till"}
                onChange={(e) => setMpesaForm((f) => ({ ...f, mpesa_account_type: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="till">Till (Buy Goods / Lipa Na M-Pesa)</option>
                <option value="paybill">PayBill (uses account numbers for concurrent promotions)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Callback URLs (must be public HTTPS)</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-0.5">STK Push Callback</label>
                  <input
                    value={mpesaForm.mpesa_callback_url ?? ""}
                    onChange={(e) => setMpesaForm((f) => ({ ...f, mpesa_callback_url: e.target.value }))}
                    placeholder="https://yourdomain.com/api/webhooks/daraja/stk-callback"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-0.5">C2B Confirmation URL</label>
                  <input
                    value={mpesaForm.mpesa_c2b_confirmation_url ?? ""}
                    onChange={(e) => setMpesaForm((f) => ({ ...f, mpesa_c2b_confirmation_url: e.target.value }))}
                    placeholder="https://yourdomain.com/api/webhooks/daraja/c2b"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-0.5">C2B Validation URL</label>
                  <input
                    value={mpesaForm.mpesa_c2b_validation_url ?? ""}
                    onChange={(e) => setMpesaForm((f) => ({ ...f, mpesa_c2b_validation_url: e.target.value }))}
                    placeholder="https://yourdomain.com/api/webhooks/daraja/c2b/validate"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">MSISDN Decode API</p>
              <p className="text-xs text-gray-400 mb-3">
                Built-in: <code className="bg-gray-100 px-1 rounded">/api/msisdn/decode</code>. Set full URL to use it (e.g. https://l-gain-v1.payl.to/api/msisdn/decode). mpesa-hash-decoder format.
              </p>
              <div>
                <label className="block text-xs text-gray-400 mb-0.5">DECODE_MSISDN_URL</label>
                <input
                  value={mpesaForm.mpesa_decode_msisdn_url ?? ""}
                  onChange={(e) => setMpesaForm((f) => ({ ...f, mpesa_decode_msisdn_url: e.target.value }))}
                  placeholder="https://l-gain-v1.payl.to/api/msisdn/decode"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

            {mpesaError && (
              <div className={`rounded-lg px-4 py-3 text-sm ${/success/i.test(mpesaError) ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                {mpesaError}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={saveMpesa}
                disabled={mpesaSaving}
                className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {mpesaSaving ? "Saving..." : "Save Config"}
              </button>
              <button
                onClick={testOauth}
                disabled={!!mpesaAction}
                className="border border-gray-300 px-4 py-2 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {mpesaAction === "oauth" ? "Testing..." : "Test OAuth"}
              </button>
              <button
                onClick={registerC2b}
                disabled={!!mpesaAction}
                className="border border-gray-300 px-4 py-2 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {mpesaAction === "c2b" ? "Registering..." : "Register C2B URLs"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
