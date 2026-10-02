import assert from "node:assert/strict";
import test from "node:test";

import {
  cheapestVariant,
  defaultVariant,
  hasVariantPhotos,
  isGroupedPhone,
  phoneChoices,
  productGallery,
  variantImage,
} from "../src/lib/storefront/product-view.ts";

import { bucket, group, phoneInfo, product, variant } from "./fixtures.ts";

test("a phone reads whichever list holds copies when its mode points at an empty one", () => {
  assert.equal(isGroupedPhone(phoneInfo({ mode: "individual", buckets: [bucket()] })), true);
  assert.equal(isGroupedPhone(phoneInfo({ mode: "grouped", groups: [group()] })), false);
  assert.equal(isGroupedPhone(phoneInfo({ mode: "unknown", buckets: [bucket()] })), true);
  // With both lists filled, `mode` decides.
  assert.equal(isGroupedPhone(phoneInfo({ mode: "grouped", groups: [group()], buckets: [bucket()] })), true);
  assert.equal(isGroupedPhone(phoneInfo({ mode: "individual", groups: [group()], buckets: [bucket()] })), false);
});

test("a blank storage is a choice of its own, so its copies stay reachable", () => {
  const known = group({ key: "a", storage: "128 GB" });
  const blank = group({ key: "b", storage: "", color: "blue" });

  const fromKnown = phoneChoices([known, blank], known);
  assert.deepEqual(fromKnown.storages, ["128 GB", ""]);
  assert.deepEqual(fromKnown.colors.map((g) => g.key), ["a"]);
  assert.deepEqual(phoneChoices([known, blank], blank).colors.map((g) => g.key), ["b"]);
});

test("regions follow the chosen colour, a blank colour included", () => {
  const us = group({ key: "us", color: "red", region: "US" });
  const eu = group({ key: "eu", color: "red", region: "EU" });
  const plain = group({ key: "plain", color: "", region: "" });
  assert.deepEqual(phoneChoices([us, eu, plain], us).regions.map((g) => g.key), ["us", "eu"]);
  assert.deepEqual(phoneChoices([us, eu, plain], plain).regions.map((g) => g.key), ["plain"]);
});

test("the gallery is the API's photos, then variant photos it lacks, without repeats", () => {
  const p = product({
    image: "https://cdn.example/a.jpg",
    images: ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"],
    has_variants: true,
    variants: [
      variant({ id: 1, image: "https://cdn.example/b.jpg" }),
      variant({ id: 2, image: "https://cdn.example/c.jpg" }),
      variant({ id: 3, image: null }),
    ],
  });
  assert.deepEqual(productGallery(p), [
    "https://cdn.example/a.jpg",
    "https://cdn.example/b.jpg",
    "https://cdn.example/c.jpg",
  ]);
  // Without `images` (older responses) the main photo stands alone; no photo at all is no gallery.
  assert.deepEqual(productGallery(product({ image: "https://cdn.example/a.jpg" })), ["https://cdn.example/a.jpg"]);
  assert.deepEqual(productGallery(product({ image: "", images: [] })), []);
});

test("a variant shows its own photo, else the product's", () => {
  const p = product({ image: "https://cdn.example/p.jpg" });
  assert.equal(variantImage(p, variant({ image: "https://cdn.example/v.jpg" })), "https://cdn.example/v.jpg");
  assert.equal(variantImage(p, variant({ image: null })), "https://cdn.example/p.jpg");
  assert.equal(variantImage(p, null), "https://cdn.example/p.jpg");
});

test("variants count as photos only when one differs from the product photo", () => {
  const same = variant({ id: 1, image: "https://cdn.example/p.jpg" });
  const own = variant({ id: 2, image: "https://cdn.example/v.jpg" });
  assert.equal(hasVariantPhotos(product({ has_variants: true, variants: [same, variant({ id: 3 })] })), false);
  assert.equal(hasVariantPhotos(product({ has_variants: true, variants: [same, own] })), true);
  assert.equal(hasVariantPhotos(product({ has_variants: false, variants: [own] })), false);
});

test("the product page opens on the linked variant, else the first in stock", () => {
  const sold = variant({ id: 1, in_stock: false, stock: 0 });
  const p = product({ has_variants: true, variants: [sold, variant({ id: 2 }), variant({ id: 3 })] });
  assert.equal(defaultVariant(p, 3)?.id, 3);
  // A shared link to a sold-out variant still shows that variant.
  assert.equal(defaultVariant(p, 1)?.id, 1);
  assert.equal(defaultVariant(p, 999)?.id, 2);
  assert.equal(defaultVariant(p, null)?.id, 2);
  assert.equal(defaultVariant(product(), 2), null);
});

test("a card's variant price is the cheapest in stock, marked 'dan' only when prices differ", () => {
  const p = product({
    has_variants: true,
    variants: [
      variant({ id: 1, cur_price: 9000, price: 9000, in_stock: false, stock: 0 }),
      variant({ id: 2, cur_price: 30000, price: 30000 }),
      variant({ id: 3, cur_price: 25000, price: 25000 }),
    ],
  });
  assert.deepEqual(cheapestVariant(p), { variant: p.variants[2], varies: true });

  const flat = product({ has_variants: true, variants: [variant({ id: 1 }), variant({ id: 2 })] });
  assert.equal(cheapestVariant(flat)?.varies, false);

  // Dollars are never compared with so'm: the first variant's currency decides.
  const mixed = product({
    has_variants: true,
    variants: [
      variant({ id: 1, currency: "USD", cur_price: 40, price: 500000 }),
      variant({ id: 2, currency: "", cur_price: 20000, price: 20000 }),
    ],
  });
  assert.equal(cheapestVariant(mixed)?.variant.id, 1);
  assert.equal(cheapestVariant(mixed)?.varies, true);
  assert.equal(cheapestVariant(product()), null);
});
