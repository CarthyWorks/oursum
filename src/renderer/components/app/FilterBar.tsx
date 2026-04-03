import { AmountRangeFilter } from './AmountRangeFilter';
import { CategoryFilterDropdown } from './CategoryFilterDropdown';
import { FilterChips } from './FilterChips';

export function FilterBar() {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      <CategoryFilterDropdown />
      <AmountRangeFilter />
      <FilterChips />
    </div>
  );
}