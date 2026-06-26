import { describe, it, expect } from 'vitest';
import {
  clientMatchesFigmaProject,
  isNonClientProject,
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

  // ── alias overrides ──

  it('matches sub-brands via the alias map (Skacel)', () => {
    expect(clientMatchesFigmaProject('Skacel', 'Hikoo')).toBe(true);
    expect(clientMatchesFigmaProject('Skacel', 'Addi Needles')).toBe(true);
  });

  it('matches franchise folders via the alias map (Warner Bros)', () => {
    expect(clientMatchesFigmaProject('Warner Brothers - Discovery', 'DC Comics')).toBe(true);
    expect(clientMatchesFigmaProject('Warner Brothers - Discovery', 'Wizarding World')).toBe(true);
  });

  it('does not leak aliases to other clients', () => {
    expect(clientMatchesFigmaProject('Sara Happ', 'Hikoo')).toBe(false);
  });

  // ── over-match guards ──

  it('does NOT match two brands on the same channel', () => {
    expect(clientMatchesFigmaProject('LaVanilla Amazon', 'BrandX Amazon')).toBe(false);
  });

  it('does NOT match on a channel word alone', () => {
    expect(clientMatchesFigmaProject('LaVanilla Amazon', 'Amazon')).toBe(false);
  });

  it('matches a brand folder regardless of channel suffix on the client', () => {
    // A folder named just "Lavanila" reaches both Lavanila clients (subset rule).
    expect(clientMatchesFigmaProject('Lavanila - AMAZON', 'Lavanila')).toBe(true);
    expect(clientMatchesFigmaProject('Lavanila - Omni-Channel', 'Lavanila')).toBe(true);
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

// ── isNonClientProject ───────────────────────────────────────────────────────

describe('isNonClientProject', () => {
  it('excludes internal ops buckets', () => {
    expect(isNonClientProject('SOP Creation')).toBe(true);
    expect(isNonClientProject('MD SEO & Email')).toBe(true);
  });

  it('tolerates trailing whitespace from Asana names', () => {
    expect(isNonClientProject('Prospect Planning ')).toBe(true);
    expect(isNonClientProject('Client Delivery Priorities ')).toBe(true);
  });

  it('keeps real clients', () => {
    expect(isNonClientProject('PHLUR')).toBe(false);
    expect(isNonClientProject('Lavanila - AMAZON')).toBe(false);
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
