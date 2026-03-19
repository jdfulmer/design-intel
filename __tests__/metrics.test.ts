import { describe, it, expect } from 'vitest';
import {
  cycleTimeDays,
  avgCycleTime,
  onTimeRate,
  throughput,
  healthScore,
  topAlert,
  getMonday,
  formatDate,
} from '@/lib/metrics';

// ── cycleTimeDays ────────────────────────────────────────────────────────────

describe('cycleTimeDays', () => {
  it('returns correct days between two dates', () => {
    const result = cycleTimeDays('2026-03-01', '2026-03-08');
    expect(result).toBe(7);
  });

  it('returns 0 for same-day creation and completion', () => {
    const result = cycleTimeDays('2026-03-10', '2026-03-10');
    expect(result).toBe(0);
  });

  it('returns fractional days for partial-day differences', () => {
    const result = cycleTimeDays('2026-03-10T00:00:00Z', '2026-03-10T12:00:00Z');
    expect(result).toBeCloseTo(0.5, 1);
  });

  it('clamps to 0 if completedAt is before createdAt', () => {
    const result = cycleTimeDays('2026-03-10', '2026-03-08');
    expect(result).toBe(0);
  });
});

// ── avgCycleTime ─────────────────────────────────────────────────────────────

describe('avgCycleTime', () => {
  it('returns average cycle time for completed tasks', () => {
    const tasks = [
      { created_at: '2026-03-01', completed_at: '2026-03-04' }, // 3 days
      { created_at: '2026-03-01', completed_at: '2026-03-08' }, // 7 days
    ];
    expect(avgCycleTime(tasks)).toBe(5); // (3+7)/2
  });

  it('returns null for empty array', () => {
    expect(avgCycleTime([])).toBeNull();
  });

  it('returns null when no tasks have completed_at', () => {
    const tasks = [
      { created_at: '2026-03-01', completed_at: null },
      { created_at: '2026-03-05', completed_at: null },
    ];
    expect(avgCycleTime(tasks)).toBeNull();
  });

  it('ignores tasks without completed_at', () => {
    const tasks = [
      { created_at: '2026-03-01', completed_at: '2026-03-11' }, // 10 days
      { created_at: '2026-03-01', completed_at: null },
    ];
    expect(avgCycleTime(tasks)).toBe(10);
  });

  it('rounds to one decimal place', () => {
    const tasks = [
      { created_at: '2026-03-01', completed_at: '2026-03-04' }, // 3 days
      { created_at: '2026-03-01', completed_at: '2026-03-05' }, // 4 days
      { created_at: '2026-03-01', completed_at: '2026-03-06' }, // 5 days
    ];
    expect(avgCycleTime(tasks)).toBe(4); // (3+4+5)/3 = 4.0
  });
});

// ── onTimeRate ───────────────────────────────────────────────────────────────

describe('onTimeRate', () => {
  it('returns 1.0 when all tasks are on time', () => {
    const tasks = [
      { due_on: '2026-03-10', completed_at: '2026-03-09T00:00:00Z' },
      { due_on: '2026-03-15', completed_at: '2026-03-15T00:00:00Z' },
    ];
    expect(onTimeRate(tasks)).toBe(1);
  });

  it('returns 0.0 when all tasks are late', () => {
    const tasks = [
      { due_on: '2026-03-10', completed_at: '2026-03-12T00:00:00Z' },
      { due_on: '2026-03-15', completed_at: '2026-03-20T00:00:00Z' },
    ];
    expect(onTimeRate(tasks)).toBe(0);
  });

  it('returns correct rate for mixed on-time and late', () => {
    const tasks = [
      { due_on: '2026-03-10', completed_at: '2026-03-09T00:00:00Z' }, // on time
      { due_on: '2026-03-15', completed_at: '2026-03-20T00:00:00Z' }, // late
    ];
    expect(onTimeRate(tasks)).toBe(0.5);
  });

  it('returns null for empty array', () => {
    expect(onTimeRate([])).toBeNull();
  });

  it('returns null when no tasks have both due_on and completed_at', () => {
    const tasks = [
      { due_on: null, completed_at: '2026-03-10T00:00:00Z' },
      { due_on: '2026-03-10', completed_at: null },
      { due_on: null, completed_at: null },
    ];
    expect(onTimeRate(tasks)).toBeNull();
  });

  it('ignores tasks without due_on', () => {
    const tasks = [
      { due_on: '2026-03-10', completed_at: '2026-03-09T00:00:00Z' }, // on time, counted
      { due_on: null, completed_at: '2026-03-20T00:00:00Z' },         // no due date, skipped
    ];
    expect(onTimeRate(tasks)).toBe(1);
  });

  it('considers same-day completion as on time', () => {
    const tasks = [
      { due_on: '2026-03-10', completed_at: '2026-03-10T23:59:59Z' },
    ];
    expect(onTimeRate(tasks)).toBe(1);
  });
});

// ── throughput ────────────────────────────────────────────────────────────────

describe('throughput', () => {
  it('counts completed tasks', () => {
    const tasks = [
      { completed_at: '2026-03-10T00:00:00Z' },
      { completed_at: '2026-03-12T00:00:00Z' },
      { completed_at: null },
    ];
    expect(throughput(tasks)).toBe(2);
  });

  it('returns 0 for empty array', () => {
    expect(throughput([])).toBe(0);
  });

  it('returns 0 when no tasks are completed', () => {
    const tasks = [
      { completed_at: null },
      { completed_at: null },
    ];
    expect(throughput(tasks)).toBe(0);
  });

  it('returns full count when all tasks are completed', () => {
    const tasks = [
      { completed_at: '2026-03-10T00:00:00Z' },
      { completed_at: '2026-03-12T00:00:00Z' },
    ];
    expect(throughput(tasks)).toBe(2);
  });
});

// ── healthScore ──────────────────────────────────────────────────────────────

describe('healthScore', () => {
  it('returns maximum score for perfect metrics', () => {
    // onTime=1.0 → 40pts, avgCycle=3 → 30pts, velocity 2x → 30pts
    expect(healthScore(1.0, 3, 10, 5)).toBe(100);
  });

  it('returns neutral score when all inputs are null/zero', () => {
    // onTime=null → 20pts, avgCycle=null → 15pts, 0/0 velocity → 15pts
    expect(healthScore(null, null, 0, 0)).toBe(50);
  });

  it('gives 0 cycle time points for very slow cycle (14+ days)', () => {
    // avgCycle=14 → (14-3)/11 * 30 = 30 → 30-30 = 0pts
    expect(healthScore(null, 14, 0, 0)).toBe(35); // 20 + 0 + 15
  });

  it('gives full cycle time points for 3-day cycle', () => {
    expect(healthScore(null, 3, 0, 0)).toBe(65); // 20 + 30 + 15
  });

  it('gives velocity boost when thisWeek > 0 but lastWeek = 0', () => {
    expect(healthScore(null, null, 5, 0)).toBe(60); // 20 + 15 + 25
  });

  it('caps velocity at 30 for very high ratio', () => {
    // thisWeek/lastWeek = 10/1 → 150, capped at 30
    expect(healthScore(null, null, 10, 1)).toBe(65); // 20 + 15 + 30
  });

  it('clamps total score to 0-100 range', () => {
    expect(healthScore(1.0, 3, 10, 5)).toBeLessThanOrEqual(100);
    expect(healthScore(0, 20, 0, 10)).toBeGreaterThanOrEqual(0);
  });
});

// ── topAlert ─────────────────────────────────────────────────────────────────

describe('topAlert', () => {
  it('returns red severity for 5+ overdue tasks', () => {
    const alert = topAlert(5, [], []);
    expect(alert.severity).toBe('red');
    expect(alert.text).toContain('5 tasks overdue');
  });

  it('returns red severity for overloaded designers (even if fewer overdue)', () => {
    const alert = topAlert(3, ['Alice', 'Bob'], []);
    expect(alert.severity).toBe('red');
    expect(alert.text).toContain('Alice');
    expect(alert.text).toContain('2 total');
  });

  it('returns orange severity for 1-4 overdue tasks', () => {
    const alert = topAlert(2, [], []);
    expect(alert.severity).toBe('orange');
    expect(alert.text).toContain('2 tasks overdue');
  });

  it('returns orange with singular "task" for exactly 1 overdue', () => {
    const alert = topAlert(1, [], []);
    expect(alert.severity).toBe('orange');
    expect(alert.text).toBe('1 task overdue');
  });

  it('returns orange severity for high pressure clients', () => {
    const alert = topAlert(0, [], ['Acme Corp']);
    expect(alert.severity).toBe('orange');
    expect(alert.text).toContain('Acme Corp');
  });

  it('returns green "All clear" when nothing is wrong', () => {
    const alert = topAlert(0, [], []);
    expect(alert).toEqual({ text: 'All clear', severity: 'green' });
  });

  it('prioritizes high overdue count over designer overload', () => {
    const alert = topAlert(7, ['Alice'], ['Acme']);
    expect(alert.severity).toBe('red');
    expect(alert.text).toContain('7 tasks overdue');
  });
});

// ── getMonday ────────────────────────────────────────────────────────────────

describe('getMonday', () => {
  it('returns the same day if date is already Monday', () => {
    const monday = new Date('2026-03-16T12:00:00Z'); // Monday
    const result = getMonday(monday);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(16);
  });

  it('returns previous Monday for a Wednesday', () => {
    const wednesday = new Date('2026-03-18T12:00:00Z'); // Wednesday
    const result = getMonday(wednesday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(16);
  });

  it('returns previous Monday for a Sunday', () => {
    const sunday = new Date('2026-03-22T12:00:00Z'); // Sunday
    const result = getMonday(sunday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(16);
  });

  it('returns previous Monday for a Saturday', () => {
    const saturday = new Date('2026-03-21T12:00:00Z'); // Saturday
    const result = getMonday(saturday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(16);
  });

  it('zeroes out the time component', () => {
    const date = new Date('2026-03-18T15:30:45Z');
    const result = getMonday(date);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('does not mutate the input date', () => {
    const original = new Date('2026-03-18T12:00:00Z');
    const originalTime = original.getTime();
    getMonday(original);
    expect(original.getTime()).toBe(originalTime);
  });
});

// ── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const d = new Date('2026-03-16T00:00:00Z');
    expect(formatDate(d)).toBe('2026-03-16');
  });

  it('zero-pads single-digit months and days', () => {
    const d = new Date('2026-01-05T00:00:00Z');
    expect(formatDate(d)).toBe('2026-01-05');
  });

  it('handles end-of-year dates', () => {
    const d = new Date('2026-12-31T00:00:00Z');
    expect(formatDate(d)).toBe('2026-12-31');
  });
});
