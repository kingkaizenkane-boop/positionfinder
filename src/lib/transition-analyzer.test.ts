import { describe, expect, it } from "vitest";

import {
  analyzeTransitions,
  formatDrawNumbers,
  formatNumber,
  parseHistoricalGames,
  type HistoricalDraw,
  type Numbers,
} from "./transition-analyzer";

const firstValidDraw = (text: string) => {
  const record = parseHistoricalGames(text).valid[0];
  if (!record) throw new Error("Expected at least one valid historical draw.");
  return record;
};

const draw = (
  id: string,
  drawNumber: number,
  drawDate: string,
  numbers: Numbers,
  gameName = "Test Game",
): HistoricalDraw => ({ id, drawNumber, drawDate, numbers, gameName });

const transitionExists = (
  result: ReturnType<typeof analyzeTransitions>,
  sourcePosition: number,
  sourceNumber: number,
  targetPosition: number,
  targetNumber: number,
) => result.allTransitions.some(
  (transition) =>
    transition.sourcePosition === sourcePosition &&
    transition.sourceNumber === sourceNumber &&
    transition.targetPosition === targetPosition &&
    transition.targetNumber === targetNumber,
);

describe("historical importer parser", () => {
  it("parses concatenated numbers into the immutable ten positions", () => {
    const record = firstValidDraw("0943: 05/01/2024: 3917742945 | 8341014631");

    expect(record.drawNumber).toBe(943);
    expect(record.drawDate).toBe("2024-01-05");
    expect(record.numbers).toEqual([39, 17, 74, 29, 45, 83, 41, 1, 46, 31]);
  });

  it("parses spaced numbers identically to concatenated numbers", () => {
    const compact = firstValidDraw("0943: 05/01/2024: 3917742945 | 8341014631");
    const spaced = firstValidDraw("0943: 05/01/2024: 39 17 74 29 45 | 83 41 01 46 31");

    expect(spaced.numbers).toEqual(compact.numbers);
  });

  it("keeps three game sections associated with their own draws", () => {
    const parsed = parseHistoricalGames(`
Golden Chance Albarka
0943: 05/01/2024: 3917742945 | 8341014631
Golden Chance Bazooka
0567: 05/01/2024: 1234567890 | 1122334455
Golden Chance Bravo
0789: 05/01/2024: 1020304050 | 6070809011
`);

    expect(parsed.games.map((game) => game.name)).toEqual([
      "Golden Chance Albarka",
      "Golden Chance Bazooka",
      "Golden Chance Bravo",
    ]);
    expect(parsed.valid.map((record) => [record.drawNumber, record.gameName])).toEqual([
      [943, "Golden Chance Albarka"],
      [567, "Golden Chance Bazooka"],
      [789, "Golden Chance Bravo"],
    ]);
  });

  it("preserves leading-zero values numerically and formats them with two digits", () => {
    const record = firstValidDraw("0943: 05/01/2024: 01050809 10 | 12 13 14 15 16");

    expect(record.numbers.slice(0, 4)).toEqual([1, 5, 8, 9]);
    expect([1, 5, 8, 9].map(formatNumber)).toEqual(["01", "05", "08", "09"]);
    expect(formatDrawNumbers(record.numbers)).toBe("01 05 08 09 10  |  12 13 14 15 16");
  });

  it("identifies a repeated draw as a duplicate rather than a second valid draw", () => {
    const parsed = parseHistoricalGames(`
Golden Chance Albarka
0943: 05/01/2024: 3917742945 | 8341014631
0943: 05/01/2024: 3917742945 | 8341014631
`);

    expect(parsed.valid).toHaveLength(1);
    expect(parsed.duplicates).toHaveLength(1);
    expect(parsed.invalid[0]?.reason).toContain("Duplicate draw detected");
  });
});

describe("positional transition analyzer", () => {
  it("reports a sequence gap and excludes 0945 to 0947 while retaining valid adjacent pairs", () => {
    const parsed = parseHistoricalGames(`
Gap Game
0943: 05/01/2024: 3917742945 | 8341014631
0944: 12/01/2024: 4017742945 | 8341014631
0945: 19/01/2024: 4117742945 | 8341014631
0947: 02/02/2024: 4217742945 | 8341014631
0948: 09/02/2024: 4317742945 | 8341014631
`);

    expect(parsed.sequenceWarnings).toHaveLength(1);
    expect(parsed.sequenceWarnings[0]?.message).toContain("0946 missing between 0945 and 0947");

    const result = analyzeTransitions([39, 40, 41, 42, 43, 83, 41, 1, 46, 31], parsed.valid, 1);
    const evidencePairs = new Set(
      result.allTransitions.flatMap((transition) =>
        transition.evidence.map(({ historicalDraw, nextDraw }) => `${historicalDraw.drawNumber}->${nextDraw.drawNumber}`),
      ),
    );

    expect(evidencePairs).toEqual(new Set(["943->944", "944->945", "947->948"]));
    expect(evidencePairs.has("945->947")).toBe(false);
  });

  it("generates exactly 100 distinct positional relationships for one consecutive pair", () => {
    const sourceNumbers = [64, 11, 22, 33, 44, 55, 66, 77, 88, 90] as Numbers;
    const targetNumbers = [28, 12, 23, 34, 45, 56, 67, 78, 89, 10] as Numbers;
    const result = analyzeTransitions(
      sourceNumbers,
      [
        draw("source", 1, "2024-01-01", sourceNumbers),
        draw("target", 2, "2024-01-02", targetNumbers),
      ],
      1,
    );

    expect(result.allTransitions).toHaveLength(100);
    expect(result.transitions).toHaveLength(100);
  });

  it("does not collapse identical numbers when their positions differ", () => {
    const sourceNumbers = [64, 64, 11, 12, 13, 14, 15, 16, 17, 18] as Numbers;
    const targetNumbers = [20, 21, 28, 28, 30, 31, 32, 33, 34, 35] as Numbers;
    const result = analyzeTransitions(
      sourceNumbers,
      [
        draw("source", 1, "2024-01-01", sourceNumbers),
        draw("target", 2, "2024-01-02", targetNumbers),
      ],
      1,
    );

    expect(transitionExists(result, 1, 64, 4, 28)).toBe(true);
    expect(transitionExists(result, 2, 64, 4, 28)).toBe(true);
    expect(transitionExists(result, 1, 64, 3, 28)).toBe(true);
  });

  it("aggregates repeated evidence without changing the atomic transition identity", () => {
    const sourceNumbers = [64, 11, 12, 13, 14, 15, 16, 17, 18, 19] as Numbers;
    const targetNumbers = [20, 21, 22, 28, 30, 31, 32, 33, 34, 35] as Numbers;
    const result = analyzeTransitions(
      sourceNumbers,
      [
        draw("source-1", 1, "2024-01-01", sourceNumbers),
        draw("target-1", 2, "2024-01-02", targetNumbers),
        draw("source-2", 10, "2024-02-01", sourceNumbers),
        draw("target-2", 11, "2024-02-02", targetNumbers),
      ],
      2,
    );
    const transition = result.transitions.find(
      (item) => item.sourcePosition === 1 && item.sourceNumber === 64 && item.targetPosition === 4 && item.targetNumber === 28,
    );

    expect(transition).toBeDefined();
    expect(transition?.occurrenceCount).toBe(2);
    expect(transition?.evidence).toHaveLength(2);
    expect(transition?.sourcePosition).toBe(1);
    expect(transition?.sourceNumber).toBe(64);
    expect(transition?.targetPosition).toBe(4);
    expect(transition?.targetNumber).toBe(28);
  });

  it("isolates games so overlapping draw numbers cannot cross-pair", () => {
    const sourceA = [64, 11, 12, 13, 14, 15, 16, 17, 18, 19] as Numbers;
    const targetA = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29] as Numbers;
    const sourceB = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40] as Numbers;
    const targetB = [41, 42, 43, 44, 45, 46, 47, 48, 49, 50] as Numbers;
    const result = analyzeTransitions(
      sourceA,
      [
        draw("a-1", 1, "2024-01-01", sourceA, "Game A"),
        draw("a-2", 2, "2024-01-02", targetA, "Game A"),
        draw("b-1", 1, "2024-01-01", sourceB, "Game B"),
        draw("b-2", 2, "2024-01-02", targetB, "Game B"),
      ],
      1,
    );

    expect(result.allTransitions.some((transition) => transition.evidence.some(({ historicalDraw, nextDraw }) => historicalDraw.id === "a-1" && nextDraw.id === "a-2"))).toBe(true);
    expect(result.allTransitions.some((transition) => transition.evidence.some(({ historicalDraw, nextDraw }) => historicalDraw.id === "b-1" && nextDraw.id === "b-2"))).toBe(true);
    expect(result.allTransitions.some((transition) => transition.evidence.some(({ historicalDraw, nextDraw }) => historicalDraw.id === "a-1" && nextDraw.id === "b-2"))).toBe(false);
  });

  it("orders draws chronologically before applying draw-number adjacency", () => {
    const numbers = [64, 11, 12, 13, 14, 15, 16, 17, 18, 19] as Numbers;
    const nextNumbers = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29] as Numbers;
    const finalNumbers = [30, 31, 32, 33, 34, 35, 36, 37, 38, 39] as Numbers;
    const result = analyzeTransitions(
      numbers,
      [
        draw("third", 3, "2024-01-03", finalNumbers),
        draw("first", 1, "2024-01-01", numbers),
        draw("second", 2, "2024-01-02", nextNumbers),
      ],
      1,
    );

    expect(result.orderedDraws.map((item) => item.drawNumber)).toEqual([1, 2, 3]);
    expect(result.allTransitions.some((transition) => transition.evidence.some(({ historicalDraw, nextDraw }) => historicalDraw.id === "first" && nextDraw.id === "second"))).toBe(true);
    expect(result.allTransitions.some((transition) => transition.evidence.some(({ historicalDraw, nextDraw }) => historicalDraw.id === "second" && nextDraw.id === "third"))).toBe(true);
  });
});