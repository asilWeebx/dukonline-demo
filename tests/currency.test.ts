import assert from "node:assert/strict";
import test from "node:test";

import { fmtQty, groupTotal, isWeightUnit, money, som } from "../src/lib/storefront/currency.ts";

test("so'm are rounded and grouped by thousands", () => {
  assert.equal(som(6050000), "6 050 000 so'm");
  assert.equal(som(999.6), "1 000 so'm");
  assert.equal(som(null), "0 so'm");
});

test("each price is shown in its own currency", () => {
  assert.equal(money(500, "USD"), "$500");
  assert.equal(money(1234.5, "USD"), "$1 234.50");
  assert.equal(money(50000, ""), "50 000 so'm");
  assert.equal(money(50000, "UZS"), "50 000 so'm");
  assert.equal(money(12, "EUR"), "EUR 12");
});

test("cart totals are summed per currency, never converted", () => {
  const items = [
    { currency: "USD", price: 6050000, cur_price: 500, qty: 2 },
    { currency: "", price: 150000, cur_price: 150000, qty: 2 },
  ];
  assert.equal(groupTotal(items), "$1 000  +  300 000 so'm");
  assert.equal(groupTotal([]), "0 so'm");
});

test("weight units allow fractions; other units do not", () => {
  for (const name of ["kg", "Kilogramm", "gramm", "g"]) assert.equal(isWeightUnit(name), true, name);
  for (const name of ["dona", "Metr", "Komplet", ""]) assert.equal(isWeightUnit(name), false, name);
});

test("quantities show without trailing float noise", () => {
  assert.equal(fmtQty(2), "2");
  assert.equal(fmtQty(0.1 + 0.2), "0.3");
  assert.equal(fmtQty(1.2346), "1.235");
});
