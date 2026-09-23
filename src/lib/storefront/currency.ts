/**
 * Money formatting for a multi-currency catalog.
 *
 * Every price is shown in its OWN currency: a product costed in USD shows
 * `$50`, anything else shows so'm. An empty currency means the store's base
 * currency, which for dukonline tenants is so'm.
 */

/** Thin-space thousands separators, the convention used across UZ retail. */
function withThousands(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** `som(50000) -> "50 000 so'm"`. */
export function som(amount: number | null | undefined): string {
  return withThousands(Math.round(Number(amount) || 0).toString()) + " so'm";
}

/** `money(50, "USD") -> "$50"`, `money(50000, "") -> "50 000 so'm"`. */
export function money(amount: number | null | undefined, currency?: string | null): string {
  if (!currency || currency === "UZS") return som(amount);

  const value = Math.round((Number(amount) || 0) * 100) / 100;
  const [whole, fraction] = Number.isInteger(value)
    ? [value.toString(), ""]
    : value.toFixed(2).split(".");

  const prefix = currency === "USD" ? "$" : `${currency} `;
  return prefix + withThousands(whole) + (fraction ? `.${fraction}` : "");
}

/**
 * A cart can hold items priced in different currencies, and the API offers no
 * conversion, so totals are summed per currency and shown side by side:
 * `"$52  +  300 000 so'm"`.
 */
export function groupTotal(
  items: { currency?: string; price: number; cur_price?: number | null; qty: number }[],
): string {
  const totals = new Map<string, number>();
  for (const item of items ?? []) {
    const code = item.currency || "";
    totals.set(code, (totals.get(code) ?? 0) + (item.cur_price ?? item.price) * item.qty);
  }
  if (totals.size === 0) return som(0);
  return [...totals.entries()].map(([code, sum]) => money(sum, code)).join("  +  ");
}

/** Weight-based units (kg, gramm) are sold in fractional quantities. */
export function isWeightUnit(unitName: string | null | undefined): boolean {
  return /kilogram|kilogramm|gramm|\bkg\b|\bg\b/i.test((unitName ?? "").trim());
}

/** A whole quantity shows as "2", a fraction as "0.5" (at most 3 decimals). */
export function fmtQty(qty: number): string {
  return Number.isInteger(+qty) ? String(+qty) : String(+(+qty).toFixed(3));
}
