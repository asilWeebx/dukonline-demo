import { isWeightUnit } from "./currency.ts";
import type { PhoneInfo, Product, ProductUnit } from "./types";

export function hasVariants(p: Product): boolean {
  return Boolean(p.has_variants && p.variants?.length);
}

/**
 * The phone block, when the product is a phone with copies in stock. The card
 * is the MODEL; the customer picks a configuration or copy on the detail page.
 */
export function getPhone(p: Product): PhoneInfo | null {
  return p.phone && (p.phone.groups?.length || p.phone.buckets?.length) ? p.phone : null;
}

/** How many of a unit can be bought: fractional for weights, `Infinity` when untracked. */
export function unitMaxQty(p: Product, unit: ProductUnit | null | undefined): number {
  if (p.stock_type !== "tracked") return Infinity;
  const available = p.stock / (unit?.multiplier || 1);
  return isWeightUnit(unit?.unit_name) ? available : Math.floor(available);
}

/** The unit selected by default: the first one that is actually in stock. */
export function firstAvailableUnit(p: Product): ProductUnit | undefined {
  if (!hasVariants(p) && p.stock_type === "tracked") {
    return p.units?.find((u) => Math.floor(p.stock / (u.multiplier || 1)) > 0) || p.units?.[0];
  }
  return p.units?.[0];
}
