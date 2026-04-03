import type { Rule } from '../../shared/types';

export function matchesRuleDescription(
  description: string,
  rule: Pick<Rule, 'pattern' | 'matchType'>,
  regexCache: Map<string, RegExp | null> = new Map<string, RegExp | null>(),
): boolean {
  switch (rule.matchType) {
    case 'contains':
      return description.toLowerCase().includes(rule.pattern.toLowerCase());
    case 'startsWith':
      return description.toLowerCase().startsWith(rule.pattern.toLowerCase());
    case 'regex': {
      if (!regexCache.has(rule.pattern)) {
        try {
          regexCache.set(rule.pattern, new RegExp(rule.pattern, 'i'));
        } catch {
          regexCache.set(rule.pattern, null);
        }
      }

      return regexCache.get(rule.pattern)?.test(description) ?? false;
    }
  }
}