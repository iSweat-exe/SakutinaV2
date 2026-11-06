import { expect, test } from "bun:test";
import { CANDLE_COUNT, PERIOD_MS, bucketStart, fillCandles, parseMarket } from "./market-schema";

const row = {
  generated_at: "2026-11-05T10:20:00Z",
  currency_name: "pièces",
  period: "1H",
  opened: true,
  fund: 102_375,
  jackpot: 125,
  shares: 1000,
  server_shares: 900,
  week_net: 2375,
  price_cents: 10_237,
  holders: [{ member_id: "100000000000000001", shares: 100, name: "Aiko", avatar: null }],
  candles: [
    { t: "2026-11-05T09:00:00+00:00", o: 10_000, h: 10_300, l: 9_950, c: 10_200, v: 12 },
    { t: "2026-11-05T08:00:00+00:00", o: 10_000, h: 10_000, l: 10_000, c: 10_000, v: 0 },
  ],
};

test("parseMarket accepte la forme de la fonction SQL et range les bougies dans l'ordre", () => {
  const parsed = parseMarket(row);

  expect(parsed).toMatchObject({ currencyName: "pièces", period: "1H", fund: 102_375, priceCents: 10_237, serverShares: 900, weekNet: 2375 });
  expect(parsed?.holders).toEqual([{ memberId: "100000000000000001", shares: 100, name: "Aiko", avatar: null }]);
  expect(parsed?.candles.map((candle) => candle.t)).toEqual([Date.parse("2026-11-05T08:00:00Z"), Date.parse("2026-11-05T09:00:00Z")]);
});

test("parseMarket refuse ce qui n'a pas la forme attendue", () => {
  expect(parseMarket(null)).toBeNull();
  expect(parseMarket({ ...row, period: "2H" })).toBeNull();
  expect(parseMarket({ ...row, shares: 0 })).toBeNull();
  expect(parseMarket({ ...row, server_shares: 1001 })).toBeNull();
  expect(parseMarket({ ...row, candles: [{ ...row.candles[0], l: 20_000 }] })).toBeNull();
  expect(parseMarket({ ...row, candles: [{ ...row.candles[0], t: "hier" }] })).toBeNull();
  expect(parseMarket({ ...row, holders: [{ member_id: "x", shares: 1 }] })).toBeNull();
});

test("une semaine commence le lundi (UTC), comme dans la base", () => {
  // Jeudi 5 novembre 2026 → lundi 2 novembre.
  expect(new Date(bucketStart(Date.parse("2026-11-05T10:00:00Z"), "1W")).toISOString()).toBe("2026-11-02T00:00:00.000Z");
  expect(new Date(bucketStart(Date.parse("2026-11-05T10:20:00Z"), "15m")).toISOString()).toBe("2026-11-05T10:15:00.000Z");
});

test("les périodes sans mouvement sont comblées au cours précédent, jusqu'à maintenant", () => {
  const candles = parseMarket(row)!.candles;
  const filled = fillCandles(candles, "1H", Date.parse(row.generated_at), row.price_cents);

  expect(filled.map((candle) => new Date(candle.t).toISOString().slice(11, 16))).toEqual(["08:00", "09:00", "10:00"]);
  expect(filled[2]).toMatchObject({ o: 10_200, h: 10_200, l: 10_200, c: 10_200, v: 0 });
});

test("au plus 80 bougies, et une seule au cours actuel sans aucun historique", () => {
  const start = Date.parse("2026-01-01T00:00:00Z");
  const filled = fillCandles([{ t: start, o: 100, h: 100, l: 100, c: 100, v: 1 }], "15m", start + 200 * PERIOD_MS["15m"], 100);

  expect(filled).toHaveLength(CANDLE_COUNT);
  expect(filled[0]!.c).toBe(100);
  expect(fillCandles([], "1D", start, 9_999)).toEqual([{ t: start, o: 9_999, h: 9_999, l: 9_999, c: 9_999, v: 0 }]);
});
