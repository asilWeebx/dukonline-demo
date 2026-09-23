import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCategories,
  filterProducts,
  groupByTopCategory,
  isOutOfStock,
  rankTopProducts,
  searchSuggestions,
  similarProducts,
} from "../src/lib/storefront/catalog.ts";

import { product, unit, variant } from "./fixtures.ts";

const shirts = product({ id: 1, name: "Ko'ylak oq", category_id: 11, category_name: "Ko'ylaklar", category_parent_id: 10, category_parent_name: "Kiyim" });
const trousers = product({ id: 2, name: "Shim qora", category_id: 12, category_name: "Shimlar", category_parent_id: 10, category_parent_name: "Kiyim" });
const phone = product({ id: 3, name: "iPhone 12", category_id: 20, category_name: "Telefonlar", units: [unit({ price: 6050000 })] });

test("categories are rebuilt from product rows in ERP order", () => {
  assert.deepEqual(buildCategories([shirts, trousers, phone]), [
    { id: 11, name: "Ko'ylaklar", parentId: 10 },
    { id: 10, name: "Kiyim", parentId: null },
    { id: 12, name: "Shimlar", parentId: 10 },
    { id: 20, name: "Telefonlar", parentId: null },
  ]);
});

test("the grid filters by subcategory, then top category, then name", () => {
  const all = [shirts, trousers, phone];
  assert.deepEqual(filterProducts(all, 10, 12, "").map((p) => p.id), [2]);
  assert.deepEqual(filterProducts(all, 10, null, "").map((p) => p.id), [1, 2]);
  assert.deepEqual(filterProducts(all, null, null, "IPHONE").map((p) => p.id), [3]);
});

test("products are grouped under their top category; empty groups are dropped", () => {
  const tops = buildCategories([shirts, trousers, phone]).filter((c) => !c.parentId);
  const groups = groupByTopCategory([shirts, trousers], tops);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].cat.id, 10);
  assert.deepEqual(groups[0].items.map((p) => p.id), [1, 2]);
});

test("search suggestions rank by shared words across name and category", () => {
  const all = [shirts, trousers, phone];
  assert.deepEqual(searchSuggestions("qora kiyim", all).map((p) => p.id), [2, 1]);
  assert.deepEqual(searchSuggestions("   ", all), []);
});

test("a misspelled query falls back to the closest names instead of nothing", () => {
  const all = [shirts, trousers, phone];
  // No word matches "ayfon", so word overlap returns nothing and the bigram
  // pass takes over rather than leaving the panel empty.
  assert.deepEqual(searchSuggestions("ayfon 12", all).map((p) => p.id), [3]);
  // Word overlap still wins whenever it finds anything at all.
  assert.deepEqual(searchSuggestions("iPhone", all).map((p) => p.id), [3]);
  // Gibberish stays empty rather than returning the whole catalog.
  assert.deepEqual(searchSuggestions("zzzzxxxx", all), []);
});

test("similar products: same category first, then same parent, nearest price first", () => {
  const cheap = product({ id: 4, category_id: 11, category_parent_id: 10, units: [unit({ price: 9000 })] });
  const pricey = product({ id: 5, category_id: 11, category_parent_id: 10, units: [unit({ price: 90000 })] });
  assert.deepEqual(similarProducts(shirts, [pricey, trousers, cheap, shirts, phone]).map((p) => p.id), [4, 5, 2]);
});

test("stock: variants follow in_stock, tracked units follow stock", () => {
  assert.equal(isOutOfStock(product({ stock: 0 })), true);
  assert.equal(isOutOfStock(product({ stock_type: "untracked", stock: 0 })), false);
  assert.equal(isOutOfStock(product({ has_variants: true, variants: [variant()], in_stock: false })), true);
});

test("best sellers keep rank order and skip unknown or sold-out ids", () => {
  const sold = product({ id: 9, stock: 0 });
  assert.deepEqual(rankTopProducts([3, 99, 9, 1], [shirts, phone, sold]).map((p) => p.id), [3, 1]);
});
