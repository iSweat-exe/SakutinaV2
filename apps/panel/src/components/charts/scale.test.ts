import { expect, test } from "bun:test";
import { niceScale } from "./scale";

test("niceScale : des bornes rondes qui contiennent les données, avec un pas de 1, 2 ou 5 × 10^n", () => {
  expect(niceScale(1_080_000, 1_200_000)).toEqual({ lo: 1_050_000, hi: 1_200_000, step: 50_000 });
  expect(niceScale(0, 1000)).toEqual({ lo: 0, hi: 1000, step: 500 });
  expect(niceScale(130, 4870)).toEqual({ lo: 0, hi: 6000, step: 2000 });
  expect(niceScale(1800, 2000)).toEqual({ lo: 1800, hi: 2000, step: 50 });
});

test("niceScale : une série plate a de la place des deux côtés, jamais sous zéro", () => {
  const flat = niceScale(500, 500);
  expect(flat.lo).toBeLessThan(500);
  expect(flat.hi).toBeGreaterThan(500);
  expect(flat.lo).toBeGreaterThanOrEqual(0);

  expect(niceScale(0, 0)).toEqual({ lo: 0, hi: 10, step: 5 });
});
