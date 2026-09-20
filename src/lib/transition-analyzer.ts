export type Position = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Numbers = [number, number, number, number, number, number, number, number, number, number];

export type HistoricalDraw = {
  id: string;
  drawNumber: number;
  drawDate: string;
  numbers: Numbers;
  followingDraw?: HistoricalDraw;
};

export type ParsedRecord = HistoricalDraw & { sourceLine: number };
export type InvalidRecord = { sourceLine: number; text: string; reason: string };

export type TransitionEvidence = {
  historicalDraw: HistoricalDraw;
  nextDraw: HistoricalDraw;
};

export type TransitionGroup = {
  key: string;
  sourcePosition: Position;
  sourceNumber: number;
  targetPosition: Position;
  targetNumber: number;
  occurrenceCount: number;
  evidence: TransitionEvidence[];
};

export type SourceSummary = {
  position: Position;
  number: number;
  historicalOccurrences: number;
  occurrencesWithNextDraw: number;
  transitions: TransitionGroup[];
};

export type MatrixCell = { sourcePosition: Position; targetPosition: Position; count: number };
export type ConvergenceGroup = {
  targetPosition: Position;
  targetNumber: number;
  sources: TransitionGroup[];
};

export type AnalysisResult = {
  orderedDraws: HistoricalDraw[];
  sources: SourceSummary[];
  transitions: TransitionGroup[];
  convergence: ConvergenceGroup[];
  matrix: MatrixCell[];
  duplicateCount: number;
  analyzedDrawCount: number;
};

export const POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const MINIMUM_OPTIONS = [1, 2, 3, 4, 5, 10] as const;

export const SAMPLE_HISTORY = `Golden Chance Vision
Began 22/01/2020

0081: 04/08/2021: 38 59 13 71 56 | 01 86 30 37 65
0082: 11/08/2021: 65 50 28 87 58 | 30 80 64 22 76
0083: 18/08/2021: 82 37 53 77 08 | 74 02 22 36 19

0086: 08/09/2021: 50 76 40 35 10 | 18 09 27 23 45
0087: 15/09/2021: 34 53 87 73 05 | 25 72 37 30 55
0088: 22/09/2021: 31 84 41 32 88 | 09 06 85 57 70

0234: 10/07/2024: 73 83 25 57 80 | 38 19 23 46 54
0235: 17/07/2024: 25 14 01 86 28 | 20 07 78 54 02
0236: 24/07/2024: 09 42 74 90 88 | 04 23 17 78 11

0262: 22/01/2025: 61 47 64 62 63 | 79 15 87 22 09
0263: 29/01/2025: 22 60 08 41 42 | 30 19 78 38 35
0264: 05/02/2025: 60 28 57 05 49 | 53 75 85 61 70

0283: 18/06/2025: 83 45 49 64 13 | 71 16 84 57 15
0284: 25/06/2025: 86 43 28 01 53 | 82 72 07 51 83
0285: 02/07/2025: 08 35 46 76 86 | 06 75 48 05 45`;

export const SAMPLE_CURRENT: Numbers = [34, 90, 28, 86, 11, 30, 72, 78, 75, 80];

type NumberLine = { text: string; sourceLine: number };

const toDateKey = (value: string) => {
  const parts = value.split(/[/-]/).map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
  const [first, second, third] = parts;
  if (first === undefined || second === undefined || third === undefined) return null;
  const yearFirst = first > 31;
  const year = yearFirst ? first : third;
  const month = second;
  const day = yearFirst ? third : first;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
};

const toNumbers = (value: string): number[] =>
  value
    .replace(/[|,;]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(Number)
    .filter((number) => Number.isInteger(number));

const isDrawLine = (line: string) => /^\s*\d+\s*[:\-]/.test(line);

const isPlainNumberLine = (line: string) => {
  if (!line.trim() || /[a-z]/i.test(line) || /[:/\-]/.test(line)) return false;
  const numbers = toNumbers(line);
  return numbers.length === 10 && numbers.every((number) => number >= 1 && number <= 90);
};

const invalidNumbersReason = (numbers: number[]) => {
  const invalidNumber = numbers.find((number) => number < 1 || number > 90);
  return invalidNumber === undefined ? `Expected 10 numbers but found ${numbers.length}.` : `Number ${invalidNumber} is outside the valid range 01–90.`;
};

export function parseHistoricalGames(text: string): { valid: ParsedRecord[]; invalid: InvalidRecord[]; duplicates: ParsedRecord[]; threeLinePairs: number } {
  const valid: ParsedRecord[] = [];
  const invalid: InvalidRecord[] = [];
  const duplicates: ParsedRecord[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);
  const plainLines: NumberLine[] = lines.flatMap((line, index) => isPlainNumberLine(line) ? [{ text: line, sourceLine: index + 1 }] : []);

  if (plainLines.length >= 3 && plainLines.length % 3 === 0) {
    for (let index = 0; index < plainLines.length; index += 3) {
      const ignoredLine = plainLines[index];
      const sourceLine = plainLines[index + 1];
      const targetLine = plainLines[index + 2];
      if (!ignoredLine || !sourceLine || !targetLine) continue;
      const sourceNumbers = toNumbers(sourceLine.text);
      const targetNumbers = toNumbers(targetLine.text);
      if (sourceNumbers.length !== 10 || sourceNumbers.some((number) => number < 1 || number > 90)) {
        invalid.push({ sourceLine: sourceLine.sourceLine, text: sourceLine.text, reason: `Source line: ${invalidNumbersReason(sourceNumbers)}` });
        continue;
      }
      if (targetNumbers.length !== 10 || targetNumbers.some((number) => number < 1 || number > 90)) {
        invalid.push({ sourceLine: targetLine.sourceLine, text: targetLine.text, reason: `Target line: ${invalidNumbersReason(targetNumbers)}` });
        continue;
      }
      const pairNumber = index / 3;
      const source: ParsedRecord = {
        id: `import-pair-${sourceLine.sourceLine}`,
        drawNumber: pairNumber * 2 + 1,
        drawDate: "2000-01-01",
        numbers: sourceNumbers as Numbers,
        sourceLine: sourceLine.sourceLine,
        followingDraw: {
          id: `import-pair-${targetLine.sourceLine}`,
          drawNumber: pairNumber * 2 + 2,
          drawDate: "2000-01-01",
          numbers: targetNumbers as Numbers,
        },
      };
      const followingDraw = source.followingDraw;
      if (!followingDraw) continue;
      const key = `${source.numbers.join(",")}|${followingDraw.numbers.join(",")}`;
      if (seen.has(key)) {
        duplicates.push(source);
        invalid.push({ sourceLine: sourceLine.sourceLine, text: sourceLine.text, reason: "Duplicate three-line record detected; it will not be counted twice." });
        continue;
      }
      seen.add(key);
      valid.push(source);
    }
    return { valid, invalid, duplicates, threeLinePairs: valid.length };
  }

  const datedRecords: ParsedRecord[] = [];
  lines.forEach((line, index) => {
    const sourceLine = index + 1;
    const trimmed = line.trim();
    if (!trimmed || !isDrawLine(trimmed)) return;

    const match = trimmed.match(/^\s*(\d+)\s*[:\-]\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\s*[:\-]?\s*(.*)$/);
    if (!match) {
      invalid.push({ sourceLine, text: line, reason: "Could not read the draw number and date." });
      return;
    }
    const [, drawNumberText, dateText, numberText] = match;
    const drawNumber = Number(drawNumberText);
    const drawDate = toDateKey(dateText ?? "");
    const numbers = toNumbers(numberText ?? "");
    if (!drawDate) {
      invalid.push({ sourceLine, text: line, reason: "Invalid draw date." });
      return;
    }
    if (numbers.length !== 10) {
      invalid.push({ sourceLine, text: line, reason: `Expected 10 numbers but found ${numbers.length}.` });
      return;
    }
    const invalidNumber = numbers.find((number) => number < 1 || number > 90);
    if (invalidNumber !== undefined) {
      invalid.push({ sourceLine, text: line, reason: `Number ${invalidNumber} is outside the valid range 01–90.` });
      return;
    }
    datedRecords.push({
      id: `import-${sourceLine}-${drawNumber}`,
      drawNumber,
      drawDate,
      numbers: numbers as Numbers,
      sourceLine,
    });
  });

  if (datedRecords.length >= 3 && datedRecords.length % 3 === 0) {
    for (let index = 0; index < datedRecords.length; index += 3) {
      const source = datedRecords[index + 1];
      const target = datedRecords[index + 2];
      if (!source || !target) continue;
      source.followingDraw = target;
      const key = `${source.drawNumber}|${source.drawDate}|${source.numbers.join(",")}|${target.drawNumber}|${target.drawDate}|${target.numbers.join(",")}`;
      if (seen.has(key)) {
        duplicates.push(source);
        invalid.push({ sourceLine: source.sourceLine, text: lines[source.sourceLine - 1] ?? "", reason: "Duplicate three-line record detected; it will not be counted twice." });
        continue;
      }
      seen.add(key);
      valid.push(source);
    }
    return { valid, invalid, duplicates, threeLinePairs: valid.length };
  }

  datedRecords.forEach((record) => {
    const key = `${record.drawNumber}|${record.drawDate}|${record.numbers.join(",")}`;
    if (seen.has(key)) {
      duplicates.push(record);
      invalid.push({ sourceLine: record.sourceLine, text: lines[record.sourceLine - 1] ?? "", reason: "Duplicate draw detected; it will not be counted twice." });
      return;
    }
    seen.add(key);
    valid.push(record);
  });

  return { valid, invalid, duplicates, threeLinePairs: 0 };
}

export function formatNumber(value: number) {
  return value.toString().padStart(2, "0");
}

export function formatDrawNumbers(numbers: Numbers) {
  return `${numbers.slice(0, 5).map(formatNumber).join(" ")}  |  ${numbers.slice(5).map(formatNumber).join(" ")}`;
}

export function positionLabel(position: number, number?: number) {
  return `P${position}${number === undefined ? "" : `:${formatNumber(number)}`}`;
}

export function analyzeTransitions(currentNumbers: Numbers, inputDraws: HistoricalDraw[], minimumOccurrences = 2, duplicateCount = 0): AnalysisResult {
  const orderedDraws = [...inputDraws].sort((a, b) => a.drawDate.localeCompare(b.drawDate) || a.drawNumber - b.drawNumber);
  const transitionMap = new Map<string, TransitionGroup>();
  const drawIndexById = new Map(orderedDraws.map((draw, index) => [draw.id, index]));
  const sources: SourceSummary[] = POSITIONS.map((position) => {
    const number = currentNumbers[position - 1] ?? 0;
    const matches = orderedDraws.filter((draw) => draw.numbers[position - 1] === number);
    const withNext = matches.filter((draw) => draw.followingDraw !== undefined || (drawIndexById.get(draw.id) ?? orderedDraws.length) < orderedDraws.length - 1);
    return { position, number, historicalOccurrences: matches.length, occurrencesWithNextDraw: withNext.length, transitions: [] };
  });

  for (const source of sources) {
    const matches = orderedDraws.filter((draw) => draw.numbers[source.position - 1] === source.number);
    for (const historicalDraw of matches) {
      const historicalIndex = drawIndexById.get(historicalDraw.id) ?? -1;
      const nextDraw = historicalDraw.followingDraw ?? (historicalIndex >= 0 ? orderedDraws[historicalIndex + 1] : undefined);
      if (!nextDraw) continue;
      for (const targetPosition of POSITIONS) {
        const targetNumber = nextDraw.numbers[targetPosition - 1] ?? 0;
        const key = `${source.position}|${source.number}|${targetPosition}|${targetNumber}`;
        const existing = transitionMap.get(key);
        const evidence = { historicalDraw, nextDraw };
        if (existing) existing.evidence.push(evidence);
        else transitionMap.set(key, {
          key,
          sourcePosition: source.position,
          sourceNumber: source.number,
          targetPosition,
          targetNumber,
          occurrenceCount: 1,
          evidence: [evidence],
        });
      }
    }
  }

  const allTransitions = [...transitionMap.values()].map((transition) => ({ ...transition, occurrenceCount: transition.evidence.length }));
  const transitions = allTransitions
    .filter((transition) => transition.occurrenceCount >= minimumOccurrences)
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.sourcePosition - b.sourcePosition || a.targetPosition - b.targetPosition || a.targetNumber - b.targetNumber);
  const visibleKeys = new Set(transitions.map((transition) => transition.key));
  for (const source of sources) source.transitions = transitions.filter((transition) => transition.sourcePosition === source.position && transition.sourceNumber === source.number);

  const convergenceMap = new Map<string, TransitionGroup[]>();
  for (const transition of transitions) {
    const key = `${transition.targetPosition}|${transition.targetNumber}`;
    const list = convergenceMap.get(key) ?? [];
    list.push(transition);
    convergenceMap.set(key, list);
  }
  const convergence = [...convergenceMap.entries()]
    .filter(([, relationships]) => new Set(relationships.map((relationship) => `${relationship.sourcePosition}|${relationship.sourceNumber}`)).size > 1)
    .map(([key, relationships]) => {
      const [targetPosition, targetNumber] = key.split("|").map(Number);
      return { targetPosition: targetPosition as Position, targetNumber: targetNumber ?? 0, sources: relationships };
    })
    .sort((a, b) => b.sources.length - a.sources.length || b.sources.reduce((sum, item) => sum + item.occurrenceCount, 0) - a.sources.reduce((sum, item) => sum + item.occurrenceCount, 0));

  const cellMap = new Map<string, MatrixCell>();
  for (const transition of allTransitions.filter((item) => visibleKeys.has(item.key))) {
    const key = `${transition.sourcePosition}|${transition.targetPosition}`;
    const cell = cellMap.get(key);
    if (cell) cell.count += transition.occurrenceCount;
    else cellMap.set(key, { sourcePosition: transition.sourcePosition, targetPosition: transition.targetPosition, count: transition.occurrenceCount });
  }

  return { orderedDraws, sources, transitions, convergence, matrix: [...cellMap.values()], duplicateCount, analyzedDrawCount: orderedDraws.length };
}
