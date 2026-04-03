// src/renderer/components/app/BulkReassignPopover.tsx
// Pure category picker popover for bulk reassignment.
// Does NOT reuse InlineCategoryPicker — that has single-row/rule-creation semantics.
// Uses PopoverAnchor (headless) so open state is controlled externally without a visible trigger.
import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useCategoryDisplayName } from '../../hooks/useCategoryDisplayName';
import { useReportStore } from '../../store/report-store';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';

interface BulkReassignPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (category: string) => void;
  isSubmitting: boolean;
}

export function BulkReassignPopover({
  open,
  onOpenChange,
  onSelect,
  isSubmitting,
}: BulkReassignPopoverProps) {
  const t = useI18n();
  const allCategories = useReportStore((s) => s.allCategories);
  const displayName = useCategoryDisplayName();

  const sortedCategories = useMemo(
    () => [...allCategories].sort((a, b) => displayName(a.name).localeCompare(displayName(b.name))),
    [allCategories, displayName],
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {/* Invisible anchor at bottom-center of viewport — near the floating bar */}
      <PopoverAnchor asChild>
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-0 h-0 pointer-events-none" />
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="center"
        className="w-[280px] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter>
          <CommandInput
            placeholder={t('bulk.reassign.search')}
            disabled={isSubmitting}
          />
          <CommandList>
            <CommandEmpty>{t('rules.inlinePicker.empty')}</CommandEmpty>
            <CommandGroup>
              {sortedCategories.map((cat) => (
                <CommandItem
                  key={cat.name}
                  value={displayName(cat.name)}
                  disabled={isSubmitting}
                  onSelect={() => {
                    onSelect(cat.name);
                    onOpenChange(false);
                  }}
                >
                  <Check className="h-4 w-4 opacity-0" aria-hidden="true" />
                  <span>{displayName(cat.name)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
