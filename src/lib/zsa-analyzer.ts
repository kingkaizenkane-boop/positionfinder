export type ZsaNumbers = [number, number, number, number, number, number, number, number, number, number];

export type ZsaSourceRecord = {
  id: string;
  sourceLine: number;
  sourceOrder: number;
  rawText: string;
  gameName: string;
  drawNumber: number | null;
  drawDate: string | null;
  declaredRole: 1 | 2 | 3 | null;
  numbers: ZsaNumbers | null;
  issues: string[];
};

export type ZsaGroup = {
  id: string;
  sequence: number;
  gameName: string;
  line1: ZsaSourceRecord | null;
  line2: ZsaSourceRecord | null;
  line3: ZsaSourceRecord | null;
  completeness: "complete" | "incomplete" | "invalid";
  groupingConfirmed: boolean;
  issues: string[];
};

export type ZsaParseResult = {
  provider: string;
  rawText: string;
  records: ZsaSourceRecord[];
  groups: ZsaGroup[];
  warnings: string[];
};

export type ZsaConfirmedGroup = {
  id: string;
  gameId: string;
  gameName: string;
  provider: string;
  groupSequence: number;
  drawDate: string | null;
  groupingConfirmed: boolean;
  completeness: ZsaGroup["completeness"];
  line1: ZsaNumbers | null;
  line2: ZsaNumbers | null;
  line3: ZsaNumbers | null;
  line2DrawNumber?: number | null;
  line3DrawNumber?: number | null;
  winningNumbers: number[] | null;
  winningPositions: number[] | null;
  winnerConfirmed: boolean;
};

export type ZsaFilters = {
  minimumOccurrences: number;
  minimumDistinctGames: number;
  gameIds?: string[];
  provider?: string;
  fromDate?: string;
  throughDate?: string;
};

export type WinningPairEvidence = {
  groupId: string;
  gameId: string;
  gameName: string;
  provider: string;
  groupSequence: number;
  date: string | null;
  drawNumber: number | null;
  winningNumbers: [number, number];
  line2: ZsaNumbers;
  line3: ZsaNumbers;
  winningPositions: number[] | null;
};

export type ZsaWinningPair = {
  key: string;
  pair: [number, number];
  occurrenceCount: number;
  distinctGroups: number;
  distinctGames: number;
  games: string[];
  crossGame: boolean;
  sameGameRecurrence: boolean;
  earliestDate: string | null;
  latestDate: string | null;
  evidence: WinningPairEvidence[];
};

export type ZsaPositionFrequency = {
  position: number;
  occurrences: number;
  percentage: number;
  byGame: Record<string, number>;
};

export type ZsaSourceNumberFrequency = {
  number: number;
  occurrences: number;
  byPosition: Record<number, number>;
  byGame: Record<string, number>;
};

export type ZsaExactMapping = {
  key: string;
  sourcePosition: number;
  sourceNumber: number;
  targetPosition: number;
  targetNumber: number;
  occurrenceCount: number;
  distinctGroups: number;
  distinctGames: number;
  evidence: WinningPairEvidence[];
};

export type ZsaPositionCombination = {
  key: string;
  sourcePositions: [number, number];
  sourceNumbers: [number, number];
  targetPositions: [number, number];
  targetNumbers: [number, number];
  occurrenceCount: number;
  distinctGroups: number;
  distinctGames: number;
  evidence: WinningPairEvidence[];
};

export type ZsaAnalysisResult = {
  eligibleGroupCount: number;
  excludedGroupCount: number;
  confirmedResultCount: number;
  totalPairObservations: number;
  pairs: ZsaWinningPair[];
  positionFrequency: ZsaPositionFrequency[];
  sourceNumberFrequency: ZsaSourceNumberFrequency[];
  exactMappings: ZsaExactMapping[];
  positionCombinations: ZsaPositionCombination[];
  filters: ZsaFilters;
};

const positions = Array.from({ length: 10 }, (_, index) => index + 1);
const normalizeGame = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
const isEndMarker = (line: string) => /^\s*(?:\[?\s*)?end(?:\s+of\s+.+)?\s*\]?\s*$/i.test(line);
const isMetadataLine = (line: string) => /^(began|last updated|updated|source|database|draws?|date|provider|file)\b/i.test(line.trim());
const isGameHeader = (line: string) => {
  const trimmed = line.trim();
  return Boolean(trimmed && /[a-z]/i.test(trimmed) && !isMetadataLine(trimmed) && !/^\s*(?:line\s*[123]|l[123])\b/i.test(trimmed) && !/^\d/.test(trimmed) && !/[/:]\s*\d/.test(trimmed));
};

const dateKey = (value: string): string | null => {
  const parts = value.split(/[/-]/).map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
  const first = parts[0];
  const second = parts[1];
  const third = parts[2];
  if (first === undefined || second === undefined || third === undefined) return null;
  const yearFirst = first > 31;
  const year = yearFirst ? first : third;
  const month = second;
  const day = yearFirst ? third : first;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
};

const parseCandidateValues = (value: string): { values: number[] | null; issue?: string } => {
  const trimmed = value.trim();
  if (!trimmed) return { values: null, issue: "No candidate values were found." };
  const blocks = trimmed.split("|");
  let tokens: string[];
  if (blocks.length === 2) {
    const left = blocks[0]?.trim() ?? "";
    const right = blocks[1]?.trim() ?? "";
    const leftTokens = left.split(/[\s,;]+/).filter(Boolean);
    const rightTokens = right.split(/[\s,;]+/).filter(Boolean);
    if (leftTokens.length === 5 && rightTokens.length === 5 && [...leftTokens, ...rightTokens].every((token) => /^\d{1,2}$/.test(token))) {
      tokens = [...leftTokens, ...rightTokens];
    } else if (!/\D/.test(left + right) && (left + right).length === 20) {
      tokens = (left + right).match(/\d{2}/g) ?? [];
    } else {
      return { values: null, issue: "Expected five values on each side of the separator, or ten values total." };
    }
  } else {
    const spaced = trimmed.split(/[\s,;]+/).filter(Boolean);
    if (spaced.length === 10 && spaced.every((token) => /^\d{1,2}$/.test(token))) tokens = spaced;
    else if (!/\D/.test(trimmed) && trimmed.length === 20) tokens = trimmed.match(/\d{2}/g) ?? [];
    else return { values: null, issue: `Expected 10 candidate values; found ${spaced.length}.` };
  }
  const values = tokens.map(Number);
  const outOfRange = values.find((number) => number < 1 || number > 90);
  if (outOfRange !== undefined) return { values, issue: `Value ${outOfRange.toString().padStart(2, "0")} is outside the permitted range 01–90.` };
  return { values };
};

function makeRecord(line: string, sourceLine: number, sourceOrder: number, gameName: string): ZsaSourceRecord {
  let body = line.trim();
  let declaredRole: 1 | 2 | 3 | null = null;
  let drawNumber: number | null = null;
  let drawDate: string | null = null;
  const labeled = body.match(/^\s*(?:line\s*([123])|l([123]))\s*[:=-]\s*(.*)$/i);
  if (labeled?.[1] || labeled?.[2]) {
    const roleValue = Number(labeled[1] ?? labeled[2]);
    declaredRole = roleValue === 1 || roleValue === 2 || roleValue === 3 ? roleValue : null;
    body = labeled[3] ?? "";
  }
  const dated = body.match(/^\s*(\d+)\s*[:\-]\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\s*[:\-]?\s*(.*)$/);
  if (dated) {
    drawNumber = Number(dated[1]);
    drawDate = dateKey(dated[2] ?? "");
    body = dated[3] ?? "";
  }
  const parsed = parseCandidateValues(body);
  const issues: string[] = [];
  if (dated && !drawDate) issues.push("Invalid or missing draw date.");
  if (parsed.issue) issues.push(parsed.issue);
  const values = parsed.values;
  return {
    id: `zsa-line-${sourceLine}`,
    sourceLine,
    sourceOrder,
    rawText: line,
    gameName,
    drawNumber,
    drawDate,
    declaredRole,
    numbers: values?.length === 10 ? values as ZsaNumbers : null,
    issues,
  };
}

/**
 * Lossless with respect to all non-empty source lines: original text remains attached to
 * each detected record and the complete source is retained. Blank lines/end markers close
 * a group segment, so missing rows never shift later groups across a boundary.
 */
export function parseZsaSource(rawText: string, provider: string): ZsaParseResult {
  const records: ZsaSourceRecord[] = [];
  const groups: ZsaGroup[] = [];
  const warnings: string[] = [];
  let gameName = "Unspecified game";
  let currentSegment: ZsaSourceRecord[] = [];
  let sequenceByGame = new Map<string, number>();
  let order = 0;

  const closeSegment = () => {
    if (!currentSegment.length) return;
    const gameKey = normalizeGame(gameName);
    let sequence = sequenceByGame.get(gameKey) ?? 0;
    for (let offset = 0; offset < currentSegment.length; offset += 3) {
      const chunk = currentSegment.slice(offset, offset + 3);
      sequence += 1;
      const line1 = chunk[0] ?? null;
      const line2 = chunk[1] ?? null;
      const line3 = chunk[2] ?? null;
      const issues = chunk.flatMap((record, index) => {
        const expectedRole = (index + 1) as 1 | 2 | 3;
        const roleIssue = record.declaredRole !== null && record.declaredRole !== expectedRole ? [`Line ${record.sourceLine}: Declared Line ${record.declaredRole} conflicts with its position in this group.`] : [];
        return [...record.issues.map((issue) => `Line ${record.sourceLine}: ${issue}`), ...roleIssue];
      });
      const complete = chunk.length === 3;
      if (!complete) issues.push(`Incomplete three-line group: found ${chunk.length} of 3 records before a source boundary.`);
      const invalid = chunk.some((record) => record.numbers === null || record.issues.length > 0) || issues.some((issue) => issue.includes("Declared Line"));
      groups.push({
        id: `zsa-group-${gameKey.replace(/[^a-z0-9]+/g, "-")}-${sequence}`,
        sequence,
        gameName,
        line1,
        line2,
        line3,
        completeness: !complete ? "incomplete" : invalid ? "invalid" : "complete",
        groupingConfirmed: false,
        issues,
      });
    }
    sequenceByGame.set(gameKey, sequence);
    if (currentSegment.length > 3) warnings.push(`A source section for ${gameName} contains ${currentSegment.length} records; records were partitioned in source order and require grouping confirmation.`);
    currentSegment = [];
  };

  rawText.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      closeSegment();
      return;
    }
    if (isEndMarker(trimmed)) {
      closeSegment();
      return;
    }
    if (isGameHeader(trimmed)) {
      closeSegment();
      gameName = trimmed.replace(/\s+/g, " ");
      return;
    }
    if (isMetadataLine(trimmed)) return;
    if (/^\s*(?:line\s*[123]|l[123])\s*$/i.test(trimmed)) return;
    const looksLikeDraw = /^\s*\d/.test(trimmed) || /^\s*(?:line\s*[123]|l[123])\s*[:=-]/i.test(trimmed) || /\d/.test(trimmed);
    if (!looksLikeDraw) return;
    const record = makeRecord(line, index + 1, order, gameName);
    order += 1;
    records.push(record);
    currentSegment.push(record);
  });
  closeSegment();

  if (groups.some((group) => group.completeness === "incomplete")) warnings.push("One or more groups ended before all three records were present; later groups were not shifted across blank lines or end markers.");
  if (groups.some((group) => group.completeness === "complete")) warnings.push("Detected three-record groupings are provisional. Review and confirm the grouping boundaries before analysis.");
  return { provider: provider.trim(), rawText, records, groups, warnings };
}

function isConfirmedComplete(group: ZsaConfirmedGroup): group is ZsaConfirmedGroup & { line1: ZsaNumbers; line2: ZsaNumbers; line3: ZsaNumbers; winningNumbers: number[] } {
  if (!group.groupingConfirmed || group.completeness !== "complete" || !group.winnerConfirmed) return false;
  if (!group.line1 || !group.line2 || !group.line3 || !group.winningNumbers || group.winningNumbers.length !== 5) return false;
  const line3 = group.line3;
  const candidateLines = [group.line1, group.line2, group.line3];
  if (candidateLines.some((line) => line.length !== 10 || line.some((value) => !Number.isInteger(value) || value < 1 || value > 90))) return false;
  if (group.winningNumbers.some((value) => !Number.isInteger(value) || value < 1 || value > 90) || new Set(group.winningNumbers).size !== 5) return false;
  if (!group.winningNumbers.every((value) => line3.includes(value))) return false;
  if (group.winningPositions) {
    if (group.winningPositions.length !== 5 || group.winningPositions.some((position) => !Number.isInteger(position) || position < 1 || position > 10) || new Set(group.winningPositions).size !== 5) return false;
    if (!group.winningPositions.every((position, index) => line3[position - 1] === group.winningNumbers?.[index])) return false;
  }
  return true;
}

function filterGroup(group: ZsaConfirmedGroup, filters: ZsaFilters) {
  if (filters.gameIds?.length && !filters.gameIds.includes(group.gameId)) return false;
  if (filters.provider && normalizeGame(group.provider) !== normalizeGame(filters.provider)) return false;
  if (filters.fromDate && (!group.drawDate || group.drawDate < filters.fromDate)) return false;
  if (filters.throughDate && (!group.drawDate || group.drawDate > filters.throughDate)) return false;
  return true;
}

const pairKey = (a: number, b: number) => [a, b].sort((left, right) => left - right).join("-");
const increment = (record: Record<string, number>, key: string) => { record[key] = (record[key] ?? 0) + 1; };

export function analyzeZsa(groups: ZsaConfirmedGroup[], filters: ZsaFilters = { minimumOccurrences: 2, minimumDistinctGames: 1 }): ZsaAnalysisResult {
  const eligible = [...new Map(groups.filter((group) => isConfirmedComplete(group) && filterGroup(group, filters)).map((group) => [group.id, group])).values()];
  const pairEvidence = new Map<string, WinningPairEvidence[]>();
  const pairNumbers = new Map<string, [number, number]>();

  for (const group of eligible) {
    if (!isConfirmedComplete(group)) continue;
    const winners = group.winningNumbers;
    if (!winners) continue;
    for (let first = 0; first < winners.length; first += 1) {
      for (let second = first + 1; second < winners.length; second += 1) {
        const a = winners[first];
        const b = winners[second];
        if (a === undefined || b === undefined) continue;
        const key = pairKey(a, b);
        const pair = [Math.min(a, b), Math.max(a, b)] as [number, number];
        pairNumbers.set(key, pair);
        const list = pairEvidence.get(key) ?? [];
        list.push({
          groupId: group.id,
          gameId: group.gameId,
          gameName: group.gameName,
          provider: group.provider,
          groupSequence: group.groupSequence,
          date: group.drawDate,
          drawNumber: group.line3DrawNumber ?? null,
          winningNumbers: pair,
          line2: group.line2,
          line3: group.line3,
          winningPositions: group.winningPositions ? [
            group.winningPositions[winners.indexOf(pair[0])] ?? 0,
            group.winningPositions[winners.indexOf(pair[1])] ?? 0,
          ] : null,
        });
        pairEvidence.set(key, list);
      }
    }
  }

  const pairs: ZsaWinningPair[] = [...pairEvidence.entries()].map(([key, evidence]) => {
    const games = [...new Set(evidence.map((item) => item.gameId))];
    const dates = evidence.map((item) => item.date).filter((value): value is string => Boolean(value)).sort();
    const gameOccurrences = evidence.reduce<Record<string, number>>((record, item) => { increment(record, item.gameId); return record; }, {});
    return {
      key,
      pair: pairNumbers.get(key) ?? [0, 0],
      occurrenceCount: evidence.length,
      distinctGroups: new Set(evidence.map((item) => item.groupId)).size,
      distinctGames: games.length,
      games: [...new Set(evidence.map((item) => item.gameName))].sort(),
      crossGame: games.length >= 2,
      sameGameRecurrence: Object.values(gameOccurrences).some((count) => count >= 2),
      earliestDate: dates[0] ?? null,
      latestDate: dates.at(-1) ?? null,
      evidence,
    };
  }).filter((pair) => pair.occurrenceCount >= Math.max(1, filters.minimumOccurrences) && pair.distinctGames >= Math.max(1, filters.minimumDistinctGames))
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.pair[0] - b.pair[0] || a.pair[1] - b.pair[1]);

  const qualifyingIds = new Set(pairs.flatMap((pair) => pair.evidence.map((evidence) => `${pair.key}|${evidence.groupId}`)));
  const positionCounts = new Map<number, { count: number; byGame: Record<string, number> }>();
  const numberCounts = new Map<number, { count: number; byPosition: Record<number, number>; byGame: Record<string, number> }>();
  const mappingEvidence = new Map<string, { sourcePosition: number; sourceNumber: number; targetPosition: number; targetNumber: number; evidence: WinningPairEvidence[]; groupIds: Set<string>; gameIds: Set<string> }>();
  const combinationEvidence = new Map<string, { sourcePositions: [number, number]; sourceNumbers: [number, number]; targetPositions: [number, number]; targetNumbers: [number, number]; evidence: WinningPairEvidence[]; groupIds: Set<string>; gameIds: Set<string> }>();

  for (const pair of pairs) {
    for (const evidence of pair.evidence) {
      if (!qualifyingIds.has(`${pair.key}|${evidence.groupId}`)) continue;
      for (const position of positions) {
        const sourceNumber = evidence.line2[position - 1];
        if (sourceNumber === undefined) continue;
        const positionEntry = positionCounts.get(position) ?? { count: 0, byGame: {} };
        positionEntry.count += 1;
        increment(positionEntry.byGame, evidence.gameId);
        positionCounts.set(position, positionEntry);
        const numberEntry = numberCounts.get(sourceNumber) ?? { count: 0, byPosition: {}, byGame: {} };
        numberEntry.count += 1;
        increment(numberEntry.byPosition, String(position));
        increment(numberEntry.byGame, evidence.gameId);
        numberCounts.set(sourceNumber, numberEntry);
      }

      const targetPositions = evidence.winningPositions;
      if (!targetPositions || targetPositions.length !== 2 || !evidence.winningNumbers.every((number, index) => evidence.line3[targetPositions[index] === undefined ? -1 : (targetPositions[index] as number) - 1] === number)) continue;
      for (const winnerIndex of [0, 1]) {
        const winner = evidence.winningNumbers[winnerIndex];
        const targetPosition = targetPositions[winnerIndex];
        if (winner === undefined) continue;
        if (targetPosition === undefined) continue;
        for (const sourcePosition of positions) {
          const sourceNumber = evidence.line2[sourcePosition - 1];
          if (sourceNumber === undefined) continue;
          const key = `${sourcePosition}|${sourceNumber}|${targetPosition}|${winner}`;
          const entry = mappingEvidence.get(key) ?? { sourcePosition, sourceNumber, targetPosition, targetNumber: winner, evidence: [], groupIds: new Set<string>(), gameIds: new Set<string>() };
          if (!entry.groupIds.has(evidence.groupId)) entry.evidence.push(evidence);
          entry.groupIds.add(evidence.groupId);
          entry.gameIds.add(evidence.gameId);
          mappingEvidence.set(key, entry);
        }
      }

      for (const firstPosition of positions) {
        for (const secondPosition of positions) {
          if (secondPosition <= firstPosition) continue;
          const firstValue = evidence.line2[firstPosition - 1];
          const secondValue = evidence.line2[secondPosition - 1];
          if (firstValue === undefined || secondValue === undefined) continue;
          for (let firstWinnerIndex = 0; firstWinnerIndex < evidence.winningNumbers.length; firstWinnerIndex += 1) {
            for (let secondWinnerIndex = firstWinnerIndex + 1; secondWinnerIndex < evidence.winningNumbers.length; secondWinnerIndex += 1) {
              const firstTarget = targetPositions[firstWinnerIndex];
              const secondTarget = targetPositions[secondWinnerIndex];
              const firstTargetNumber = evidence.winningNumbers[firstWinnerIndex];
              const secondTargetNumber = evidence.winningNumbers[secondWinnerIndex];
              if (firstTarget === undefined || secondTarget === undefined || firstTargetNumber === undefined || secondTargetNumber === undefined) continue;
              for (const assignment of [
                { positions: [firstTarget, secondTarget] as [number, number], numbers: [firstTargetNumber, secondTargetNumber] as [number, number] },
                { positions: [secondTarget, firstTarget] as [number, number], numbers: [secondTargetNumber, firstTargetNumber] as [number, number] },
              ]) {
                const key = `${pair.pair.join("-")}|${firstPosition}|${secondPosition}|${firstValue}|${secondValue}|${assignment.positions[0]}|${assignment.positions[1]}|${assignment.numbers[0]}|${assignment.numbers[1]}`;
                const entry = combinationEvidence.get(key) ?? {
                  sourcePositions: [firstPosition, secondPosition],
                  sourceNumbers: [firstValue, secondValue],
                  targetPositions: assignment.positions,
                  targetNumbers: assignment.numbers,
                  evidence: [],
                  groupIds: new Set<string>(),
                  gameIds: new Set<string>(),
                };
                if (!entry.groupIds.has(evidence.groupId)) entry.evidence.push(evidence);
                entry.groupIds.add(evidence.groupId);
                entry.gameIds.add(evidence.gameId);
                combinationEvidence.set(key, entry);
              }
            }
          }
        }
      }
    }
  }

  const positionFrequency = positions.map((position) => {
    const item = positionCounts.get(position) ?? { count: 0, byGame: {} };
    const total = [...positionCounts.values()].reduce((sum, entry) => sum + entry.count, 0);
    return { position, occurrences: item.count, percentage: total ? (item.count / total) * 100 : 0, byGame: item.byGame };
  });
  const sourceNumberFrequency = [...numberCounts.entries()].map(([number, item]) => ({ number, occurrences: item.count, byPosition: item.byPosition, byGame: item.byGame })).sort((a, b) => b.occurrences - a.occurrences || a.number - b.number);
  const exactMappings = [...mappingEvidence.entries()].map(([key, item]) => ({ key, sourcePosition: item.sourcePosition, sourceNumber: item.sourceNumber, targetPosition: item.targetPosition, targetNumber: item.targetNumber, occurrenceCount: item.groupIds.size, distinctGroups: item.groupIds.size, distinctGames: item.gameIds.size, evidence: item.evidence })).sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.sourcePosition - b.sourcePosition || a.targetPosition - b.targetPosition || a.targetNumber - b.targetNumber);
  const positionCombinations = [...combinationEvidence.entries()].map(([key, item]) => ({ key, ...item, occurrenceCount: item.groupIds.size, distinctGroups: item.groupIds.size, distinctGames: item.gameIds.size })).sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.key.localeCompare(b.key));

  return {
    eligibleGroupCount: eligible.length,
    excludedGroupCount: groups.length - eligible.length,
    confirmedResultCount: eligible.length,
    totalPairObservations: eligible.length * 10,
    pairs,
    positionFrequency,
    sourceNumberFrequency,
    exactMappings,
    positionCombinations,
    filters,
  };
}

export function formatZsaNumber(value: number) {
  return value.toString().padStart(2, "0");
}