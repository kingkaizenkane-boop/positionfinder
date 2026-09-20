import { describe, it, expect } from 'vitest';
import { analyzeTransitions, parseHistoricalGames, Numbers, HistoricalDraw } from './transition-analyzer';

describe('transition-analyzer', () => {
  it('identifies exact positional transitions', () => {
    const current: Numbers = [10, 20, 30, 40, 50, 60, 70, 80, 90, 1];
    const history: HistoricalDraw[] = [
      { id: '1', drawNumber: 1, drawDate: '2020-01-01', numbers: [10, 99, 99, 99, 99, 99, 99, 99, 99, 99] },
      { id: '2', drawNumber: 2, drawDate: '2020-01-02', numbers: [11, 22, 33, 44, 55, 66, 77, 88, 99, 0] },
      { id: '3', drawNumber: 3, drawDate: '2020-01-03', numbers: [99, 20, 99, 99, 99, 99, 99, 99, 99, 99] },
      { id: '4', drawNumber: 4, drawDate: '2020-01-04', numbers: [12, 23, 34, 45, 56, 67, 78, 89, 90, 1] },
    ];

    const result = analyzeTransitions(current, history, 1);
    
    // P1:10 should match draw 1, next is draw 2
    const p1Source = result.sources.find(s => s.position === 1);
    expect(p1Source?.number).toBe(10);
    expect(p1Source?.historicalOccurrences).toBe(1);
    expect(p1Source?.transitions.some(t => t.targetNumber === 11 && t.targetPosition === 1)).toBe(true);

    // P2:20 should match draw 3, next is draw 4
    const p2Source = result.sources.find(s => s.position === 2);
    expect(p2Source?.number).toBe(20);
    expect(p2Source?.historicalOccurrences).toBe(1);
    expect(p2Source?.transitions.some(t => t.targetNumber === 23 && t.targetPosition === 2)).toBe(true);
  });

  it('respects immediately-following chronological draw rule', () => {
    const current: Numbers = [10, 0, 0, 0, 0, 0, 0, 0, 0, 0];
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
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].reason).toContain("Duplicate");
  });

  it('detects convergence correctly', () => {
    const current: Numbers = [10, 20, 0, 0, 0, 0, 0, 0, 0, 0];
    const history: HistoricalDraw[] = [
      // P1 match
      { id: '1', drawNumber: 1, drawDate: '2020-01-01', numbers: [10, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { id: '2', drawNumber: 2, drawDate: '2020-01-02', numbers: [99, 99, 88, 99, 99, 99, 99, 99, 99, 99] },
      // P2 match
      { id: '3', drawNumber: 3, drawDate: '2020-01-03', numbers: [0, 20, 0, 0, 0, 0, 0, 0, 0, 0] },
      { id: '4', drawNumber: 4, drawDate: '2020-01-04', numbers: [99, 99, 88, 99, 99, 99, 99, 99, 99, 99] },
    ];

    const result = analyzeTransitions(current, history, 1);
    // Both P1:10 and P2:20 lead to P3:88 in their respective next draws.
    const convergence = result.convergence.find(c => c.targetPosition === 3 && c.targetNumber === 88);
    expect(convergence).toBeDefined();
    expect(convergence?.sources).toHaveLength(2);
  });
});
