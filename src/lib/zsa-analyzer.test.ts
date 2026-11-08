import { describe, expect, it } from "vitest";
import {
  analyzeZsa,
  compareZsaValidation,
  createZsaValidationBaseline,
  parseZsaSource,
  type ZsaConfirmedGroup,
  type ZsaNumbers,
} from "./zsa-analyzer";

const line1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as ZsaNumbers;
const line2 = [65, 45, 63, 77, 12, 68, 21, 83, 16, 4] as ZsaNumbers;
const line3 = [47, 57, 70, 27, 64, 11, 22, 33, 44, 55] as ZsaNumbers;
const winners = [47, 57, 70, 27, 64];
const positions = [1, 2, 3, 4, 5];

function group(overrides: Partial<ZsaConfirmedGroup> = {}): ZsaConfirmedGroup {
  return {
    id: "group-1",
    gameId: "game-a",
    gameName: "Golden Chance Bazooka",
    provider: "Golden Chance",
    groupSequence: 1,
    drawDate: "2024-01-01",
    groupingConfirmed: true,
    completeness: "complete",
    line1,
    line2,
    line3,
    winningNumbers: winners,
    winningPositions: positions,
    winnerConfirmed: true,
    ...overrides,
  };
}

describe("ZSA source grouping parser", () => {
  it("keeps source order, game sections, and explicit group boundaries", () => {
    const parsed = parseZsaSource(
      `Golden Chance Albarka\n0943: 05/01/2024: 0102030405 | 0607080910\n0944: 12/01/2024: 1112131415 | 1617181920\n0945: 19/01/2024: 2122232425 | 2627282930\n\nGolden Chance Bazooka\n0567: 05/01/2024: 3132333435 | 3637383940\n0568: 12/01/2024: 4142434445 | 4647484950`,
      "Official source",
    );

    expect(parsed.records.map((record) => record.sourceOrder)).toEqual([0, 1, 2, 3, 4]);
    expect(parsed.records[0]?.numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(parsed.groups.map((item) => [item.gameName, item.completeness])).toEqual([
      ["Golden Chance Albarka", "complete"],
      ["Golden Chance Bazooka", "incomplete"],
    ]);
    expect(parsed.groups[0]?.line1?.drawNumber).toBe(943);
    expect(parsed.groups[0]?.line3?.drawNumber).toBe(945);
    expect(parsed.groups[0]?.groupingConfirmed).toBe(false);
    expect(parsed.rawText).toContain("Golden Chance Bazooka");
    expect(parsed.groups[1]?.issues.join(" ")).toContain("found 2 of 3");
  });

  it("retains duplicate source evidence and reports invalid values without correcting them", () => {
    const source =
      "Test Game\n001: 01/01/2024: 0102030405 | 0607080910\n002: 08/01/2024: 0102030405 | 0607080910\n003: 15/01/2024: 0002030405 | 0607080997";
    const parsed = parseZsaSource(source, "Provider");

    expect(parsed.records).toHaveLength(3);
    expect(parsed.records[0]?.numbers).toEqual(parsed.records[1]?.numbers);
    expect(parsed.records[2]?.numbers).toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9, 97]);
    expect(parsed.records[2]?.issues.join(" ")).toContain("outside the permitted range");
    expect(parsed.groups[0]?.completeness).toBe("invalid");
    expect(parsed.records[0]?.rawText).toContain("0102030405");
  });

  it("does not shift records across an explicit end marker", () => {
    const parsed = parseZsaSource(
      "Game A\n01 02 03 04 05 | 06 07 08 09 10\n11 12 13 14 15 | 16 17 18 19 20\nEND\n21 22 23 24 25 | 26 27 28 29 30",
      "Provider",
    );

    expect(parsed.groups.map((item) => item.completeness)).toEqual(["incomplete", "incomplete"]);
    expect(parsed.groups.every((item) => item.line3 === null)).toBe(true);
  });

  it("flags explicitly mislabeled rows and repeated draw identities", () => {
    const parsed = parseZsaSource(
      `Game A\nLine 1: 01 02 03 04 05 | 06 07 08 09 10\nLine 3: 11 12 13 14 15 | 16 17 18 19 20\nLine 3: 21 22 23 24 25 | 26 27 28 29 30\n\nGame A\n101: 01/01/2024: 01 02 03 04 05 | 06 07 08 09 10\n101: 01/01/2024: 01 02 03 04 05 | 06 07 08 09 10`,
      "Provider",
    );

    expect(parsed.groups[0]?.completeness).toBe("invalid");
    expect(parsed.groups[0]?.issues.join(" ")).toContain("Declared Line 3 conflicts");
    expect(parsed.records[4]?.issues.join(" ")).toContain("Duplicate source record or draw ID");
    expect(parsed.warnings.some((warning) => warning.includes("Duplicate source records"))).toBe(
      true,
    );
  });
});

describe("confirmed ZSA analysis", () => {
  it("generates ten unique unordered pairs from five confirmed winners", () => {
    const result = analyzeZsa([group()], { minimumOccurrences: 1, minimumDistinctGames: 1 });
    expect(result.totalPairObservations).toBe(10);
    expect(result.pairs).toHaveLength(10);
    expect(result.pairs.map((item) => item.key)).toContain("47-57");
    expect(result.pairs.map((item) => item.key)).not.toContain("57-47");
  });

  it("distinguishes recurrence within a game from corroboration across games", () => {
    const result = analyzeZsa([
      group({ id: "a-1", groupSequence: 1 }),
      group({ id: "a-2", groupSequence: 2, drawDate: "2024-02-01" }),
      group({ id: "b-1", gameId: "game-b", gameName: "Other Game", groupSequence: 1 }),
    ]);
    const pair = result.pairs.find((item) => item.key === "47-57");

    expect(pair?.occurrenceCount).toBe(3);
    expect(pair?.distinctGroups).toBe(3);
    expect(pair?.distinctGames).toBe(2);
    expect(pair?.sameGameRecurrence).toBe(true);
    expect(pair?.crossGame).toBe(true);
    expect(pair?.evidence).toHaveLength(3);
  });

  it("requires grouping, complete candidate records, explicit winners, and confirmed candidate positions", () => {
    const notGrouped = group({ groupingConfirmed: false });
    const incomplete = group({ id: "incomplete", completeness: "incomplete" });
    const unconfirmed = group({ id: "unconfirmed", winnerConfirmed: false });
    const invalidWinners = group({ id: "not-in-candidate-pool", winningNumbers: [1, 2, 3, 4, 5] });

    expect(
      analyzeZsa([notGrouped, incomplete, unconfirmed, invalidWinners]).eligibleGroupCount,
    ).toBe(0);
    expect(
      analyzeZsa([notGrouped, incomplete, unconfirmed, invalidWinners]).excludedGroupCount,
    ).toBe(4);
  });

  it("preserves source position identity, numbers, exact target mapping, and pair direction", () => {
    const result = analyzeZsa([group(), group({ id: "group-2", groupSequence: 2 })]);

    expect(result.positionFrequency).toHaveLength(10);
    expect(result.positionFrequency[0]?.occurrences).toBe(20);
    const source65 = result.sourceNumberFrequency.find((item) => item.number === 65);
    expect(source65?.byPosition[1]).toBe(20);
    expect(source65?.byPosition[8]).toBeUndefined();
    expect(
      result.exactMappings.some(
        (item) =>
          item.sourcePosition === 1 &&
          item.sourceNumber === 65 &&
          item.targetPosition === 1 &&
          item.targetNumber === 47,
      ),
    ).toBe(true);
    expect(
      result.exactMappings.some(
        (item) =>
          item.sourcePosition === 1 && item.targetPosition === 2 && item.targetNumber === 57,
      ),
    ).toBe(true);
    expect(
      result.positionCombinations.some(
        (item) =>
          item.sourcePositions[0] === 1 &&
          item.sourcePositions[1] === 2 &&
          item.targetPositions[0] === 1 &&
          item.targetPositions[1] === 2,
      ),
    ).toBe(true);
  });

  it("does not merge the same position mapping when source values differ", () => {
    const differentSource = [66, 46, 64, 78, 13, 69, 22, 84, 17, 5] as ZsaNumbers;
    const result = analyzeZsa([
      group({ id: "first", groupSequence: 1 }),
      group({ id: "second", groupSequence: 2, line2: differentSource }),
    ]);
    const combined = result.positionCombinations.filter(
      (item) =>
        item.sourcePositions[0] === 1 &&
        item.sourcePositions[1] === 2 &&
        item.targetNumbers[0] === 47 &&
        item.targetNumbers[1] === 57,
    );

    expect(combined).toHaveLength(2);
    expect(combined.map((item) => item.sourceNumbers)).toEqual([
      [65, 45],
      [66, 46],
    ]);
  });

  it("keeps pair recurrence available without positions but excludes invalid positions from exact mapping", () => {
    const result = analyzeZsa([
      group({ id: "no-positions", winningPositions: null }),
      group({ id: "wrong-positions", groupSequence: 2, winningPositions: [5, 4, 3, 2, 1] }),
    ]);

    expect(result.eligibleGroupCount).toBe(2);
    expect(result.pairs).toHaveLength(10);
    expect(result.exactMappings).toHaveLength(0);
  });

  it("applies game, provider, date, occurrence, and distinct-game filters", () => {
    const groups = [
      group({ id: "a-1", groupSequence: 1 }),
      group({ id: "a-2", groupSequence: 2, drawDate: "2024-02-01" }),
      group({
        id: "b-1",
        gameId: "game-b",
        gameName: "Other Game",
        provider: "Other Provider",
        groupSequence: 1,
      }),
    ];
    const result = analyzeZsa(groups, {
      minimumOccurrences: 2,
      minimumDistinctGames: 2,
      gameIds: ["game-a", "game-b"],
      provider: "Golden Chance",
      fromDate: "2024-01-01",
      throughDate: "2024-03-01",
    });

    expect(result.eligibleGroupCount).toBe(2);
    expect(result.pairs).toHaveLength(0);
    expect(
      analyzeZsa(groups, { minimumOccurrences: 1, minimumDistinctGames: 1, gameIds: ["game-b"] })
        .eligibleGroupCount,
    ).toBe(1);
  });

  it("stores Validation Case 001 source numbers and winners without fabricating a Line 3 record", () => {
    const validationCase = {
      gameName: "Golden Chance Bazooka",
      provider: "Golden Chance",
      line2: [65, 45, 63, 77, 12, 68, 21, 83, 16, 4] as ZsaNumbers,
      winningNumbers: [47, 57, 70, 27, 64],
      line3: null,
    };

    expect(validationCase.line2).toEqual(line2);
    expect(validationCase.winningNumbers).toEqual(winners);
    expect(validationCase.line3).toBeNull();
    expect(analyzeZsa([]).eligibleGroupCount).toBe(0);
  });

  it("freezes validation baselines and compares actual winning pairs without admitting the case", () => {
    const historicalGroups = [group({ id: "historical-1" }), group({ id: "historical-2" })];
    const baselineResults = analyzeZsa(historicalGroups, {
      minimumOccurrences: 2,
      minimumDistinctGames: 1,
    });
    const baseline = createZsaValidationBaseline(
      historicalGroups,
      baselineResults,
      "2026-11-07T00:00:00.000Z",
    );
    const comparison = compareZsaValidation(baseline, [47, 57, 70, 27, 64]);

    expect(baseline.baselineGroupIds).toEqual(["historical-1", "historical-2"]);
    expect(baseline.baselineResults.eligibleGroupCount).toBe(2);
    expect(comparison.actualWinningPairs).toHaveLength(10);
    expect(comparison.historicallyObservedWinningPairs).toHaveLength(10);
  });


  it("retains source file, batch, line, and draw provenance on each occurrence", () => {
    const result = analyzeZsa(
      [
        group({
          sourceBatchId: "batch-2024-01",
          sourceReference: "official-draws-2024.txt",
          sourceOrder: 12,
          sourceLines: [31, 32, 33],
          sourceDrawNumbers: [263, 264, 265],
          sourceTexts: ["line one", "line two", "line three"],
          sourceOccurrenceIds: ["occ-1", "occ-2", "occ-3"],
        }),
      ],
      { minimumOccurrences: 1, minimumDistinctGames: 1 },
    );
    const evidence = result.pairs[0]?.evidence[0];

    expect(evidence?.sourceBatchId).toBe("batch-2024-01");
    expect(evidence?.sourceReference).toBe("official-draws-2024.txt");
    expect(evidence?.sourceLines).toEqual([31, 32, 33]);
    expect(evidence?.sourceDrawNumbers).toEqual([263, 264, 265]);
    expect(evidence?.sourceTexts).toEqual(["line one", "line two", "line three"]);
    expect(evidence?.sourceOccurrenceIds).toEqual(["occ-1", "occ-2", "occ-3"]);
  });
  it("retains source file, batch, line, and draw provenance on each occurrence", () => {
    const result = analyzeZsa(
      [
        group({
          sourceBatchId: "batch-2024-01",
          sourceReference: "official-draws-2024.txt",
          sourceOrder: 12,
          sourceLines: [31, 32, 33],
          sourceDrawNumbers: [263, 264, 265],
          sourceTexts: ["line one", "line two", "line three"],
          sourceOccurrenceIds: ["occ-1", "occ-2", "occ-3"],
        }),
      ],
      { minimumOccurrences: 1, minimumDistinctGames: 1 },
    );
    const evidence = result.pairs[0]?.evidence[0];

    expect(evidence?.sourceBatchId).toBe("batch-2024-01");
    expect(evidence?.sourceReference).toBe("official-draws-2024.txt");
    expect(evidence?.sourceLines).toEqual([31, 32, 33]);
    expect(evidence?.sourceDrawNumbers).toEqual([263, 264, 265]);
    expect(evidence?.sourceTexts).toEqual(["line one", "line two", "line three"]);
    expect(evidence?.sourceOccurrenceIds).toEqual(["occ-1", "occ-2", "occ-3"]);
  });
});
