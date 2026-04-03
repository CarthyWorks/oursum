// src/core/rules/rule-engine.ts
// Electrobun-free: uses node:fs, Bun globals, and src/core/persistence only.
import { promises as fs } from 'node:fs';
import { DataFolderConfig } from '../persistence/config';
import { atomicWrite } from '../persistence/utils';
import { parseRules } from '../persistence/schemas';
import { type Result } from '../../shared/contracts/result';
import type { Rule, RuleInput } from '../../shared/types';
import { matchesRuleDescription } from './matches-rule-description';

export class RuleEngine {
  private static instance: RuleEngine | null = null;
  private rules: Rule[] = [];
  private _loadPromise: Promise<void> | null = null;
  private regexCache = new Map<string, RegExp | null>();

  private constructor() {}

  static getInstance(): RuleEngine {
    if (!RuleEngine.instance) {
      RuleEngine.instance = new RuleEngine();
    }
    return RuleEngine.instance;
  }

  /** @internal — call only in test beforeEach/afterEach to reset the singleton. */
  static reset(): void {
    RuleEngine.instance = null;
  }

  private ensureLoaded(): Promise<void> {
    if (!this._loadPromise) {
      this._loadPromise = this._load();
    }
    return this._loadPromise;
  }

  private async _load(): Promise<void> {
    const filePath = DataFolderConfig.getInstance().configFilePath('rules.json');
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      const result = parseRules(parsed);
      if (!result.ok) {
        console.warn('[RuleEngine] Schema violation in rules.json, using empty set:', result.error);
        this.rules = [];
      } else {
        this.rules = result.data;
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        this.rules = [];
      } else if (e instanceof SyntaxError) {
        console.warn('[RuleEngine] rules.json contains invalid JSON, using empty set:', e.message);
        this.rules = [];
      } else {
        console.warn('[RuleEngine] Unexpected error reading rules.json:', e);
        this.rules = [];
      }
    }
  }

  async applyRules(description: string): Promise<string | null> {
    await this.ensureLoaded();
    let best: Rule | null = null;
    for (const rule of this.rules) {
      if (matchesRuleDescription(description, rule, this.regexCache)) {
        if (best === null || rule.pattern.length > best.pattern.length) {
          best = rule;
        }
      }
    }
    return best ? best.category : null;
  }

  async getRules(): Promise<Rule[]> {
    await this.ensureLoaded();
    return this.rules.map((rule) => ({ ...rule }));
  }

  async saveRule(input: RuleInput): Promise<Result<void>> {
    await this.ensureLoaded();
    const idx = this.rules.findIndex((r) => r.pattern === input.pattern);
    const nextRules = [...this.rules];
    if (idx !== -1) {
      nextRules[idx] = { ...nextRules[idx], ...input };
    } else {
      nextRules.push({ id: crypto.randomUUID(), ...input });
    }

    const result = await this.persist(nextRules);
    if (result.ok) {
      this.rules = nextRules;
    }
    return result;
  }

  async deleteRule(pattern: string): Promise<Result<void>> {
    await this.ensureLoaded();
    const nextRules = this.rules.filter((r) => r.pattern !== pattern);
    const result = await this.persist(nextRules);
    if (result.ok) {
      this.rules = nextRules;
    }
    return result;
  }

  private async persist(rules: Rule[]): Promise<Result<void>> {
    const filePath = DataFolderConfig.getInstance().configFilePath('rules.json');
    return atomicWrite(filePath, JSON.stringify(rules, null, 2));
  }
}
