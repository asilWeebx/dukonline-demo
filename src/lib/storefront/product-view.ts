import { isWeightUnit } from "./currency.ts";
import type { PhoneGroup, PhoneInfo, Product, ProductUnit, ProductVariant } from "./types";

export function hasVariants(p: Product): boolean {
  return Boolean(p.has_variants && p.variants?.length);
}

/**
 * The variant a product page opens on: the one in the URL (`?v=3059`) when
 * the product has it, else the first in stock.
 */
export function defaultVariant(p: Product, requestedId?: number | null): ProductVariant | null {
  if (!hasVariants(p)) return null;
  return (
    p.variants.find((v) => requestedId != null && v.id === requestedId) ??
    p.variants.find((v) => v.in_stock) ??
    p.variants[0]
  );
}

/** A variant's own photo, else the product's. */
export function variantImage(p: Product, v: ProductVariant | null | undefined): string {
  return v?.image || p.image;
}

/** Whether variants are worth showing as photos rather than names alone. */
export function hasVariantPhotos(p: Product): boolean {
  return hasVariants(p) && p.variants.some((v) => v.image && v.image !== p.image);
}

/**
 * The product's photos: the gallery when the API sends one, else the main
 * photo, followed by any variant photos not already in it.
 */
export function productGallery(p: Product): string[] {
  const photos = p.images?.length ? [...p.images] : [p.image];
  for (const v of p.variants ?? []) if (v.image) photos.push(v.image);
  return [...new Set(photos.filter(Boolean))];
}

/**
 * The variant a card's "dan" price comes from: the cheapest in stock (of all,
 * when none is), within one currency so dollars and so'm are never compared.
 * `varies` is false when every variant costs the same.
 */
export function cheapestVariant(p: Product): { variant: ProductVariant; varies: boolean } | null {
  if (!hasVariants(p)) return null;
  const available = p.variants.filter((v) => v.in_stock);
  const pool = available.length ? available : p.variants;
  const currency = pool[0].currency || "";
  const same = pool.filter((v) => (v.currency || "") === currency);
  const price = (v: ProductVariant) => v.cur_price ?? v.price;
  const variant = same.reduce((min, v) => (price(v) < price(min) ? v : min));
  return { variant, varies: same.length < pool.length || new Set(same.map(price)).size > 1 };
}

/**
 * The phone block, when the product is a phone with copies in stock. The card
 * is the MODEL; the customer picks a configuration or copy on the detail page.
 */
export function getPhone(p: Product): PhoneInfo | null {
  return p.phone && (p.phone.groups?.length || p.phone.buckets?.length) ? p.phone : null;
}

/**
 * Whether a phone is sold by count from priced buckets rather than copy by
 * copy. `mode` names the list the ERP filled, but when it points at an empty
 * list the other one wins, or the stock would show on the card with no way
 * to pick it on the detail page.
 */
export function isGroupedPhone(phone: PhoneInfo): boolean {
  const hasBuckets = Boolean(phone.buckets?.length);
  const hasGroups = Boolean(phone.groups?.length);
  return hasBuckets && hasGroups ? phone.mode === "grouped" : hasBuckets;
}

/**
 * The options at each step of picking a phone copy by copy: storage, then the
 * colours within it, then the regions within that colour. A blank value is an
 * option of its own ("—"), not a wildcard, or a configuration with a blank
 * storage could only be reached when it happened to be listed first.
 */
export function phoneChoices(groups: PhoneGroup[], selected: PhoneGroup | null) {
  const colors = groups.filter((g) => g.storage === selected?.storage);
  return {
    storages: [...new Set(groups.map((g) => g.storage))],
    colors,
    regions: colors.filter((g) => g.color === selected?.color),
  };
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
