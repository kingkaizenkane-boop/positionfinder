export type Position = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Numbers = [number, number, number, number, number, number, number, number, number, number];

export type HistoricalDraw = {
  id: string;
  drawNumber: number;
  drawDate: string;
  numbers: Numbers;
  gameName?: string;
  followingDraw?: HistoricalDraw;
};

export type ParsedRecord = HistoricalDraw & { sourceLine: number };
export type InvalidRecord = { sourceLine: number; text: string; reason: string; gameName?: string };
export type SequenceWarning = { gameName: string; message: string; drawNumbers: number[] };
export type ParsedGame = {
  name: string;
  normalizedName: string;
  valid: ParsedRecord[];
  invalid: InvalidRecord[];
  duplicates: ParsedRecord[];
  sequenceWarnings: SequenceWarning[];
};

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

export type TargetPairRelationship = {
  sourcePosition: Position;
  sourceNumber: number;
  targetPosition: Position;
  targetNumber: number;
};

export type TargetPairEvidence = {
  historicalDraw: HistoricalDraw;
  nextDraw: HistoricalDraw;
  relationships: [TargetPairRelationship, TargetPairRelationship];
};

export type RepeatedTargetPair = {
  key: string;
  sourceCount: 1 | 2;
  relationships: [TargetPairRelationship, TargetPairRelationship];
  occurrenceCount: number;
  evidence: TargetPairEvidence[];
};

export type AnalysisResult = {
  orderedDraws: HistoricalDraw[];
  sources: SourceSummary[];
  transitions: TransitionGroup[];
  allTransitions: TransitionGroup[];
  convergence: ConvergenceGroup[];
  matrix: MatrixCell[];
  duplicateCount: number;
  analyzedDrawCount: number;
};

export type ParsedImport = {
  valid: ParsedRecord[];
  invalid: InvalidRecord[];
  duplicates: ParsedRecord[];
  threeLinePairs: number;
  games: ParsedGame[];
  sequenceWarnings: SequenceWarning[];
  drawsDetected: number;
};

export const POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const MINIMUM_OPTIONS = [1, 2, 3, 4, 5, 10] as const;

type NumberLine = { text: string; sourceLine: number };
const DEFAULT_GAME_NAME = "Unspecified game";

export const normalizeGameName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

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
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
};

const toNumbers = (value: string): number[] => value.replace(/[|,;]/g, " ").trim().split(/\s+/).filter(Boolean).map(Number).filter((number) => Number.isInteger(number));

const parseNumberBlock = (value: string): number[] => {
  const trimmed = value.trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 5 && tokens.every((token) => /^\d{1,2}$/.test(token))) return tokens.map(Number);
  const compact = trimmed.replace(/\D/g, "");
  if (compact.length >= 2 && compact.length <= 10 && compact.length % 2 === 0) return compact.match(/\d{2}/g)?.map(Number) ?? [];
  return toNumbers(trimmed);
};

const parseDrawNumbers = (value: string): number[] => {
  const blocks = value.split("|");
  if (blocks.length === 2) return [...parseNumberBlock(blocks[0] ?? ""), ...parseNumberBlock(blocks[1] ?? "")];
  const compact = value.replace(/\D/g, "");
  if (compact.length === 20) return compact.match(/\d{2}/g)?.map(Number) ?? [];
  return toNumbers(value);
};

const isDrawLine = (line: string) => /^\s*\d+\s*[:\-]/.test(line);
const isMetadataLine = (line: string) => /^(began|last updated|updated|source|database|draws?|date|\[?end\b)/i.test(line.trim());
const isGameHeader = (line: string) => {
  const trimmed = line.trim();
  return Boolean(trimmed && /[a-z]/i.test(trimmed) && !isMetadataLine(trimmed) && !/^\d/.test(trimmed) && !/[/:]\s*\d/.test(trimmed));
};

const invalidNumbersReason = (numbers: number[]) => {
  if (numbers.length !== 10) return `Expected 10 numbers but found ${numbers.length}.`;
  const invalidNumber = numbers.find((number) => number < 1 || number > 90);
  return invalidNumber === undefined ? "Expected 10 numbers but found 0." : `Number ${invalidNumber} is outside the valid range 01–90.`;
};

const getSequenceWarnings = (gameName: string, records: ParsedRecord[]): SequenceWarning[] => {
  const ordered = [...records].sort((a, b) => a.drawNumber - b.drawNumber);
  const warnings: SequenceWarning[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (!previous || !current || current.drawNumber <= previous.drawNumber + 1) continue;
    const missing = Array.from({ length: current.drawNumber - previous.drawNumber - 1 }, (_, offset) => previous.drawNumber + offset + 1);
    warnings.push({
      gameName,
      drawNumbers: missing,
      message: `${missing.map((number) => number.toString().padStart(4, "0")).join(", ")} missing between ${previous.drawNumber.toString().padStart(4, "0")} and ${current.drawNumber.toString().padStart(4, "0")}.`,
    });
  }
  return warnings;
};

export function parseHistoricalGames(text: string): ParsedImport {
  const valid: ParsedRecord[] = [];
  const invalid: InvalidRecord[] = [];
  const duplicates: ParsedRecord[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/).flatMap((line) => line.split(/\s+\/\s+/));
  const plainLines: NumberLine[] = lines.flatMap((line, index) => {
    if (/[a-z]/i.test(line) || /[:/\-]/.test(line)) return [];
    const numbers = parseDrawNumbers(line);
    return numbers.length === 10 && numbers.every((number) => number >= 1 && number <= 90) ? [{ text: line, sourceLine: index + 1 }] : [];
  });

  if (plainLines.length >= 3 && plainLines.length % 3 === 0) {
    for (let index = 0; index < plainLines.length; index += 3) {
      const sourceLine = plainLines[index + 1];
      const targetLine = plainLines[index + 2];
      if (!sourceLine || !targetLine) continue;
      const sourceNumbers = parseDrawNumbers(sourceLine.text);
      const targetNumbers = parseDrawNumbers(targetLine.text);
      if (sourceNumbers.length !== 10 || targetNumbers.length !== 10) continue;
      const source: ParsedRecord = {
        id: `import-pair-${sourceLine.sourceLine}`,
        drawNumber: (index / 3) * 2 + 1,
        drawDate: "2000-01-01",
        numbers: sourceNumbers as Numbers,
        sourceLine: sourceLine.sourceLine,
        gameName: DEFAULT_GAME_NAME,
        followingDraw: {
          id: `import-pair-${targetLine.sourceLine}`,
          drawNumber: (index / 3) * 2 + 2,
          drawDate: "2000-01-01",
          numbers: targetNumbers as Numbers,
          gameName: DEFAULT_GAME_NAME,
        },
      };
      const key = `${source.numbers.join(",")}|${targetNumbers.join(",")}`;
      if (seen.has(key)) {
        duplicates.push(source);
        invalid.push({ sourceLine: source.sourceLine, text: sourceLine.text, reason: "Duplicate three-line record detected; it will not be counted twice.", gameName: DEFAULT_GAME_NAME });
      } else {
        seen.add(key);
        valid.push(source);
      }
    }
    const game: ParsedGame = { name: DEFAULT_GAME_NAME, normalizedName: normalizeGameName(DEFAULT_GAME_NAME), valid, invalid: invalid.filter((item) => item.gameName === DEFAULT_GAME_NAME), duplicates, sequenceWarnings: [] };
    return { valid, invalid, duplicates, threeLinePairs: valid.length, games: [game], sequenceWarnings: [], drawsDetected: valid.length * 2 + duplicates.length * 2 };
  }

  const datedRecords: ParsedRecord[] = [];
  const gameMap = new Map<string, ParsedGame>();
  let currentGameName = DEFAULT_GAME_NAME;
  const getGame = (name: string) => {
    const normalizedName = normalizeGameName(name);
    const existing = gameMap.get(normalizedName);
    if (existing) return existing;
    const game: ParsedGame = { name: name.trim() || DEFAULT_GAME_NAME, normalizedName, valid: [], invalid: [], duplicates: [], sequenceWarnings: [] };
    gameMap.set(normalizedName, game);
    return game;
  };

  lines.forEach((line, index) => {
    const sourceLine = index + 1;
    const trimmed = line.trim();
    if (!trimmed) return;
    if (!isDrawLine(trimmed)) {
      if (isGameHeader(trimmed)) currentGameName = trimmed.replace(/\s+/g, " ");
      return;
    }
    const game = getGame(currentGameName);
    const match = trimmed.match(/^\s*(\d+)\s*[:\-]\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\s*[:\-]?\s*(.*)$/);
    if (!match) {
      const item = { sourceLine, text: line, reason: "Could not read the draw number and date.", gameName: game.name };
      invalid.push(item);
      game.invalid.push(item);
      return;
    }
    const [, drawNumberText, dateText, numberText] = match;
    const drawNumber = Number(drawNumberText);
    const drawDate = toDateKey(dateText ?? "");
    const numbers = parseDrawNumbers(numberText ?? "");
    const reason = !drawNumberText || !Number.isInteger(drawNumber) ? "Draw number must be numeric." : !drawDate ? "Invalid draw date." : numbers.length !== 10 ? invalidNumbersReason(numbers) : numbers.some((number) => number < 1 || number > 90) ? invalidNumbersReason(numbers) : null;
    if (reason) {
      const item = { sourceLine, text: line, reason, gameName: game.name };
      invalid.push(item);
      game.invalid.push(item);
      return;
    }
    const record: ParsedRecord = { id: `import-${sourceLine}-${drawNumber}`, drawNumber, drawDate: drawDate as string, numbers: numbers as Numbers, sourceLine, gameName: game.name };
    datedRecords.push(record);
  });

  datedRecords.forEach((record) => {
    const game = getGame(record.gameName ?? DEFAULT_GAME_NAME);
    const key = `${game.normalizedName}|${record.drawNumber}|${record.drawDate}|${record.numbers.join(",")}`;
    if (seen.has(key)) {
      duplicates.push(record);
      const item = { sourceLine: record.sourceLine, text: lines[record.sourceLine - 1] ?? "", reason: "Duplicate draw detected; it will not be counted twice.", gameName: game.name };
      invalid.push(item);
      game.invalid.push(item);
      game.duplicates.push(record);
      return;
    }
    seen.add(key);
    valid.push(record);
    game.valid.push(record);
  });

  for (const game of gameMap.values()) game.sequenceWarnings = getSequenceWarnings(game.name, game.valid);
  return { valid, invalid, duplicates, threeLinePairs: 0, games: [...gameMap.values()], sequenceWarnings: [...gameMap.values()].flatMap((game) => game.sequenceWarnings), drawsDetected: datedRecords.length + invalid.length };
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

const canPair = (source: HistoricalDraw, target: HistoricalDraw) => source.gameName === target.gameName && target.drawNumber === source.drawNumber + 1;

export function analyzeTransitions(currentNumbers: Numbers, inputDraws: HistoricalDraw[], minimumOccurrences = 2, duplicateCount = 0): AnalysisResult {
  const orderedDraws = [...inputDraws].sort((a, b) => a.gameName?.localeCompare(b.gameName ?? "") || a.drawDate.localeCompare(b.drawDate) || a.drawNumber - b.drawNumber);
  const transitionMap = new Map<string, TransitionGroup>();
  const currentSourceKeys = new Set(currentNumbers.map((number, index) => `${index + 1}|${number}`));
  const sources: SourceSummary[] = POSITIONS.map((position) => {
    const number = currentNumbers[position - 1] ?? 0;
    const matches = orderedDraws.filter((draw) => draw.numbers[position - 1] === number);
    const withNext = matches.filter((draw) => {
      const index = orderedDraws.indexOf(draw);
      const next = draw.followingDraw ?? orderedDraws[index + 1];
      return Boolean(next && (draw.followingDraw ? true : canPair(draw, next)));
    });
    return { position, number, historicalOccurrences: matches.length, occurrencesWithNextDraw: withNext.length, transitions: [] };
  });

  for (let drawIndex = 0; drawIndex < orderedDraws.length; drawIndex += 1) {
    const historicalDraw = orderedDraws[drawIndex];
    if (!historicalDraw) continue;
    const nextDraw = historicalDraw.followingDraw ?? orderedDraws[drawIndex + 1];
    if (!nextDraw || (!historicalDraw.followingDraw && !canPair(historicalDraw, nextDraw))) continue;
    for (const sourcePosition of POSITIONS) {
      const sourceNumber = historicalDraw.numbers[sourcePosition - 1] ?? 0;
      for (const targetPosition of POSITIONS) {
        const targetNumber = nextDraw.numbers[targetPosition - 1] ?? 0;
        const key = `${sourcePosition}|${sourceNumber}|${targetPosition}|${targetNumber}`;
        const existing = transitionMap.get(key);
        const evidence = { historicalDraw, nextDraw };
        if (existing) existing.evidence.push(evidence);
        else transitionMap.set(key, { key, sourcePosition, sourceNumber, targetPosition, targetNumber, occurrenceCount: 1, evidence: [evidence] });
      }
    }
  }

  const allTransitions = [...transitionMap.values()].map((transition) => ({ ...transition, occurrenceCount: transition.evidence.length }));
  const repeatedTransitions = allTransitions.filter((transition) => transition.occurrenceCount >= minimumOccurrences).sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.sourcePosition - b.sourcePosition || a.targetPosition - b.targetPosition || a.targetNumber - b.targetNumber);
  const transitions = repeatedTransitions.filter((transition) => currentSourceKeys.has(`${transition.sourcePosition}|${transition.sourceNumber}`));
  for (const source of sources) source.transitions = transitions.filter((transition) => transition.sourcePosition === source.position && transition.sourceNumber === source.number);

  const convergenceMap = new Map<string, TransitionGroup[]>();
  for (const transition of transitions) {
    const key = `${transition.targetPosition}|${transition.targetNumber}`;
    const list = convergenceMap.get(key) ?? [];
    list.push(transition);
    convergenceMap.set(key, list);
  }
  const convergence = [...convergenceMap.entries()].filter(([, relationships]) => new Set(relationships.map((relationship) => `${relationship.sourcePosition}|${relationship.sourceNumber}`)).size > 1).map(([key, relationships]) => {
    const [targetPosition, targetNumber] = key.split("|").map(Number);
    return { targetPosition: targetPosition as Position, targetNumber: targetNumber ?? 0, sources: relationships };
  }).sort((a, b) => b.sources.length - a.sources.length || b.sources.reduce((sum, item) => sum + item.occurrenceCount, 0) - a.sources.reduce((sum, item) => sum + item.occurrenceCount, 0));

  const cellMap = new Map<string, MatrixCell>();
  for (const transition of repeatedTransitions) {
    const key = `${transition.sourcePosition}|${transition.targetPosition}`;
    const cell = cellMap.get(key);
    if (cell) cell.count += transition.occurrenceCount;
    else cellMap.set(key, { sourcePosition: transition.sourcePosition, targetPosition: transition.targetPosition, count: transition.occurrenceCount });
  }

  const analyzedDraws = [...new Map([...orderedDraws, ...orderedDraws.flatMap((draw) => draw.followingDraw ? [draw.followingDraw] : [])].map((draw) => [draw.id, draw])).values()];
  return { orderedDraws, sources, transitions, allTransitions, convergence, matrix: [...cellMap.values()], duplicateCount, analyzedDrawCount: analyzedDraws.length };
}

export type TargetNumberFrequency = {
  number: number;
  occurrences: number;
  drawCount: number;
  positions: Partial<Record<Position, number>>;
};

export function countTargetNumbers(analysis: Pick<AnalysisResult, "orderedDraws">): TargetNumberFrequency[] {
  const { orderedDraws } = analysis;
  const counts = new Map<number, { number: number; occurrences: number; drawIds: Set<string>; positions: Partial<Record<Position, number>> }>();
  orderedDraws.forEach((historicalDraw, drawIndex) => {
    const nextDraw = historicalDraw.followingDraw ?? orderedDraws[drawIndex + 1];
    if (!nextDraw || (!historicalDraw.followingDraw && !canPair(historicalDraw, nextDraw))) return;
    for (const position of POSITIONS) {
      const number = nextDraw.numbers[position - 1] ?? 0;
      const entry = counts.get(number) ?? { number, occurrences: 0, drawIds: new Set<string>(), positions: {} };
      entry.occurrences += 1;
      entry.drawIds.add(nextDraw.id);
      entry.positions[position] = (entry.positions[position] ?? 0) + 1;
      counts.set(number, entry);
    }
  });
  return [...counts.values()]
    .map(({ drawIds, ...entry }) => ({ ...entry, drawCount: drawIds.size }))
    .sort((a, b) => b.occurrences - a.occurrences || a.number - b.number);
}

export function findRepeatedTargetPairs(currentNumbers: Numbers, analysis: Pick<AnalysisResult, "allTransitions"> , minimumOccurrences = 2): RepeatedTargetPair[] {
  const currentSourceKeys = new Set(currentNumbers.map((number, index) => `${index + 1}|${number}`));
  const transitionsByDrawPair = new Map<string, Array<{ transition: TransitionGroup; evidence: TransitionEvidence }>>();

  for (const transition of analysis.allTransitions) {
    if (!currentSourceKeys.has(`${transition.sourcePosition}|${transition.sourceNumber}`)) continue;
    for (const evidence of transition.evidence) {
      const pairKey = `${evidence.historicalDraw.id}|${evidence.nextDraw.id}`;
      const pairTransitions = transitionsByDrawPair.get(pairKey) ?? [];
      pairTransitions.push({ transition, evidence });
      transitionsByDrawPair.set(pairKey, pairTransitions);
    }
  }

  const pairMap = new Map<string, RepeatedTargetPair>();
  for (const pairTransitions of transitionsByDrawPair.values()) {
    for (let firstIndex = 0; firstIndex < pairTransitions.length; firstIndex += 1) {
      const first = pairTransitions[firstIndex];
      if (!first) continue;
      for (let secondIndex = firstIndex + 1; secondIndex < pairTransitions.length; secondIndex += 1) {
        const second = pairTransitions[secondIndex];
        if (!second || first.transition.targetPosition === second.transition.targetPosition) continue;
        const relationships = [first.transition, second.transition].sort((a, b) => a.targetPosition - b.targetPosition).map((transition) => ({
          sourcePosition: transition.sourcePosition,
          sourceNumber: transition.sourceNumber,
          targetPosition: transition.targetPosition,
          targetNumber: transition.targetNumber,
        })) as [TargetPairRelationship, TargetPairRelationship];
        const sourceKeys = new Set(relationships.map((relationship) => `${relationship.sourcePosition}|${relationship.sourceNumber}`));
        const sourceCount = sourceKeys.size;
        if (sourceCount !== 1 && sourceCount !== 2) continue;
        const key = relationships.map((relationship) => `${relationship.sourcePosition}|${relationship.sourceNumber}|${relationship.targetPosition}|${relationship.targetNumber}`).join("|");
        const existing = pairMap.get(key);
        const evidence: TargetPairEvidence = {
          historicalDraw: first.evidence.historicalDraw,
          nextDraw: first.evidence.nextDraw,
          relationships,
        };
        if (existing) existing.evidence.push(evidence);
        else pairMap.set(key, { key, sourceCount: sourceCount as 1 | 2, relationships, occurrenceCount: 1, evidence: [evidence] });
      }
    }
  }

  return [...pairMap.values()]
    .map((pair) => ({ ...pair, occurrenceCount: pair.evidence.length }))
    .filter((pair) => pair.occurrenceCount >= minimumOccurrences)
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount || a.sourceCount - b.sourceCount || a.key.localeCompare(b.key));
}