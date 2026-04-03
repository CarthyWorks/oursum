import { describe, test, expect, beforeEach } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { RuleEngine } from './rule-engine';
import type { Rule } from '../../shared/types';
import { DataFolderConfig } from '../persistence/config';
import { withTestDataFolder } from '../persistence/test-utils';
import { atomicWrite } from '../persistence/utils';

beforeEach(() => {
  RuleEngine.reset();
});

// ── AC #8: ENOENT ───────────────────────────────────────────────────────────
describe('ENOENT — no rules.json', () => {
  test('returns null when rules.json does not exist', async () => {
    await withTestDataFolder(async () => {
      const result = await RuleEngine.getInstance().applyRules('SUPERMERCATO COOP');
      expect(result).toBeNull();
    });
  });
});

// ── AC #9: Invalid JSON ─────────────────────────────────────────────────────
describe('graceful fallback on corrupt data', () => {
  test('uses empty rule set when rules.json contains invalid JSON', async () => {
    await withTestDataFolder(async (dir) => {
      await fs.writeFile(path.join(dir, 'rules.json'), 'NOT-JSON', 'utf-8');
      const result = await RuleEngine.getInstance().applyRules('anything');
      expect(result).toBeNull();
    });
  });

  test('uses empty rule set when rules.json fails schema validation', async () => {
    await withTestDataFolder(async (dir) => {
      await fs.writeFile(
        path.join(dir, 'rules.json'),
        JSON.stringify([{ id: '1', pattern: 'x' /* missing category, matchType */ }]),
        'utf-8',
      );
      const result = await RuleEngine.getInstance().applyRules('x');
      expect(result).toBeNull();
    });
  });
});

// ── AC #1: Singleton ────────────────────────────────────────────────────────
describe('singleton', () => {
  test('getInstance returns the same instance', () => {
    const a = RuleEngine.getInstance();
    const b = RuleEngine.getInstance();
    expect(a).toBe(b);
  });
});

// ── AC #2: matchType 'contains' ─────────────────────────────────────────────
describe("matchType 'contains'", () => {
  test('matches case-insensitively and returns category', async () => {
    await withTestDataFolder(async () => {
      const engine = RuleEngine.getInstance();
      await engine.saveRule({ pattern: 'coop', category: 'Groceries', matchType: 'contains' });
      expect(await engine.applyRules('SUPERMERCATO COOP')).toBe('Groceries');
      expect(await engine.applyRules('BENZINA')).toBeNull();
    });
  });
});

// ── AC #2: matchType 'startsWith' ───────────────────────────────────────────
describe("matchType 'startsWith'", () => {
  test('matches from beginning of string case-insensitively', async () => {
    await withTestDataFolder(async () => {
      const engine = RuleEngine.getInstance();
      await engine.saveRule({ pattern: 'AMAZON', category: 'Shopping', matchType: 'startsWith' });
      expect(await engine.applyRules('Amazon Prime')).toBe('Shopping');
      expect(await engine.applyRules('FAST AMAZON')).toBeNull();
    });
  });
});

// ── AC #2: matchType 'regex' ────────────────────────────────────────────────
describe("matchType 'regex'", () => {
  test('matches with valid regex (case-insensitive via i flag)', async () => {
    await withTestDataFolder(async () => {
      const engine = RuleEngine.getInstance();
      await engine.saveRule({ pattern: '^ATM\\s+\\d+', category: 'Cash', matchType: 'regex' });
      expect(await engine.applyRules('ATM 123')).toBe('Cash');
      expect(await engine.applyRules('TRANSFER ATM')).toBeNull();
    });
  });

  test('invalid regex does not throw — returns null', async () => {
    await withTestDataFolder(async () => {
      const engine = RuleEngine.getInstance();
      await engine.saveRule({ pattern: '[', category: 'Bad', matchType: 'regex' });
      expect(await engine.applyRules('anything')).toBeNull();
    });
  });
});

// ── AC #2 / ADR-002: Most-specific-match ────────────────────────────────────
describe('most-specific-match — longest pattern wins (ADR-002)', () => {
  test('returns category of longest matching pattern, not first in list', async () => {
    await withTestDataFolder(async (dir) => {
      // Shorter pattern first in array — it should NOT win
      const rules: Rule[] = [
        { id: '1', pattern: 'AMAZON', category: 'General Shopping', matchType: 'contains' },
        { id: '2', pattern: 'AMAZON PRIME', category: 'Subscriptions', matchType: 'contains' },
      ];
      await atomicWrite(path.join(dir, 'rules.json'), JSON.stringify(rules));
      const result = await RuleEngine.getInstance().applyRules('AMAZON PRIME MEMBERSHIP');
      expect(result).toBe('Subscriptions'); // longer pattern wins
    });
  });
});

// ── AC #3: No match returns null ─────────────────────────────────────────────
describe('no match', () => {
  test('returns null when no rule matches', async () => {
    await withTestDataFolder(async () => {
      const engine = RuleEngine.getInstance();
      await engine.saveRule({ pattern: 'SUPERMERCATO', category: 'Groceries', matchType: 'contains' });
      expect(await engine.applyRules('BENZINA ESSO')).toBeNull();
    });
  });
});

// ── AC #5: saveRule ──────────────────────────────────────────────────────────
describe('saveRule', () => {
  test('persists rule and applyRules returns category immediately without reload', async () => {
    await withTestDataFolder(async () => {
      const engine = RuleEngine.getInstance();
      const saveResult = await engine.saveRule({ pattern: 'COOP', category: 'Groceries', matchType: 'contains' });
      expect(saveResult.ok).toBe(true);
      // In-memory — no reload needed
      const match = await engine.applyRules('SUPERMERCATO COOP');
      expect(match).toBe('Groceries');
      // Persisted to disk — new engine instance reads the same rule
      RuleEngine.reset();
      const match2 = await RuleEngine.getInstance().applyRules('SUPERMERCATO COOP');
      expect(match2).toBe('Groceries');
    });
  });

  test('upserts by pattern — same pattern updates category and preserves id', async () => {
    await withTestDataFolder(async () => {
      const engine = RuleEngine.getInstance();
      await engine.saveRule({ pattern: 'NETFLIX', category: 'Entertainment', matchType: 'contains' });
      const rulesBefore = await engine.getRules();
      const originalId = rulesBefore[0].id;

      await engine.saveRule({ pattern: 'NETFLIX', category: 'Subscriptions', matchType: 'contains' });
      const rulesAfter = await engine.getRules();
      expect(rulesAfter).toHaveLength(1);
      expect(rulesAfter[0].category).toBe('Subscriptions');
      expect(rulesAfter[0].id).toBe(originalId);
    });
  });

  test('does not mutate in-memory rules when persistence fails', async () => {
    const rootDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-rule-engine-save-failure-'));
    const blockedPath = path.join(rootDir, 'blocked');

    try {
      await fs.writeFile(blockedPath, 'not-a-directory', 'utf-8');

      await DataFolderConfig.runWithTestPath(blockedPath, async () => {
        const engine = RuleEngine.getInstance();

        const saveResult = await engine.saveRule({
          pattern: 'COOP',
          category: 'Groceries',
          matchType: 'contains',
        });

        expect(saveResult.ok).toBe(false);
        expect(await engine.applyRules('SUPERMERCATO COOP')).toBeNull();
        expect(await engine.getRules()).toEqual([]);
      });
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});

// ── AC #6: deleteRule ────────────────────────────────────────────────────────
describe('deleteRule', () => {
  test('removes rule from memory and disk, stops matching', async () => {
    await withTestDataFolder(async () => {
      const engine = RuleEngine.getInstance();
      await engine.saveRule({ pattern: 'COOP', category: 'Groceries', matchType: 'contains' });
      await engine.saveRule({ pattern: 'AMAZON', category: 'Shopping', matchType: 'contains' });

      await engine.deleteRule('COOP');
      const rules = await engine.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].pattern).toBe('AMAZON');
      expect(await engine.applyRules('SUPERMERCATO COOP')).toBeNull();
      // Verify disk persistence — new instance reads only the surviving rule
      RuleEngine.reset();
      const rules2 = await RuleEngine.getInstance().getRules();
      expect(rules2).toHaveLength(1);
      expect(rules2[0].pattern).toBe('AMAZON');
      expect(await RuleEngine.getInstance().applyRules('SUPERMERCATO COOP')).toBeNull();
    });
  });

  test('does not drop in-memory rules when delete persistence fails', async () => {
    const rootDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-rule-engine-delete-failure-'));
    const blockedPath = path.join(rootDir, 'blocked');

    try {
      await fs.writeFile(blockedPath, 'not-a-directory', 'utf-8');
      await fs.writeFile(
        path.join(rootDir, 'rules.json'),
        JSON.stringify([
          { id: '1', pattern: 'COOP', category: 'Groceries', matchType: 'contains' },
        ]),
        'utf-8',
      );

      await DataFolderConfig.runWithTestPath(rootDir, async () => {
        const engine = RuleEngine.getInstance();
        expect(await engine.applyRules('SUPERMERCATO COOP')).toBe('Groceries');
      });

      RuleEngine.reset();

      await DataFolderConfig.runWithTestPath(blockedPath, async () => {
        const engine = RuleEngine.getInstance();
        (engine as unknown as { rules: Rule[]; _loadPromise: Promise<void> }).rules = [
          { id: '1', pattern: 'COOP', category: 'Groceries', matchType: 'contains' },
        ];
        (engine as unknown as { rules: Rule[]; _loadPromise: Promise<void> })._loadPromise = Promise.resolve();

        const deleteResult = await engine.deleteRule('COOP');
        expect(deleteResult.ok).toBe(false);
        expect(await engine.applyRules('SUPERMERCATO COOP')).toBe('Groceries');
        expect(await engine.getRules()).toEqual([
          { id: '1', pattern: 'COOP', category: 'Groceries', matchType: 'contains' },
        ]);
      });
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});

// ── AC #7: getRules ──────────────────────────────────────────────────────────
describe('getRules', () => {
  test('returns copy — external mutation does not affect engine', async () => {
    await withTestDataFolder(async () => {
      const engine = RuleEngine.getInstance();
      await engine.saveRule({ pattern: 'X', category: 'Y', matchType: 'contains' });
      const rules = await engine.getRules();
      rules[0].category = 'Mutated';
      rules.push({ id: 'fake', pattern: 'injected', category: 'evil', matchType: 'contains' });
      const rules2 = await engine.getRules();
      expect(rules2).toHaveLength(1); // still 1 — mutation not reflected
      expect(rules2[0].category).toBe('Y');
      expect(await engine.applyRules('X marks the spot')).toBe('Y');
    });
  });
});

// ── AC #4 / NFR4: Performance guard ─────────────────────────────────────────
describe('performance', () => {
  test('applyRules across 1000 rows × 500 rules completes under 1000ms', async () => {
    await withTestDataFolder(async (dir) => {
      // Generate 500 rules
      const rules: Rule[] = Array.from({ length: 500 }, (_, i) => ({
        id: String(i),
        pattern: `PATTERN_${i}`,
        category: 'Cat',
        matchType: 'contains' as const,
      }));
      await atomicWrite(path.join(dir, 'rules.json'), JSON.stringify(rules));
      const engine = RuleEngine.getInstance();
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        await engine.applyRules(`DESCRIPTION_${i}`);
      }
      expect(Date.now() - start).toBeLessThan(1000);
    });
  });
});
