// src/renderer/components/app/LocaleWizardStep.tsx
// RULE: No imports from src/core/persistence/ or src/main/ — renderer isolation boundary.
import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { SupportedLanguage, type LocaleSettings } from '../../../core/i18n/types';

interface LocaleWizardStepProps {
  detectedLocale: LocaleSettings;
  onConfirm: (locale: LocaleSettings) => void;
}

interface LocaleFieldProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function LocaleField({ label, value, onValueChange, options }: LocaleFieldProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-foreground w-40 shrink-0">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const LANGUAGE_OPTIONS = [
  { value: SupportedLanguage.EN, label: 'English' },
  { value: SupportedLanguage.IT, label: 'Italiano (Italian)' },
  { value: SupportedLanguage.DE, label: 'Deutsch (German)' },
  { value: SupportedLanguage.FR, label: 'Français (French)' },
  { value: SupportedLanguage.ES, label: 'Español (Spanish)' },
];

const NUMBER_FORMAT_OPTIONS = [
  { value: '1,234.56', label: '1,234.56 (English)' },
  { value: '1.234,56', label: '1.234,56 (Italian / German)' },
  { value: '1 234,56', label: '1 234,56 (French)' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'dd/mm/yyyy', label: 'DD/MM/YYYY' },
  { value: 'mm/dd/yyyy', label: 'MM/DD/YYYY' },
  { value: 'yyyy-mm-dd', label: 'YYYY-MM-DD' },
];

// Radix Select forbids empty string values — use sentinel, map back to '' on confirm
const CURRENCY_NONE = '__none__';

const CURRENCY_OPTIONS = [
  { value: '€', label: '€ (Euro)' },
  { value: '$', label: '$ (Dollar)' },
  { value: '£', label: '£ (Pound)' },
  { value: '¥', label: '¥ (Yen)' },
  { value: 'Fr', label: 'Fr (Swiss Franc)' },
  { value: CURRENCY_NONE, label: 'None (no symbol)' },
];

function toSelectCurrency(symbol: string): string {
  return symbol === '' ? CURRENCY_NONE : symbol;
}

function fromSelectCurrency(value: string): string {
  return value === CURRENCY_NONE ? '' : value;
}

export function LocaleWizardStep({ detectedLocale, onConfirm }: LocaleWizardStepProps) {
  const [locale, setLocale] = useState<LocaleSettings>({
    ...detectedLocale,
    currencySymbol: toSelectCurrency(detectedLocale.currencySymbol),
  });

  const handleConfirm = () => {
    onConfirm({
      ...locale,
      currencySymbol: fromSelectCurrency(locale.currencySymbol),
    });
  };

  return (
    // Use Radix primitives directly so we can build a non-dismissible dialog
    // (no default × close button, no outside-click dismiss, no Escape dismiss)
    <DialogPrimitive.Root open={true} modal={true}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 top-[var(--toolbar-height,0px)] z-50 bg-black/80 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border bg-background p-6 shadow-lg sm:rounded-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex flex-col space-y-1.5 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl" role="img" aria-label="globe">🌍</span>
              <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
                Set up your locale
              </DialogPrimitive.Title>
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Auto-detected
              </span>
            </div>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              We detected your OS settings — confirm or adjust before continuing.
            </DialogPrimitive.Description>
          </div>

          {/* Locale fields */}
          <div className="space-y-4 mb-6">
            <LocaleField
              label="Language"
              value={locale.language}
              onValueChange={(value) => setLocale((prev) => ({ ...prev, language: value as SupportedLanguage }))}
              options={LANGUAGE_OPTIONS}
            />
            <LocaleField
              label="Number format"
              value={locale.numberFormat}
              onValueChange={(value) => setLocale((prev) => ({ ...prev, numberFormat: value }))}
              options={NUMBER_FORMAT_OPTIONS}
            />
            <LocaleField
              label="Date format"
              value={locale.dateFormat}
              onValueChange={(value) => setLocale((prev) => ({ ...prev, dateFormat: value }))}
              options={DATE_FORMAT_OPTIONS}
            />
            <LocaleField
              label="Currency symbol"
              value={locale.currencySymbol}
              onValueChange={(value) => setLocale((prev) => ({ ...prev, currencySymbol: value }))}
              options={CURRENCY_OPTIONS}
            />
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-3">
            <Button className="w-full" onClick={handleConfirm}>
              Confirm &amp; continue →
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              You can change these later in Preferences (⚙)
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
