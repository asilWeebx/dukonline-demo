"use client";

import { useRouter } from "next/navigation";
import { FiCheck, FiCreditCard, FiFileText, FiPackage } from "react-icons/fi";
import { useEffect, useState } from "react";

import { useCustomer } from "@/lib/customer/CustomerProvider";
import { som } from "@/lib/storefront/currency";
import type { Customer, CustomerAccountResponse } from "@/lib/storefront/types";

import { IX } from "./icons";
import { useShopUi } from "./ShopUiContext";

/* Label + accent colour per payment method, so the small tag on each sale
   reads at a glance instead of all methods sharing one flat grey pill. */
const PM: Record<string, [string, string]> = {
  cash: ["Naqd", "#15803d"],
  card: ["Karta", "#2563eb"],
  transfer: ["O'tkazma", "#0f766e"],
  credit: ["Nasiya", "#c2410c"],
  mixed: ["Aralash", "#64748b"],
  click: ["Click", "#0891b2"],
  payme: ["Payme", "#4f46e5"],
  uzum: ["Uzum", "#7c3aed"],
  humo: ["Humo", "#2563eb"],
  uzcard: ["UzCard", "#0d9488"],
  installment: ["Bo'lib to'lash", "#ea580c"],
  exchange_credit: ["Ayirboshlash", "#7c3aed"],
  trade_in: ["Trade-in", "#7c3aed"],
};
const pmLabel = (m?: string) => PM[m ?? ""]?.[0] || m || "—";
const pmColor = (m?: string) => PM[m ?? ""]?.[1] || "#64748b";
const DEBT_COLOR = "#dc2626";

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const TABS = [
  { k: "profile", l: "Hisobim" },
  { k: "sales", l: "Xaridlar" },
  { k: "orders", l: "Zakazlar" },
  { k: "payments", l: "To'lovlar" },
] as const;
type Tab = (typeof TABS)[number]["k"];

/* Semantic status colours, so an order chip still reads at a glance. These are
   the one place green survives the palette change — a delivered order is a
   state, not a brand or action surface. */
const STATUS: Record<string, [string, string]> = {
  new: ["Yangi", "#2563eb"],
  confirmed: ["Tasdiqlangan", "#c2410c"],
  sold: ["Yetkazilgan", "#15803d"],
  cancelled: ["Bekor", "#64748b"],
};

/** Sign-in with the in-store customer code, or the signed-in customer's account. */
export function AccountView() {
  const { customer, ready, signIn, signOut } = useCustomer();

  if (!ready) {
    return (
      <div className="sheet-page">
        <div className="skel" style={{ height: 320, borderRadius: 0 }} />
      </div>
    );
  }
  return customer ? <CustomerPortal customer={customer} onLogout={signOut} /> : <Login onLogin={signIn} />;
}

function Login({ onLogin }: { onLogin: (customer: Customer) => void }) {
  const { goBack } = useShopUi();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!code.trim()) {
      setErr("ID kiriting");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Xatolik");
      onLogin(data as Customer);
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : "Xatolik");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-card pop-in" style={{ margin: "24px auto", boxShadow: "var(--shadow-card)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h1 id="login-title" style={{ fontWeight: 700, fontSize: 17, color: "var(--foreground)" }}>
          Mijoz sifatida kirish
        </h1>
        <button type="button" className="close-btn" aria-label="Orqaga qaytish" onClick={goBack}>
          <IX />
        </button>
      </div>
      <p style={{ fontSize: 13, color: "var(--faint)", marginBottom: 20, textAlign: "left" }}>
        Do&apos;kondan olgan ID raqamingizni kiriting
      </p>
      <label className="sr-only" htmlFor="customer-code">
        Mijoz ID raqami
      </label>
      <input
        id="customer-code"
        autoComplete="off"
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        onKeyDown={(event) => {
          if (event.key === "Enter") void go();
        }}
        placeholder="CUST-XXXXXX"
        style={{
          width: "100%",
          height: 48,
          border: "1.5px solid var(--border)",
          borderRadius: 10,
          paddingLeft: 14,
          fontSize: 15,
          fontFamily: "monospace",
          letterSpacing: 2,
          color: "var(--foreground)",
          background: "var(--surface)",
          marginBottom: err ? 10 : 0,
        }}
      />
      {err && (
        <div className="err-box" role="alert" style={{ marginBottom: 10 }}>
          {err}
        </div>
      )}
      <button type="button" className="primary-btn" style={{ marginTop: 12 }} onClick={go} disabled={busy}>
        {busy ? "Tekshirilmoqda..." : "Kirish"}
      </button>
    </div>
  );
}

function CustomerPortal({ customer, onLogout }: { customer: Customer; onLogout: () => void }) {
  const router = useRouter();
  const { goBack } = useShopUi();
  const [result, setResult] = useState<{ code: string; data?: CustomerAccountResponse; error?: string } | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [openSale, setOpenSale] = useState<number | null>(null);

  const code = customer.customer_code;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/customer?code=${encodeURIComponent(code)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Xatolik");
        return body as CustomerAccountResponse;
      })
      .then((data) => {
        if (!cancelled) setResult({ code, data });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setResult({ code, error: cause instanceof Error ? cause.message : "Xatolik" });
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const current = result?.code === code ? result : null;
  const loading = !current;
  const data = current?.data;
  const err = current?.error;

  return (
    <div className="sheet-page">
      <div className="portal-head" style={{ paddingTop: 20 }}>
        <h1 className="portal-title" id="portal-title">
          Mening hisobim
        </h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="portal-logout"
            onClick={() => {
              onLogout();
              router.push("/");
            }}
          >
            Chiqish
          </button>
          <button type="button" className="close-btn" aria-label="Orqaga qaytish" onClick={goBack}>
            <IX />
          </button>
        </div>
      </div>

      <div className="portal-tabs" role="tablist" aria-label="Hisob bo‘limlari">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.k}
            role="tab"
            aria-selected={tab === t.k}
            className={`portal-tab${tab === t.k ? " active" : ""}`}
            onClick={() => setTab(t.k)}
          >
            {t.l}
          </button>
        ))}
      </div>

      <div className="portal-body" role="tabpanel">
        {loading && <div className="portal-loading">Yuklanmoqda...</div>}
        {err && <div className="err-box">{err}</div>}

        {data && tab === "profile" && (
          <>
            <div className="portal-profile-card">
              <div className="portal-avatar">{(data.customer.name || "?")[0].toUpperCase()}</div>
              <div className="portal-profile-info">
                <div className="portal-profile-label">Mijoz</div>
                <div className="portal-profile-name">{data.customer.name}</div>
                <div className="portal-profile-meta">
                  {data.customer.code}
                  {data.customer.phone ? ` · ${data.customer.phone}` : ""}
                </div>
              </div>
            </div>
            <div className="portal-stat-grid">
              <div
                className={`portal-stat${
                  (data.customer.debt ?? 0) > 0 || Object.keys(data.customer.currency_debts || {}).length > 0 ? " debt" : ""
                }`}
              >
                <div className="portal-stat-label">Qarz</div>
                <div className="portal-stat-val">{som(data.customer.debt || 0)}</div>
                {Object.entries(data.customer.currency_debts || {}).map(([c, a], k) => (
                  <div key={k} className="portal-stat-val" style={{ fontSize: 14, marginTop: 2 }}>
                    {a} {c}
                  </div>
                ))}
              </div>
              <div
                className={`portal-stat${
                  (data.customer.credit ?? 0) > 0 || Object.keys(data.customer.currency_credits || {}).length > 0
                    ? " credit"
                    : ""
                }`}
              >
                <div className="portal-stat-label">Ortiqcha to&apos;lov</div>
                <div className="portal-stat-val">{som(data.customer.credit || 0)}</div>
                {Object.entries(data.customer.currency_credits || {}).map(([c, a], k) => (
                  <div key={k} className="portal-stat-val" style={{ fontSize: 14, marginTop: 2 }}>
                    {a} {c}
                  </div>
                ))}
              </div>
            </div>
            <div
              style={{
                border: "1.5px solid var(--border-soft)",
                borderRadius: 14,
                padding: "14px 16px",
                background: "var(--surface)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Jami xarid qilingan</span>
              <span style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)" }}>
                {som((data.sales ?? []).reduce((s, x) => s + (x.total || 0), 0))}
              </span>
            </div>
          </>
        )}

        {data && tab === "sales" &&
          (!data.sales?.length ? (
            <div className="portal-empty">
              <FiFileText />
              <span>Xaridlar yo&apos;q</span>
            </div>
          ) : (
            data.sales.map((s, i) => {
              const total = +(s.total ?? 0) || 0;
              const debt = +(s.debt ?? 0) || 0;
              const paid = +(s.paid ?? 0) || 0;
              const breakdown = s.payment_breakdown || [];
              const expanded = openSale === i;
              const debtText =
                s.debt_currency && s.debt_currency_amount ? `${s.debt_currency_amount} ${s.debt_currency}` : som(debt);
              return (
                <div key={i} style={{ border: "1.5px solid var(--border-soft)", borderRadius: 14, overflow: "hidden", background: "var(--surface-raised)", flexShrink: 0 }}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={expanded}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "13px 16px",
                      cursor: "pointer",
                      background: "var(--surface-raised)",
                      minHeight: 52,
                    }}
                    onClick={() => setOpenSale(expanded ? null : i)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setOpenSale(expanded ? null : i);
                      }
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--foreground)", marginBottom: 2 }}>
                        {s.receipt_number || `Xarid #${i + 1}`}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "var(--faint)" }}>{fmtDate(s.created_at)}</span>
                        <span
                          style={{
                            fontSize: 10,
                            color: pmColor(s.payment_method),
                            background: `color-mix(in srgb, ${pmColor(s.payment_method)} 16%, transparent)`,
                            padding: "1px 6px",
                            borderRadius: 5,
                            fontWeight: 700,
                          }}
                        >
                          {pmLabel(s.payment_method)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)", whiteSpace: "nowrap" }}>{som(total)}</div>
                        {debt > 0 && (
                          <div style={{ fontSize: 10, color: DEBT_COLOR, fontWeight: 700, whiteSpace: "nowrap" }}>
                            Qarz: {debtText}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          display: "inline-block",
                          width: 0,
                          height: 0,
                          borderLeft: "5px solid transparent",
                          borderRight: "5px solid transparent",
                          ...(expanded ? { borderBottom: "6px solid var(--faint)" } : { borderTop: "6px solid var(--faint)" }),
                        }}
                      />
                    </div>
                  </div>
                  {expanded && (
                    <div
                      style={{
                        borderTop: "1px solid var(--border-soft)",
                        padding: "10px 16px",
                        background: "var(--surface)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {s.items?.map((it, j) => (
                        <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: "var(--muted)" }}>{it.name || it.product_name || ""}</span>
                          <span style={{ color: "var(--foreground)", fontWeight: 700 }}>
                            {+(it.qty || it.quantity || 0)} {it.unit || it.unit_name || ""} × {som(+(it.price || 0))}
                          </span>
                        </div>
                      ))}
                      <div
                        style={{
                          borderTop: "1px dashed var(--border)",
                          marginTop: 4,
                          paddingTop: 6,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                          <span style={{ color: "var(--faint)" }}>To&apos;lov usuli</span>
                          <span style={{ color: "var(--foreground)", fontWeight: 700 }}>{pmLabel(s.payment_method)}</span>
                        </div>
                        {breakdown.length > 1 &&
                          breakdown.map((b, k) => (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                              <span style={{ color: "var(--faint)" }}>{"   · "}{pmLabel(b.method)}</span>
                              <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{som(+(b.amount || 0))}</span>
                            </div>
                          ))}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                          <span style={{ color: "var(--faint)" }}>To&apos;landi</span>
                          <span style={{ color: "var(--foreground)", fontWeight: 700 }}>{som(paid)}</span>
                        </div>
                        {debt > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                            <span style={{ color: DEBT_COLOR }}>Nasiya (qarz)</span>
                            <span style={{ color: DEBT_COLOR, fontWeight: 700 }}>{debtText}</span>
                          </div>
                        )}
                        {debt > 0 && s.debt_currency && s.debt_currency_amount && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: DEBT_COLOR }}>
                            <span>Qarz {s.debt_currency} da yozildi</span>
                            <span>
                              kurs: {som(s.debt_rate || 0)} · ≈ {som(debt)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ))}

        {data && tab === "orders" &&
          (!data.online_orders?.length ? (
            <div className="portal-empty">
              <FiPackage />
              <span>Zakazlar yo&apos;q</span>
            </div>
          ) : (
            data.online_orders.map((o, i) => {
              const [label, color] = STATUS[o.status ?? ""] ?? [o.status || "?", "var(--faint)"];
              return (
                <div key={i} style={{ border: "1.5px solid var(--border-soft)", borderRadius: 14, overflow: "hidden", background: "var(--surface-raised)", flexShrink: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "13px 16px",
                      background: "var(--surface-raised)",
                      minHeight: 52,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--foreground)" }}>{o.order_no || `Zakaz #${i + 1}`}</div>
                      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>{fmtDate(o.created_at)}</div>
                      <div style={{ fontWeight: 500, fontSize: 14, color: "var(--foreground)", marginTop: 6 }}>{som(+(o.total || 0))}</div>
                    </div>
                    <span
                      style={{
                        color,
                        // color-mix, not string-concatenated alpha: `color` is
                        // a var() now, so `${color}1a` would be invalid CSS and
                        // the fill would vanish without any error.
                        background: `color-mix(in srgb, ${color} 12%, transparent)`,
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 999,
                        padding: "3px 10px",
                        flexShrink: 0,
                      }}
                    >
                      {label}
                    </span>
                  </div>
                </div>
              );
            })
          ))}

        {data && tab === "payments" &&
          (!data.payments?.length ? (
            <div className="portal-empty">
              <FiCreditCard />
              <span>To&apos;lovlar yo&apos;q</span>
            </div>
          ) : (
            data.payments.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: "1.5px solid var(--border-soft)",
                  borderRadius: 14,
                  padding: "13px 16px",
                  background: "var(--surface-raised)",
                  flexShrink: 0,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: "var(--success-bright)" }}>+{som(+(p.amount || 0))}</div>
                  <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>{fmtDate(p.created_at)}</div>
                  {p.note ? <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>{p.note}</div> : null}
                </div>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--success-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--success)",
                    fontSize: 16,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  <FiCheck />
                </div>
              </div>
            ))
          ))}
      </div>
    </div>
  );
}
