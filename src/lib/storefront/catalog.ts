import type { Category, CategoryImage, Product } from "./types";

/**
 * The API returns no category tree — each product just carries its category
 * and that category's parent. The flat list is rebuilt here from the product
 * rows, in the order the ERP first mentions each category.
 */
export function buildCategories(products: Product[]): Category[] {
  const map = new Map<number, Category>();
  for (const p of products) {
    if (p.category_id && p.category_name) {
      map.set(p.category_id, {
        id: p.category_id,
        name: p.category_name,
        parentId: p.category_parent_id || null,
      });
    }
    if (p.category_parent_id && p.category_parent_name && !map.has(p.category_parent_id)) {
      map.set(p.category_parent_id, {
        id: p.category_parent_id,
        name: p.category_parent_name,
        parentId: null,
      });
    }
  }
  return [...map.values()];
}

export function categoryImageMap(images: CategoryImage[] | undefined): Record<number, string> {
  return Object.fromEntries((images ?? []).map((c) => [c.id, c.image]));
}

/** Sold out regardless of which unit or variant is picked. */
export function isOutOfStock(p: Product): boolean {
  return p.has_variants && p.variants?.length
    ? !p.in_stock
    : p.stock_type === "tracked" && (p.stock ?? 0) <= 0;
}

/** Rough price used only to order "similar" products by closeness. */
export function approxPrice(p: Product): number {
  return p.units?.[0]?.price ?? p.variants?.[0]?.price ?? 0;
}

/**
 * Products in the same category (then the same parent category), nearest in
 * price first. Derived from the loaded catalog — no API call.
 */
export function similarProducts(p: Product | null, all: Product[], limit = 10): Product[] {
  if (!p) return [];
  const sameCat: Product[] = [];
  const sameParent: Product[] = [];
  for (const x of all) {
    if (x.id === p.id) continue;
    if (p.category_id && x.category_id === p.category_id) sameCat.push(x);
    else if (p.category_parent_id && x.category_parent_id === p.category_parent_id) sameParent.push(x);
  }
  const base = approxPrice(p);
  const byCloseness = (list: Product[]) =>
    [...list].sort((a, b) => Math.abs(approxPrice(a) - base) - Math.abs(approxPrice(b) - base));
  return [...byCloseness(sameCat), ...byCloseness(sameParent)].slice(0, limit);
}

/** Search text for a product — name, SKU and both category levels. */
function haystack(p: Product): string {
  return [p.name, p.sku, p.category_name, p.category_parent_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Character pairs, used to score how close two strings look. */
function bigrams(value: string): Set<string> {
  const normalized = value.toLowerCase().replace(/[^a-z0-9а-яёўқғҳ]+/gi, " ").trim();
  const pairs = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) pairs.add(normalized.slice(i, i + 2));
  return pairs;
}

/**
 * When a search has no exact match: products whose name, SKU or category
 * shares any word with the query, most shared words first.
 *
 * Word overlap runs first because it ranks meaningfully — two shared words
 * beat one. Only when it finds nothing does the bigram pass run, so a
 * misspelling ("kiyum") still returns something instead of an empty panel.
 */
export function searchSuggestions(query: string, all: Product[], limit = 8): Product[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const scored: [Product, number][] = [];
  for (const p of all) {
    const hay = haystack(p);
    const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
    if (score > 0) scored.push([p, score]);
  }
  if (scored.length) {
    scored.sort((a, b) => b[1] - a[1]);
    return scored.slice(0, limit).map((s) => s[0]);
  }

  const queryPairs = bigrams(query);
  if (!queryPairs.size) return [];
  return all
    .map((p) => {
      const productPairs = bigrams(haystack(p));
      let overlap = 0;
      queryPairs.forEach((pair) => {
        if (productPairs.has(pair)) overlap++;
      });
      return { p, score: overlap / queryPairs.size };
    })
    .filter(({ score }) => score >= 0.22)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ p }) => p);
}

/** The home grid: a subcategory, else a top category (with its children), then a name search. */
export function filterProducts(
  products: Product[],
  selTop: number | null,
  selSub: number | null,
  search: string,
): Product[] {
  let list = products;
  if (selSub) list = list.filter((p) => p.category_id === selSub);
  else if (selTop) list = list.filter((p) => p.category_id === selTop || p.category_parent_id === selTop);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q));
  }
  return list;
}

export interface CategorySection {
  cat: Category;
  items: Product[];
}

/** Groups products under their top-level category, keeping ERP order; empty groups are dropped. */
export function groupByTopCategory(products: Product[], topCats: Category[]): CategorySection[] {
  const byCat = new Map<number, Product[]>(topCats.map((c) => [c.id, []]));
  for (const p of products) {
    const topId = p.category_parent_id || p.category_id;
    if (topId != null) byCat.get(topId)?.push(p);
  }
  return topCats
    .map((cat) => ({ cat, items: byCat.get(cat.id) ?? [] }))
    .filter((g) => g.items.length > 0);
}

/** Best-seller IDs matched against the catalog in rank order, sold-out ones skipped. */
export function rankTopProducts(ids: number[], products: Product[]): Product[] {
  if (!ids.length || !products.length) return [];
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is Product => Boolean(p))
    .filter((p) => !isOutOfStock(p));
}
