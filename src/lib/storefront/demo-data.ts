import "server-only";

import type {
  CatalogResponse,
  PhoneBucket,
  PhoneGroup,
  PhoneInfo,
  PhoneSerialUnit,
  Product,
  ProductUnit,
  ProductVariant,
  StoreInfo,
} from "./types";

/**
 * A plausible general-goods catalog, served only when `demoEnabled()` allows
 * it (see `demo.ts`). It goes through the real derivation pipeline in
 * `store.ts` — categories, best sellers and category images are all rebuilt
 * from these rows exactly as they are for live data, so the demo exercises the
 * same code the tenant does rather than a parallel happy path.
 *
 * Images are intentionally empty: `media("")` returns `""`, so every card
 * takes the real placeholder path instead of hotlinking pictures the shop does
 * not own. Between them the rows cover every state the UI can render — a
 * discount, a sold-out product, a low-stock nudge, multi-unit and multiplier
 * pricing, a weight unit, a foreign-currency price, size variants, a rich
 * attribute map for the spec table, and both phone modes.
 */

const CATEGORIES = {
  kiyim: { id: 10, name: "Kiyim-kechak" },
  oshxona: { id: 20, name: "Oshxona buyumlari" },
  asbob: { id: 30, name: "Qurilish mollari" },
  aksessuar: { id: 40, name: "Telefon aksessuarlari" },
  santexnika: { id: 50, name: "Santexnika" },
  telefon: { id: 60, name: "Telefon" },
} as const;

function unit(over: Partial<ProductUnit> = {}): ProductUnit {
  const price = over.price ?? 0;
  return {
    unit_id: 1,
    unit_name: "dona",
    multiplier: 1,
    price,
    original_price: null,
    currency: "",
    cur_price: over.cur_price ?? price,
    cur_original_price: over.cur_original_price ?? over.original_price ?? null,
    ...over,
  };
}

function variant(over: Partial<ProductVariant> & { id: number; name: string }): ProductVariant {
  const price = over.price ?? 0;
  return {
    price,
    original_price: null,
    currency: "",
    cur_price: over.cur_price ?? price,
    cur_original_price: over.cur_original_price ?? over.original_price ?? null,
    stock: 10,
    in_stock: true,
    ...over,
  };
}

function product(over: Partial<Product> & { id: number; name: string }): Product {
  return {
    sku: `DEMO-${over.id}`,
    description: "",
    category_id: null,
    category_name: null,
    category_parent_id: null,
    category_parent_name: null,
    image: "",
    stock_type: "tracked",
    stock: 25,
    in_stock: true,
    has_variants: false,
    variants: [],
    units: [unit({ price: 50000 })],
    discount_percent: 0,
    product_type: "tovar",
    attributes: {},
    phone: null,
    ...over,
  };
}

/** Puts a product in a category without repeating both levels every time. */
function inCategory(
  parent: { id: number; name: string },
  subId: number,
  subName: string,
): Pick<Product, "category_id" | "category_name" | "category_parent_id" | "category_parent_name"> {
  return {
    category_id: subId,
    category_name: subName,
    category_parent_id: parent.id,
    category_parent_name: parent.name,
  };
}

function serial(over: Partial<PhoneSerialUnit> & { id: number; imei_masked: string }): PhoneSerialUnit {
  const price = over.price ?? 0;
  return {
    condition: "used",
    condition_label: "Ishlatilgan",
    battery_health: 92,
    battery_cycles: 210,
    note: "",
    price,
    cur_price: over.cur_price ?? price,
    currency: "",
    ...over,
  };
}

function group(over: Partial<PhoneGroup> & { key: string; units: PhoneSerialUnit[] }): PhoneGroup {
  return {
    storage: "128GB",
    color: "black",
    color_label: "Qora",
    color_hex: "#1c1c1e",
    region: "LL/A",
    count: over.units.length,
    uniform: false,
    ...over,
  };
}

function bucket(over: Partial<PhoneBucket> & { key: string }): PhoneBucket {
  const price = over.price ?? 0;
  return {
    storage: "128GB",
    color: "black",
    color_label: "Qora",
    color_hex: "#1c1c1e",
    region: "LL/A",
    base_price: over.base_price ?? price,
    currency: "",
    price,
    original_price: null,
    cur_price: over.cur_price ?? price,
    cur_original_price: null,
    count: 4,
    ...over,
  };
}

/** `individual`: every copy is listed with its own IMEI and battery health. */
const INDIVIDUAL_PHONE: PhoneInfo = {
  mode: "individual",
  from_price: 7_200_000,
  from_cur_price: 7_200_000,
  currency: "",
  buckets: [],
  groups: [
    group({
      key: "128-black-lla",
      storage: "128GB",
      color_label: "Qora",
      color_hex: "#1c1c1e",
      units: [
        serial({ id: 9001, imei_masked: "35•••••••••4412", price: 7_200_000, battery_health: 89, battery_cycles: 310 }),
        serial({
          id: 9002,
          imei_masked: "35•••••••••7781",
          price: 7_450_000,
          battery_health: 96,
          battery_cycles: 120,
          note: "Quti va zaryadlagichi bilan",
        }),
      ],
    }),
    group({
      key: "256-white-lla",
      storage: "256GB",
      color: "white",
      color_label: "Oq",
      color_hex: "#f2f1ed",
      units: [
        serial({
          id: 9003,
          imei_masked: "35•••••••••2290",
          price: 8_900_000,
          condition: "new",
          condition_label: "Yangi",
          battery_health: 100,
          battery_cycles: 0,
        }),
      ],
    }),
  ],
};

/** `grouped`: spec + price buckets sold by count, no IMEIs shown. */
const GROUPED_PHONE: PhoneInfo = {
  mode: "grouped",
  from_price: 3_100_000,
  from_cur_price: 3_100_000,
  currency: "",
  groups: [],
  buckets: [
    bucket({ key: "128-black", storage: "128GB", price: 3_100_000, count: 6 }),
    bucket({
      key: "128-blue",
      storage: "128GB",
      color: "blue",
      color_label: "Ko'k",
      color_hex: "#2f4f7f",
      price: 3_250_000,
      count: 3,
    }),
    bucket({ key: "256-black", storage: "256GB", price: 3_780_000, count: 2 }),
  ],
};

const PRODUCTS: Product[] = [
  // ── Kiyim-kechak ────────────────────────────────────────────────
  product({
    id: 1001,
    name: "Erkaklar paxta futbolkasi",
    ...inCategory(CATEGORIES.kiyim, 11, "Futbolkalar"),
    description: "100% paxta, kundalik kiyim uchun. Mashinada yuvsa bo'ladi.",
    has_variants: true,
    stock: 42,
    variants: [
      variant({ id: 1, name: "S", price: 89_000, stock: 12 }),
      variant({ id: 2, name: "M", price: 89_000, stock: 18 }),
      variant({ id: 3, name: "L", price: 95_000, stock: 9 }),
      variant({ id: 4, name: "XL", price: 95_000, stock: 0, in_stock: false }),
    ],
    units: [unit({ price: 89_000 })],
    attributes: { Material: "100% paxta", "Ishlab chiqaruvchi": "O'zbekiston", Mavsum: "Yoz" },
  }),
  product({
    id: 1002,
    name: "Ayollar qishki kurtkasi",
    ...inCategory(CATEGORIES.kiyim, 12, "Ustki kiyim"),
    description: "Suv o'tkazmaydigan tashqi qatlam, sintepon isitgich.",
    // Low-stock nudge on the card.
    stock: 3,
    units: [unit({ price: 690_000, original_price: 850_000 })],
    discount_percent: 19,
    attributes: { Material: "Polyester", Isitgich: "Sintepon 200g", Rang: "Qora" },
  }),

  // ── Oshxona buyumlari ───────────────────────────────────────────
  product({
    id: 2001,
    name: "Yopishmaydigan tovalar to'plami",
    ...inCategory(CATEGORIES.oshxona, 21, "Idish-tovoq"),
    description: "Uch o'lchamli to'plam: 20, 24 va 28 sm.",
    stock: 24,
    // Two units, the second a box of six, to exercise multiplier pricing.
    units: [
      unit({ unit_id: 1, unit_name: "to'plam", price: 420_000 }),
      unit({ unit_id: 2, unit_name: "quti (6 to'plam)", multiplier: 6, price: 2_350_000 }),
    ],
    attributes: { "O'lchamlar": "20 / 24 / 28 sm", Qoplama: "Yopishmaydigan", Induksiya: "Mos" },
  }),
  product({
    id: 2002,
    name: "Uzoq saqlanadigan guruch",
    ...inCategory(CATEGORIES.oshxona, 22, "Oziq-ovqat"),
    description: "Lazer bilan saralangan, toza guruch.",
    stock: 480,
    // Weight unit: quantity steps in fractions rather than whole pieces.
    units: [unit({ unit_id: 3, unit_name: "kg", price: 18_000 })],
    attributes: { Navi: "Lazer", "Kelib chiqishi": "Farg'ona" },
  }),

  // ── Qurilish mollari ────────────────────────────────────────────
  product({
    id: 3001,
    name: "Akkumulyatorli shurupovyort 18V",
    ...inCategory(CATEGORIES.asbob, 31, "Elektr asboblar"),
    description: "Ikkita akkumulyator, zaryadlagich va keys bilan.",
    // Untracked: always sellable, no stock line.
    stock_type: "untracked",
    stock: 0,
    units: [unit({ price: 1_150_000 })],
    attributes: { Kuchlanish: "18V", Akkumulyator: "2 × 2.0Ah", Kafolat: "12 oy" },
  }),
  product({
    id: 3002,
    name: "O'lchov ruletkasi 5m",
    ...inCategory(CATEGORIES.asbob, 32, "Qo'l asboblari"),
    // Sold out: veil, "Tugadi" pill and a disabled button.
    stock: 0,
    in_stock: false,
    units: [unit({ price: 45_000 })],
    attributes: { Uzunligi: "5 m", Kengligi: "25 mm" },
  }),

  // ── Telefon aksessuarlari ───────────────────────────────────────
  product({
    id: 4001,
    name: "Simsiz quloqchin ANC",
    ...inCategory(CATEGORIES.aksessuar, 41, "Quloqchinlar"),
    description: "Faol shovqin bostirish, 30 soatgacha ishlash vaqti.",
    stock: 15,
    // Priced in USD: the card shows the dollar figure, with the so'm
    // equivalent underneath. Nothing is converted at render time.
    units: [unit({ price: 1_020_000, currency: "USD", cur_price: 85, cur_original_price: 99, original_price: 1_190_000 })],
    discount_percent: 14,
    attributes: { "Ishlash vaqti": "30 soat", Bluetooth: "5.3", ANC: "Bor" },
  }),
  product({
    id: 4002,
    name: "Powerbank 20000mAh",
    ...inCategory(CATEGORIES.aksessuar, 42, "Quvvat manbalari"),
    stock: 60,
    units: [unit({ price: 265_000 })],
    attributes: { "Sig'imi": "20000 mAh", Chiqish: "22.5W", Portlar: "USB-A + USB-C" },
  }),

  // ── Santexnika ──────────────────────────────────────────────────
  product({
    id: 5001,
    name: "Metalloplastik quvur 20mm",
    ...inCategory(CATEGORIES.santexnika, 51, "Quvurlar"),
    description: "Issiq va sovuq suv uchun.",
    stock: 850,
    units: [unit({ unit_id: 4, unit_name: "metr", price: 22_000 })],
    attributes: { Diametri: "20 mm", Bosim: "10 bar" },
  }),
  product({
    id: 5002,
    name: "Oshxona smesiteli",
    ...inCategory(CATEGORIES.santexnika, 52, "Smesitellar"),
    stock: 11,
    units: [unit({ price: 380_000 })],
    attributes: { Material: "Latun", Qoplama: "Xrom" },
  }),

  // ── Telefon (IMEI) ──────────────────────────────────────────────
  product({
    id: 6001,
    name: "iPhone 13",
    ...inCategory(CATEGORIES.telefon, 61, "Apple"),
    description: "Rasmiy import, IMEI bo'yicha hisobga olingan.",
    product_type: "telefon",
    stock: 3,
    units: [],
    phone: INDIVIDUAL_PHONE,
    attributes: { Ekran: "6.1\" OLED", Protsessor: "A15 Bionic", Kafolat: "3 oy" },
  }),
  product({
    id: 6002,
    name: "Redmi Note 13",
    ...inCategory(CATEGORIES.telefon, 62, "Xiaomi"),
    description: "Yangi, quti bilan.",
    product_type: "telefon",
    stock: 11,
    units: [],
    phone: GROUPED_PHONE,
    attributes: { Ekran: "6.67\" AMOLED", Batareya: "5000 mAh", Kafolat: "12 oy" },
  }),

  // ── Kategoriyasiz ───────────────────────────────────────────────
  // No inCategory() call — ERP rows land here whenever a product was never
  // filed under a category, exercising the "Boshqa mahsulotlar" catch-all.
  product({
    id: 9001,
    name: "Bayram sharlari to'plami",
    description: "Bo'limga hali biriktirilmagan mahsulot.",
    stock: 30,
    units: [unit({ price: 35_000 })],
  }),
];

export function demoStoreInfo(): StoreInfo {
  return {
    organization: "Dukonline demo",
    store: "Dukonline",
    currency: "so'm",
    banners: [],
  };
}

export function demoCatalog(): CatalogResponse {
  return {
    store: "Dukonline",
    results: PRODUCTS.map((p) => ({ ...p })),
    show_stock: true,
    show_images: true,
    category_images: [],
  };
}

/** Best sellers, in the order the ERP would rank them. */
export function demoTopProductIds(): number[] {
  return [6001, 4001, 2001, 1002, 3001, 5001, 1001, 4002];
}
