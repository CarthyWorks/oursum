// src/renderer/hooks/useCategoryDisplayName.ts
// Returns a resolver that maps a stored category name to a localised display label.
// Built-in categories are translated via their id; user-defined categories fall back
// to the stored name unchanged.
import { useI18n } from './useI18n';
import { useReportStore } from '../store/report-store';

/** Returns a stable `displayName(storedName) → string` function.
 *
 *  - Built-in categories:  looks up `category.{id}` in the active locale dictionary.
 *  - User-defined categories: returns the stored name as-is (no translation key exists).
 *
 *  @example
 *  const displayName = useCategoryDisplayName();
 *  displayName('Groceries') // → 'Alimentari'  (when locale is 'it')
 *  displayName('My custom') // → 'My custom'   (user-defined, no key)
 */
export function useCategoryDisplayName(): (categoryName: string) => string {
  const t = useI18n();
  const allCategories = useReportStore((s) => s.allCategories);

  return (categoryName: string): string => {
    const category = allCategories.find((c) => c.name === categoryName);
    if (!category) return categoryName;
    const key = `category.${category.id}`;
    const translated = t(key);
    // useI18n returns the key itself when no translation is found — treat that as a miss
    return translated !== key ? translated : categoryName;
  };
}
