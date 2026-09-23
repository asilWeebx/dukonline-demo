import { money } from "@/lib/storefront/currency";

/**
 * A price, with whatever context it needs around it: the struck-through
 * original, a `dan` prefix when the figure is a starting price, the discount
 * badge, and the so'm equivalent under a foreign-currency price.
 *
 * Nothing here converts anything. A product costed in dollars is priced in
 * dollars; `alt` is the so'm figure the ERP already sent alongside it, shown
 * as an approximation so the shopper has a familiar number to judge by.
 */
export function PriceTag({
  amount,
  currency,
  original = null,
  /** True when the figure is the cheapest of several (variants, phones). */
  from = false,
  discountPercent = 0,
  /** The same price in the store's base currency, when it differs. */
  alt = null,
  size = "md",
}: {
  amount: number;
  currency: string;
  original?: number | null;
  from?: boolean;
  discountPercent?: number;
  alt?: number | null;
  size?: "md" | "lg";
}) {
  return (
    <div className={`product-price${size === "lg" ? " product-price-lg" : ""}`}>
      {original != null && original > amount && (
        <span className="price-orig-strike">{money(original, currency)}</span>
      )}
      {from && <span className="price-from">dan</span>}
      {money(amount, currency)}
      {discountPercent > 0 && <span className="disc-badge">−{Math.round(discountPercent)}%</span>}
      {alt != null && alt > 0 && <span className="price-alt">≈ {money(alt, "")}</span>}
    </div>
  );
}
