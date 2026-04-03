import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { Button } from '../ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

interface InlineCategoryPickerProps {
  open: boolean;
  currentCategory: string;
  categories: string[];
  /** Optional resolver from stored name → localised display label. Falls back to the raw name. */
  displayName?: (name: string) => string;
  error: string | null;
  isSubmitting: boolean;
  onConfirm: (nextCategory: string) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
}

export function InlineCategoryPicker({
  open,
  currentCategory,
  categories,
  displayName,
  error,
  isSubmitting,
  onConfirm,
  onOpenChange,
  trigger,
}: InlineCategoryPickerProps) {
  const t = useI18n();
  const [selectedCategory, setSelectedCategory] = useState(currentCategory);

  useEffect(() => {
    if (open) {
      setSelectedCategory(currentCategory);
    }
  }, [currentCategory, open]);

  const sortedCategories = useMemo(
    () => [...categories].sort((left, right) => (displayName?.(left) ?? left).localeCompare(displayName?.(right) ?? right)),
    [categories, displayName],
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0">
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-medium text-foreground">
            {t('rules.inlinePicker.title')}
          </p>
        </div>

        <Command shouldFilter>
          <CommandInput placeholder={t('rules.inlinePicker.searchPlaceholder')} />
          <CommandList>
            <CommandEmpty>{t('rules.inlinePicker.empty')}</CommandEmpty>
            <CommandGroup>
              {sortedCategories.map((category) => (
                <CommandItem
                  key={category}
                  value={displayName?.(category) ?? category}
                  onSelect={() => setSelectedCategory(category)}
                >
                  <Check
                    className={`h-4 w-4 ${selectedCategory === category ? 'opacity-100' : 'opacity-0'}`}
                    aria-hidden="true"
                  />
                  <span>{displayName?.(category) ?? category}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        <div className="border-t border-border px-3 py-2">
          {error ? (
            <p className="mb-2 text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('rules.inlinePicker.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void onConfirm(selectedCategory)}
              disabled={isSubmitting || selectedCategory === currentCategory}
            >
              {t('rules.inlinePicker.confirm')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}