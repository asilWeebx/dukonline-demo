import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCategories,
  isOutOfStock,
  normalizeCategories,
  rankTopProducts,
} from "../src/lib/storefront/catalog.ts";
import { demoCatalog, demoStoreInfo, demoTopProductIds } from "../src/lib/storefront/demo-data.ts";
import { demoEnabled } from "../src/lib/storefront/demo.ts";

/**
 * Demo mode renders a complete, plausible store, which is exactly why it needs
 * locking down and checking: a silent regression here either blanks the demo or
 * puts invented stock in front of a customer.
 */

test("placeholder data needs the flag, and is refused on Vercel production", () => {
  const before = { flag: process.env.STOREFRONT_DEMO, env: process.env.VERCEL_ENV };
  try {
    delete process.env.STOREFRONT_DEMO;
    delete process.env.VERCEL_ENV;
    assert.equal(demoEnabled(), false, "off by default");

    process.env.STOREFRONT_DEMO = "1";
    assert.equal(demoEnabled(), true, "on with the flag");

    process.env.VERCEL_ENV = "production";
    assert.equal(demoEnabled(), false, "never on the production deployment");

    process.env.VERCEL_ENV = "preview";
    assert.equal(demoEnabled(), true, "still available on previews");

    process.env.STOREFRONT_DEMO = "true";
    assert.equal(demoEnabled(), false, "exactly \"1\", not any truthy value");
  } finally {
    if (before.flag === undefined) delete process.env.STOREFRONT_DEMO;
    else process.env.STOREFRONT_DEMO = before.flag;
    if (before.env === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = before.env;
  }
});

test("the seed catalog survives the real derivation pipeline", () => {
  const raw = demoCatalog();
  const products = normalizeCategories(raw.results);
  assert.deepEqual(products, raw.results, "well-formed seed rows need no category repair");

  // Categories are rebuilt from the product rows exactly as live data is —
  // there is no category endpoint. Both levels come back in one flat list.
  const categories = buildCategories(products);
  const tops = categories.filter((c) => c.parentId === null);
  assert.deepEqual(
    tops.map((c) => c.name),
    [
      "Kiyim-kechak",
      "Oshxona buyumlari",
      "Qurilish mollari",
      "Telefon aksessuarlari",
      "Santexnika",
      "Telefon",
      "Boshqa mahsulotlar",
    ],
  );
  assert.ok(
    tops.slice(0, -1).every((top) => categories.some((c) => c.parentId === top.id)),
    "every real top category has at least one subcategory",
  );

  // Best sellers resolve against the same rows.
  const top = rankTopProducts(demoTopProductIds(), products);
  assert.equal(top.length, demoTopProductIds().length);
  assert.equal(top[0].name, "iPhone 13");

  assert.equal(demoStoreInfo().store, "Dukonline");
  assert.ok(products.every((p) => p.image === ""), "no hotlinked images");
});

test("the seed catalog covers every card state the UI can render", () => {
  const products = demoCatalog().results;
  const byId = (id: number) => products.find((p) => p.id === id)!;

  assert.ok(isOutOfStock(byId(3002)), "a sold-out product drives the Tugadi veil");
  assert.ok(byId(1002).stock <= 5, "a low-stock product drives the nudge line");
  assert.ok(byId(1002).discount_percent > 0, "a discounted product drives the −N% badge");
  assert.ok(byId(1001).has_variants && byId(1001).variants.length > 1, "size variants");
  assert.equal(byId(3001).stock_type, "untracked", "an untracked product");
  assert.ok(byId(2001).units.some((u) => u.multiplier > 1), "a multiplier (box) unit");
  assert.ok(byId(2002).units.some((u) => u.unit_name === "kg"), "a weight unit");
  assert.equal(byId(4001).units[0].currency, "USD", "a foreign-currency price");
  assert.ok(Object.keys(byId(6001).attributes).length > 0, "attributes for the spec table");

  // Both phone modes, so the IMEI flows are reachable without a live tenant.
  assert.equal(byId(6001).phone?.mode, "individual");
  assert.ok(byId(6001).phone!.groups.flatMap((g) => g.units).length >= 3, "individual copies");
  assert.equal(byId(6002).phone?.mode, "grouped");
  assert.ok(byId(6002).phone!.buckets.length >= 3, "priced buckets");

  assert.equal(byId(9001).category_id, null, "an uncategorized product drives the catch-all section");
});
