import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCategories,
  filterProducts,
  groupByTopCategory,
  isOutOfStock,
  normalizeCategories,
  rankTopProducts,
  searchSuggestions,
  similarProducts,
  UNCATEGORIZED_ID,
} from "../src/lib/storefront/catalog.ts";
import type { Product } from "../src/lib/storefront/types.ts";

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

test("products with no category get a synthetic catch-all, appended last", () => {
  const bare = product({ id: 6, name: "Balonchik", category_id: null, category_name: null, category_parent_id: null, category_parent_name: null });
  const all = [shirts, trousers, phone, bare];

  const cats = buildCategories(all);
  assert.deepEqual(cats.at(-1), { id: UNCATEGORIZED_ID, name: "Boshqa mahsulotlar", parentId: null });

  const tops = cats.filter((c) => !c.parentId);
  const groups = groupByTopCategory(all, tops);
  assert.deepEqual(groups.at(-1)?.items.map((p) => p.id), [6]);

  assert.deepEqual(filterProducts(all, UNCATEGORIZED_ID, null, "").map((p) => p.id), [6]);
});

test("a fully categorized catalog gets no catch-all category", () => {
  const cats = buildCategories([shirts, trousers, phone]);
  assert.equal(cats.some((c) => c.id === UNCATEGORIZED_ID), false);
});

/** The storefront's own derivation: normalize the rows, rebuild categories, group the home grid. */
function homeGrid(rows: Product[]) {
  const products = normalizeCategories(rows);
  const cats = buildCategories(products);
  const tops = cats.filter((c) => !c.parentId);
  return { products, cats, tops, sections: groupByTopCategory(products, tops) };
}

const sectionIds = (sections: ReturnType<typeof groupByTopCategory>) =>
  sections.map((s) => [s.cat.id, s.items.map((p) => p.id)]);

test("well-formed rows pass through normalization unchanged", () => {
  const bare = product({ id: 6, category_id: null, category_name: null });
  const rows = [shirts, trousers, phone, bare];
  assert.deepEqual(normalizeCategories(rows), rows);
});

test("a name missing on one row is taken from another row of the same category", () => {
  const bare = product({ id: 7, category_id: 11, category_name: null, category_parent_id: 10, category_parent_name: "" });
  const [, fixed] = normalizeCategories([shirts, bare]);
  assert.equal(fixed.category_name, "Ko'ylaklar");
  assert.equal(fixed.category_parent_name, "Kiyim");
});

test("a nameless category hands its products to its named parent, else to the catch-all", () => {
  const underParent = product({ id: 30, category_id: 31, category_name: null, category_parent_id: 10, category_parent_name: "Kiyim" });
  const alone = product({ id: 32, category_id: 33, category_name: null });
  const { products, tops, sections } = homeGrid([underParent, alone]);

  assert.deepEqual(tops.map((c) => c.id), [10, UNCATEGORIZED_ID]);
  assert.deepEqual(sectionIds(sections), [[10, [30]], [UNCATEGORIZED_ID, [32]]]);
  assert.deepEqual(filterProducts(products, UNCATEGORIZED_ID, null, "").map((p) => p.id), [32]);
});

test("a subcategory whose parent has no name becomes a top category", () => {
  const orphan = product({ id: 40, category_id: 41, category_name: "Rezina", category_parent_id: 99, category_parent_name: null });
  const { cats, sections } = homeGrid([shirts, orphan]);

  assert.deepEqual(cats.find((c) => c.id === 41), { id: 41, name: "Rezina", parentId: null });
  assert.deepEqual(sectionIds(sections), [[10, [1]], [41, [40]]]);
});

test("a product with only a parent category sits in that parent", () => {
  const parentOnly = product({ id: 42, category_id: null, category_name: null, category_parent_id: 10, category_parent_name: "Kiyim" });
  const { products, sections } = homeGrid([shirts, parentOnly]);

  assert.deepEqual(sectionIds(sections), [[10, [1, 42]]]);
  assert.deepEqual(filterProducts(products, UNCATEGORIZED_ID, null, "").map((p) => p.id), []);
});

test("a third level is lifted under its top category, labelled with the level between", () => {
  const inMen = product({ id: 50, category_id: 51, category_name: "Erkaklar", category_parent_id: 10, category_parent_name: "Kiyim" });
  const inMenShirts = product({ id: 52, category_id: 53, category_name: "Ko'ylaklar", category_parent_id: 51, category_parent_name: "Erkaklar" });

  // The ERP may mention the levels in either order.
  for (const rows of [[inMen, inMenShirts], [inMenShirts, inMen]]) {
    const { products, cats, sections } = homeGrid(rows);
    assert.deepEqual(
      cats.filter((c) => c.parentId === 10).map((c) => c.name).sort(),
      ["Erkaklar", "Erkaklar › Ko'ylaklar"],
    );
    assert.deepEqual(sectionIds(sections), [[10, rows.map((p) => p.id)]]);
    assert.deepEqual(filterProducts(products, 10, 53, "").map((p) => p.id), [52]);
  }
});

test("a loop in the category rows still ends at a single top category", () => {
  const x = product({ id: 60, category_id: 61, category_name: "X", category_parent_id: 62, category_parent_name: "Y" });
  const y = product({ id: 63, category_id: 62, category_name: "Y", category_parent_id: 61, category_parent_name: "X" });
  const { tops, sections } = homeGrid([x, y]);

  assert.equal(tops.length, 1);
  assert.deepEqual(sectionIds(sections), [[tops[0].id, [60, 63]]]);
});

test("every product lands in exactly one home section and behind a category chip", () => {
  const rows = [
    shirts,
    trousers,
    phone,
    product({ id: 70, category_id: null, category_name: null }),
    product({ id: 71, category_id: 81, category_name: null }),
    product({ id: 72, category_id: 82, category_name: null, category_parent_id: 20, category_parent_name: "Telefonlar" }),
    product({ id: 73, category_id: 83, category_name: "Yetim", category_parent_id: 98, category_parent_name: null }),
    product({ id: 74, category_id: 84, category_name: "Erkaklar", category_parent_id: 10, category_parent_name: "Kiyim" }),
    product({ id: 75, category_id: 85, category_name: "Ko'ylaklar", category_parent_id: 84, category_parent_name: "Erkaklar" }),
    product({ id: 76, category_id: null, category_name: null, category_parent_id: 20, category_parent_name: "Telefonlar" }),
  ];
  const { products, cats, tops, sections } = homeGrid(rows);

  const inSections = sections.flatMap((s) => s.items.map((p) => p.id));
  assert.equal(inSections.length, rows.length, "the sections add up to the catalog");
  assert.equal(new Set(inSections).size, rows.length, "and hold no product twice");

  const behindChips = new Set(tops.flatMap((t) => filterProducts(products, t.id, null, "").map((p) => p.id)));
  assert.equal(behindChips.size, rows.length, "every product is behind a top category chip");
  for (const sub of cats.filter((c) => c.parentId)) {
    assert.ok(filterProducts(products, sub.parentId, sub.id, "").length > 0, `the "${sub.name}" chip is not empty`);
  }
});

test("rows that skipped normalization still get a section instead of vanishing", () => {
  const raw = product({ id: 90, category_id: 91, category_name: null });
  const tops = buildCategories([shirts]).filter((c) => !c.parentId);
  assert.deepEqual(sectionIds(groupByTopCategory([shirts, raw], tops)), [[10, [1]], [UNCATEGORIZED_ID, [90]]]);
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

test("similar products: an uncategorized product only matches other uncategorized ones", () => {
  const bareA = product({ id: 6, category_id: null, category_name: null });
  const bareB = product({ id: 7, category_id: null, category_name: null });
  assert.deepEqual(similarProducts(bareA, [shirts, bareB, phone]).map((p) => p.id), [7]);
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
