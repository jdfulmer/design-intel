import { describe, it, expect } from 'vitest';
import {
  clientMatchesFigmaProject,
  toFigmaName,
  toAsanaName,
  getTeamMembers,
  isTeamInvolved,
} from '@/lib/team-config';

// ── clientMatchesFigmaProject ────────────────────────────────────────────────

describe('clientMatchesFigmaProject', () => {
  it('matches identical names', () => {
    expect(clientMatchesFigmaProject('LaVanilla Amazon', 'LaVanilla Amazon')).toBe(true);
  });

  it('matches across word order (the LaVanilla case)', () => {
    expect(clientMatchesFigmaProject('LaVanilla Amazon', 'Amazon - LaVanilla')).toBe(true);
  });

  it('matches when punctuation and extra channel words differ', () => {
    expect(clientMatchesFigmaProject('LaVanilla Amazon', 'LaVanilla (Amazon Q2)')).toBe(true);
  });

  it('matches when the Figma folder is just the brand', () => {
    expect(clientMatchesFigmaProject('LaVanilla Amazon', 'LaVanilla')).toBe(true);
  });

  it('matches when the Asana name is just the brand', () => {
    expect(clientMatchesFigmaProject('LaVanilla', 'LaVanilla Amazon Storefront')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(clientMatchesFigmaProject('lavanilla amazon', 'AMAZON LAVANILLA')).toBe(true);
  });

  it('matches concatenated camelCase against spaced names (ThisWorks)', () => {
    expect(clientMatchesFigmaProject('This Works', 'ThisWorks')).toBe(true);
    expect(clientMatchesFigmaProject('This Works Internal', 'ThisWorks')).toBe(true);
  });

  it('still matches existing concatenated brands (INNBeauty)', () => {
    expect(clientMatchesFigmaProject('INNBeauty Project', 'INNBeauty')).toBe(true);
  });

  // ── over-match guards ──

  it('does NOT match two brands on the same channel', () => {
    expect(clientMatchesFigmaProject('LaVanilla Amazon', 'BrandX Amazon')).toBe(false);
  });

  it('does NOT match on a channel word alone', () => {
    expect(clientMatchesFigmaProject('LaVanilla Amazon', 'Amazon')).toBe(false);
  });

  it('does NOT match the same brand on different channels', () => {
    expect(clientMatchesFigmaProject('LaVanilla Amazon', 'LaVanilla Walmart')).toBe(false);
  });

  it('does NOT match unrelated names', () => {
    expect(clientMatchesFigmaProject('LaVanilla Amazon', 'Acme Web')).toBe(false);
  });

  // ── empty / malformed inputs ──

  it('returns false for empty strings', () => {
    expect(clientMatchesFigmaProject('', 'LaVanilla')).toBe(false);
    expect(clientMatchesFigmaProject('LaVanilla', '')).toBe(false);
  });

  it('returns false when a name is all generic tokens', () => {
    expect(clientMatchesFigmaProject('Amazon Ads', 'Amazon Campaign')).toBe(false);
  });
});

// ── name mapping helpers (regression coverage) ──────────────────────────────

describe('toFigmaName / toAsanaName', () => {
  it('maps a known Asana name to its Figma handle', () => {
    expect(toFigmaName('Vince Herrera')).toBe('Vincent Herrera');
  });

  it('round-trips a mapped name', () => {
    expect(toAsanaName('Vincent Herrera')).toBe('Vince Herrera');
  });

  it('passes through unknown names unchanged', () => {
    expect(toFigmaName('Unknown Person')).toBe('Unknown Person');
  });
});

describe('getTeamMembers / isTeamInvolved', () => {
  const task = {
    assignee: { name: 'Nicole Howard' },
    followers: [{ name: 'Vince Herrera' }, { name: 'Outside Client' }],
  };

  it('collects assignee + follower team members, ignoring non-team', () => {
    expect(getTeamMembers(task)).toEqual(['Nicole Howard', 'Vince Herrera']);
  });

  it('reports team involvement', () => {
    expect(isTeamInvolved(task)).toBe(true);
    expect(isTeamInvolved({ assignee: { name: 'Outside Client' }, followers: [] })).toBe(false);
  });
});
