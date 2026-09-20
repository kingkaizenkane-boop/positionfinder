import { describe, it, expect } from 'vitest';
import { analyzeTransitions, parseHistoricalGames, Numbers, HistoricalDraw } from './transition-analyzer';

describe('transition-analyzer', () => {
  it('identifies exact positional transitions', () => {
    const current: Numbers = [10, 20, 30, 40, 50, 60, 70, 80, 90, 1];
    const history: HistoricalDraw[] = [
      { id: '1', drawNumber: 1, drawDate: '2020-01-01', numbers: [10, 91, 92, 93, 94, 95, 96, 97, 98, 99] },
      { id: '2', drawNumber: 2, drawDate: '2020-01-02', numbers: [11, 22, 33, 44, 55, 66, 77, 88, 99, 10] },
      { id: '3', drawNumber: 3, drawDate: '2020-01-03', numbers: [81, 20, 83, 84, 85, 86, 87, 88, 89, 90] },
      { id: '4', drawNumber: 4, drawDate: '2020-01-04', numbers: [12, 23, 34, 45, 56, 67, 78, 89, 90, 11] },
    ];

    const result = analyzeTransitions(current, history, 1);
    
    // P1:10 should match draw 1, next is draw 2
    const p1Source = result.sources.find(s => s.position === 1);
    expect(p1Source?.number).toBe(10);
    expect(p1Source?.historicalOccurrences).toBe(1);
    // Draw 2 P1 is 11
    expect(p1Source?.transitions.some(t => t.targetNumber === 11 && t.targetPosition === 1)).toBe(true);

    // P2:20 should match draw 3, next is draw 4
    const p2Source = result.sources.find(s => s.position === 2);
    expect(p2Source?.number).toBe(20);
    expect(p2Source?.historicalOccurrences).toBe(1);
    // Draw 4 P2 is 23
    expect(p2Source?.transitions.some(t => t.targetNumber === 23 && t.targetPosition === 2)).toBe(true);
  });

  it('respects immediately-following chronological draw rule', () => {
    const current: Numbers = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    const history: HistoricalDraw[] = [
      { id: '1', drawNumber: 1, drawDate: '2020-01-01', numbers: [10, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { id: '3', drawNumber: 3, drawDate: '2020-01-03', numbers: [50, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { id: '2', drawNumber: 2, drawDate: '2020-01-02', numbers: [99, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    ];

    const result = analyzeTransitions(current, history, 1);
    const p1Source = result.sources.find(s => s.position === 1);
    
    // Chronological order: 1 (Jan 1), 2 (Jan 2), 3 (Jan 3)
    // P1:10 is in draw 1. Next should be draw 2 (99), NOT draw 3 (50).
    expect(p1Source?.transitions.some(t => t.targetNumber === 99)).toBe(true);
    expect(p1Source?.transitions.some(t => t.targetNumber === 50)).toBe(false);
  });

  it('handles duplicate draws correctly in parser', () => {
    const text = "0001: 01/01/2020: 01 02 03 04 05 | 06 07 08 09 10\n" +
                 "0001: 01/01/2020: 01 02 03 04 05 | 06 07 08 09 10";
    const result = parseHistoricalGames(text);
    // Current implementation returns them in 'invalid' with a duplicate reason
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].reason).toContain("Duplicate");
  });

  it('detects convergence correctly', () => {
    // Current numbers for P1 and P2 are unique
    const current: Numbers = [10, 20, 31, 32, 33, 34, 35, 36, 37, 38];
    const history: HistoricalDraw[] = [
      // Draw 1: P1 is 10. Next (Draw 2) has P3: 88.
      { id: '1', drawNumber: 1, drawDate: '2020-01-01', numbers: [10, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { id: '2', drawNumber: 2, drawDate: '2020-01-02', numbers: [0, 0, 88, 0, 0, 0, 0, 0, 0, 0] },
      // Draw 3: P2 is 20. Next (Draw 4) has P3: 88.
      { id: '3', drawNumber: 3, drawDate: '2020-01-03', numbers: [0, 20, 0, 0, 0, 0, 0, 0, 0, 0] },
      { id: '4', drawNumber: 4, drawDate: '2020-01-04', numbers: [0, 0, 88, 0, 0, 0, 0, 0, 0, 0] },
    ];

    const result = analyzeTransitions(current, history, 1);
    // Convergence on target P3:88 should have 2 sources (P1:10 and P2:20)
    const convergence = result.convergence.find(c => c.targetPosition === 3 && c.targetNumber === 88);
    expect(convergence).toBeDefined();
    expect(convergence?.sources).toHaveLength(2);
    
    const sourcePositions = convergence?.sources.map(s => s.sourcePosition);
    expect(sourcePositions).toContain(1);
    expect(sourcePositions).toContain(2);
  });
});
