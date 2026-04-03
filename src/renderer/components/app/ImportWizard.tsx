// src/renderer/components/app/ImportWizard.tsx
// Full-screen overlay wizard for file ingestion: loading, error, low-confidence, and ready states.
// RULE: Pure display component — no IPC calls, no side effects except selectedOffset state.
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { useI18n } from '../../hooks/useI18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { ImportProfile, IngestResult } from '../../../shared/types';

export type WizardState =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'no-table' }
  | { type: 'low-confidence'; ingestResult: IngestResult; selectedOffset: number }
  | { type: 'exact-match'; profile: ImportProfile; ingestResult: IngestResult }
  | { type: 'partial-match'; profile: ImportProfile; ingestResult: IngestResult }
  | { type: 'no-match'; ingestResult: IngestResult };

export type ColumnRoleMapping = {
  dateColumn: string | null;
  descriptionColumn: string | null;
  amountMode: 'single' | 'split';
  amountColumn: string | null;
  debitColumn: string | null;
  creditColumn: string | null;
};

interface ImportWizardProps {
  state: WizardState;
  filePath: string | null;
  onForceOffset: (offset: number) => void;
  onClose: () => void;
  onProfileSaved: (
    mapping: ColumnRoleMapping,
    profileName: string,
    ingestResult: IngestResult,
    prefillProfile?: ImportProfile
  ) => Promise<string | null>;
  onImport: (profile: ImportProfile, ingestResult: IngestResult) => Promise<string | null>;
}

const REQUIRED_MAPPING_ROLES = ['date', 'description', 'amount'] as const;

function titleCaseRole(role: (typeof REQUIRED_MAPPING_ROLES)[number]): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function findMappedColumn(profile: ImportProfile, role: (typeof REQUIRED_MAPPING_ROLES)[number]): string | null {
  for (const [columnName, targetField] of Object.entries(profile.columnMap)) {
    if (targetField === role) {
      return columnName;
    }
  }

  return null;
}

function MappingPreview({ profile }: { profile?: ImportProfile }) {
  const t = useI18n();

  return (
    <div className="rounded-md border overflow-hidden">
      <div className="grid grid-cols-2 bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{t('import.mapping.role')}</span>
        <span>{t('import.mapping.column')}</span>
      </div>
      {REQUIRED_MAPPING_ROLES.map((role) => {
        const mappedColumn = profile ? findMappedColumn(profile, role) : null;

        return (
          <div key={role} className="grid grid-cols-2 border-t px-3 py-2 text-sm">
            <span className="font-medium">{titleCaseRole(role)}</span>
            <span className={mappedColumn ? 'text-foreground' : 'text-muted-foreground'}>
              {mappedColumn ?? t('import.mapping.unassigned')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LoadingContent() {
  const t = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"
        role="status"
        aria-label="loading"
      />
      <p className="text-sm text-muted-foreground">{t('import.ingesting')}</p>
    </div>
  );
}

function ErrorContent({ message, onClose }: { message: string; onClose: () => void }) {
  const t = useI18n();
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <span className="text-4xl" role="img" aria-label="error">⚠️</span>
      <p className="text-sm text-destructive">{t(message)}</p>
      <Button onClick={onClose}>{t('import.tryAgain')}</Button>
    </div>
  );
}

function NoTableContent({ onClose }: { onClose: () => void }) {
  const t = useI18n();
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <span className="text-4xl" role="img" aria-label="no table">📋</span>
      <div className="space-y-2">
        <p className="font-medium">{t('import.error.noTable')}</p>
        <p className="text-sm text-muted-foreground">{t('import.error.noTableHint')}</p>
      </div>
      <Button onClick={onClose}>{t('import.tryAgain')}</Button>
    </div>
  );
}

function LowConfidenceContent({
  ingestResult,
  initialOffset,
  onForceOffset,
}: {
  ingestResult: IngestResult;
  initialOffset: number;
  onForceOffset: (offset: number) => void;
}) {
  const t = useI18n();
  const [selectedOffset, setSelectedOffset] = useState(initialOffset);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{t('import.header.question')}</p>
      <div className="max-h-64 overflow-y-auto border rounded-md">
        <table className="w-full text-xs" role="grid">
          <tbody>
            {ingestResult.scannedRows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  'cursor-pointer hover:bg-muted/50',
                  i === selectedOffset ? 'bg-accent text-accent-foreground' : ''
                )}
                onClick={() => setSelectedOffset(i)}
                aria-selected={i === selectedOffset}
              >
                <td className="px-2 py-0.5 text-muted-foreground select-none w-8">{i}</td>
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-0.5 truncate max-w-[120px]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => onForceOffset(selectedOffset)}>
          {t('import.header.confirm')}
        </Button>
      </div>
    </div>
  );
}

function MatchSummary({ rowCount }: { rowCount: number }) {
  const t = useI18n();

  return (
    <div className="flex gap-6 text-sm">
      <span>
        <span className="font-medium">{rowCount}</span>{' '}
        {t('import.match.rowsReady')}
      </span>
    </div>
  );
}

function ExactMatchContent({
  profile,
  ingestResult,
  onClose,
  onImport,
}: {
  profile: ImportProfile;
  ingestResult: IngestResult;
  onClose: () => void;
  onImport: (profile: ImportProfile, ingestResult: IngestResult) => Promise<string | null>;
}) {
  const t = useI18n();
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const rowCount = ingestResult.rows.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('import.match.exact.title')}</p>
        <p className="text-sm text-muted-foreground">
          {t('import.match.exact.bodyStart')} <span className="font-medium">{profile.name}</span>
          {t('import.match.exact.bodyMiddle')} <span className="font-medium">{rowCount}</span>
          {t('import.match.exact.bodyEnd')}
        </p>
      </div>

      <MatchSummary rowCount={rowCount} />

      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        {t('import.match.exact.note')}
      </div>

      {importError && <p className="text-sm text-destructive">{t(importError)}</p>}

      <div className="flex justify-end items-center gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('import.close')}
        </Button>
        <Button
          disabled={isImporting}
          onClick={async () => {
            setIsImporting(true);
            setImportError(null);
            const errorKey = await onImport(profile, ingestResult);
            setIsImporting(false);
            if (errorKey) {
              setImportError(errorKey);
            }
          }}
        >
          {isImporting ? '…' : t('import.match.exact.import')}
        </Button>
      </div>
    </div>
  );
}

function PartialMatchContent({ profile, ingestResult, onClose, onContinue }: { profile: ImportProfile; ingestResult: IngestResult; onClose: () => void; onContinue: () => void }) {
  const t = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('import.match.partial.title')}</p>
        <p className="text-sm text-muted-foreground">
          {t('import.match.partial.bodyStart')} <span className="font-medium">{profile.name}</span>
          {t('import.match.partial.bodyEnd')}
        </p>
      </div>

      <MatchSummary rowCount={ingestResult.rows.length} />

      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        <p className="font-medium">{t('import.match.partial.prefilled')}</p>
        <p className="mt-1 text-muted-foreground">{t('import.match.partial.changedColumns')}</p>
      </div>

      <div className="rounded-md border p-3 text-sm space-y-3">
        <div>
          <p className="font-medium">{t('import.match.profileSummary')}</p>
          <p className="mt-1 text-muted-foreground">{profile.bankName}</p>
        </div>
        <MappingPreview profile={profile} />
      </div>

      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={onClose}>
          {t('import.close')}
        </Button>
        <Button onClick={onContinue}>{t('import.match.partial.continue')}</Button>
      </div>
    </div>
  );
}

function NoMatchContent({ ingestResult, onClose, onContinue }: { ingestResult: IngestResult; onClose: () => void; onContinue: () => void }) {
  const t = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('import.match.none.title')}</p>
        <p className="text-sm text-muted-foreground">{t('import.match.none.body')}</p>
      </div>

      <MatchSummary rowCount={ingestResult.rows.length} />

      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        {t('import.match.none.blankMappings')}
      </div>

      <MappingPreview />

      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={onClose}>
          {t('import.close')}
        </Button>
        <Button onClick={onContinue}>{t('import.ready.continue')}</Button>
      </div>
    </div>
  );
}

// Utility used within this file
function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

function buildColumnOptions(headerRow: string[], currentValue: string | null): string[] {
  if (!currentValue || headerRow.includes(currentValue)) {
    return headerRow;
  }

  return [currentValue, ...headerRow];
}

function isMappedToKnownColumn(headerRow: string[], columnName: string | null): boolean {
  return !!columnName && headerRow.includes(columnName);
}

function ColumnMappingContent({
  ingestResult,
  initialMapping,
  onNext,
  onBack,
}: {
  ingestResult: IngestResult;
  initialMapping?: ColumnRoleMapping;
  onNext: (mapping: ColumnRoleMapping) => void;
  onBack: () => void;
}) {
  const t = useI18n();
  const [dateColumn, setDateColumn] = useState<string | null>(initialMapping?.dateColumn ?? null);
  const [descriptionColumn, setDescriptionColumn] = useState<string | null>(initialMapping?.descriptionColumn ?? null);
  const [amountMode, setAmountMode] = useState<'single' | 'split'>(initialMapping?.amountMode ?? 'single');
  const [amountColumn, setAmountColumn] = useState<string | null>(initialMapping?.amountColumn ?? null);
  const [debitColumn, setDebitColumn] = useState<string | null>(initialMapping?.debitColumn ?? null);
  const [creditColumn, setCreditColumn] = useState<string | null>(initialMapping?.creditColumn ?? null);

  const isComplete =
    isMappedToKnownColumn(ingestResult.headerRow, dateColumn) &&
    isMappedToKnownColumn(ingestResult.headerRow, descriptionColumn) &&
    (amountMode === 'single'
      ? isMappedToKnownColumn(ingestResult.headerRow, amountColumn)
      : isMappedToKnownColumn(ingestResult.headerRow, debitColumn) &&
        isMappedToKnownColumn(ingestResult.headerRow, creditColumn));

  const sampleRows = ingestResult.rows.slice(0, 8);
  const colIndex = Object.fromEntries(ingestResult.headerRow.map((name, i) => [name, i] as [string, number]));

  function getCellValue(row: string[], col: string | null): string {
    if (!col) return '';
    const idx = colIndex[col];
    return idx !== undefined ? (row[idx] ?? '') : '';
  }

  function getMergedAmount(row: string[]): string {
    if (amountMode === 'single') return getCellValue(row, amountColumn);
    const rawDebit = getCellValue(row, debitColumn);
    const rawCredit = getCellValue(row, creditColumn);

    const parseMaybeAmount = (raw: string): number | null => {
      const trimmed = raw.trim();
      if (trimmed === '') return 0;
      const parsed = parseFloat(trimmed.replace(',', '.'));
      return Number.isNaN(parsed) ? null : parsed;
    };

    const debitVal = parseMaybeAmount(rawDebit);
    const creditVal = parseMaybeAmount(rawCredit);

    if (debitVal === null || creditVal === null) {
      return rawDebit && rawCredit ? `${rawDebit} / ${rawCredit}` : rawDebit || rawCredit;
    }
    return (creditVal - debitVal).toFixed(2);
  }

  const dateOptions = buildColumnOptions(ingestResult.headerRow, dateColumn);
  const descriptionOptions = buildColumnOptions(ingestResult.headerRow, descriptionColumn);
  const amountOptions = buildColumnOptions(ingestResult.headerRow, amountColumn);
  const debitOptions = buildColumnOptions(ingestResult.headerRow, debitColumn);
  const creditOptions = buildColumnOptions(ingestResult.headerRow, creditColumn);

  const handleAmountModeChange = (mode: 'single' | 'split') => {
    setAmountMode(mode);
    setAmountColumn(null);
    setDebitColumn(null);
    setCreditColumn(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('import.mapping.description')}</p>

      <div className="grid grid-cols-1 gap-3">
        {/* Date column */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{t('import.mapping.date.label')}</label>
          <Select
            value={dateColumn ?? '__UNASSIGNED__'}
            onValueChange={(val) => setDateColumn(val === '__UNASSIGNED__' ? null : val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('import.mapping.date.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__UNASSIGNED__">{t('import.mapping.date.placeholder')}</SelectItem>
              {dateOptions.map(colName => (
                <SelectItem key={colName} value={colName}>{colName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description column */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{t('import.mapping.description.label')}</label>
          <Select
            value={descriptionColumn ?? '__UNASSIGNED__'}
            onValueChange={(val) => setDescriptionColumn(val === '__UNASSIGNED__' ? null : val)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('import.mapping.descriptionColumn.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__UNASSIGNED__">{t('import.mapping.descriptionColumn.placeholder')}</SelectItem>
              {descriptionOptions.map(colName => (
                <SelectItem key={colName} value={colName}>{colName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount mode radio */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">{t('import.mapping.amountMode.label')}</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="amountMode"
                value="single"
                checked={amountMode === 'single'}
                onChange={() => handleAmountModeChange('single')}
              />
              {t('import.mapping.amountMode.single')}
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="amountMode"
                value="split"
                checked={amountMode === 'split'}
                onChange={() => handleAmountModeChange('split')}
              />
              {t('import.mapping.amountMode.split')}
            </label>
          </div>
        </div>

        {/* Amount / Debit+Credit columns */}
        {amountMode === 'single' ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t('import.mapping.amount.label')}</label>
            <Select
              value={amountColumn ?? '__UNASSIGNED__'}
              onValueChange={(val) => setAmountColumn(val === '__UNASSIGNED__' ? null : val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('import.mapping.amount.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__UNASSIGNED__">{t('import.mapping.amount.placeholder')}</SelectItem>
                {amountOptions.map(colName => (
                  <SelectItem key={colName} value={colName}>{colName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t('import.mapping.debit.label')}</label>
              <Select
                value={debitColumn ?? '__UNASSIGNED__'}
                onValueChange={(val) => setDebitColumn(val === '__UNASSIGNED__' ? null : val)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('import.mapping.debit.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__UNASSIGNED__">{t('import.mapping.debit.placeholder')}</SelectItem>
                  {debitOptions.map(colName => (
                    <SelectItem key={colName} value={colName}>{colName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t('import.mapping.credit.label')}</label>
              <Select
                value={creditColumn ?? '__UNASSIGNED__'}
                onValueChange={(val) => setCreditColumn(val === '__UNASSIGNED__' ? null : val)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('import.mapping.credit.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__UNASSIGNED__">{t('import.mapping.credit.placeholder')}</SelectItem>
                  {creditOptions.map(colName => (
                    <SelectItem key={colName} value={colName}>{colName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {/* Preview table */}
      <div>
        <p className="text-sm font-medium mb-2">{t('import.preview.title')}</p>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted">
                {ingestResult.headerRow.map((columnName) => (
                  <th
                    key={columnName}
                    className="px-3 py-2 text-left font-medium text-muted-foreground truncate max-w-[120px]"
                  >
                    {columnName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleRows.map((row, i) => (
                <tr key={`raw-${i}`} className="border-t">
                  {ingestResult.headerRow.map((columnName) => (
                    <td key={`${i}-${columnName}`} className="px-3 py-1.5 truncate max-w-[120px]">
                      {getCellValue(row, columnName)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground truncate max-w-[120px]">
                  {dateColumn ?? t('import.preview.unassigned')}
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground truncate max-w-[120px]">
                  {descriptionColumn ?? t('import.preview.unassigned')}
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground truncate max-w-[120px]">
                  {amountMode === 'single'
                    ? (amountColumn ?? t('import.preview.unassigned'))
                    : (debitColumn && creditColumn ? `${debitColumn} / ${creditColumn}` : t('import.preview.unassigned'))}
                </th>
              </tr>
            </thead>
            <tbody>
              {sampleRows.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-1.5 truncate max-w-[120px]">{getCellValue(row, dateColumn)}</td>
                  <td className="px-3 py-1.5 truncate max-w-[120px]">{getCellValue(row, descriptionColumn)}</td>
                  <td
                    className="px-3 py-1.5 text-right truncate max-w-[120px]"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {getMergedAmount(row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!isComplete && (
        <p className="text-xs text-muted-foreground">{t('import.mapping.incomplete')}</p>
      )}

      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={onBack}>
          {t('import.mapping.back')}
        </Button>
        <Button
          disabled={!isComplete}
          onClick={() => {
            if (isComplete) {
              onNext({ dateColumn: dateColumn!, descriptionColumn: descriptionColumn!, amountMode, amountColumn, debitColumn, creditColumn });
            }
          }}
        >
          {t('import.mapping.next')}
        </Button>
      </div>
    </div>
  );
}

function deriveProfileName(filePath: string | null): string {
  if (!filePath) return '';
  const filename = filePath.replace(/.*[/\\]/, '');
  return filename.replace(/\.[^.]+$/, '');
}

function ProfileNamingContent({
  filePath,
  prefillProfile,
  mapping,
  ingestResult,
  onSave,
  onBack,
}: {
  filePath: string | null;
  prefillProfile?: ImportProfile;
  mapping: ColumnRoleMapping;
  ingestResult: IngestResult;
  onSave: (mapping: ColumnRoleMapping, profileName: string, ingestResult: IngestResult, prefillProfile?: ImportProfile) => Promise<string | null>;
  onBack: () => void;
}) {
  const t = useI18n();
  const defaultName = prefillProfile?.name ?? deriveProfileName(filePath);
  const [profileName, setProfileName] = useState(defaultName);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    const errorKey = await onSave(mapping, profileName.trim(), ingestResult, prefillProfile);
    if (errorKey) {
      setSaveError(errorKey);
    }
    setIsSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('import.profileName.description')}</p>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="profile-name-input">
          {t('import.profileName.label')}
        </label>
        <input
          id="profile-name-input"
          type="text"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          placeholder={t('import.profileName.placeholder')}
          aria-label={t('import.profileName.label')}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <p className="text-xs text-muted-foreground">{t('import.profileName.hint')}</p>
      {saveError && <p className="text-sm text-destructive">{t(saveError)}</p>}

      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={onBack} disabled={isSaving}>
          {t('import.profileName.back')}
        </Button>
        <Button
          disabled={profileName.trim() === '' || isSaving}
          onClick={() => void handleSave()}
        >
          {t('import.profileName.cta')}
        </Button>
      </div>
    </div>
  );
}

function extractMappingFromProfile(profile: ImportProfile): ColumnRoleMapping {
  let dateColumn: string | null = null;
  let descriptionColumn: string | null = null;
  let amountColumn: string | null = null;
  let debitColumn: string | null = null;
  let creditColumn: string | null = null;

  for (const [colName, role] of Object.entries(profile.columnMap)) {
    if (role === 'date') dateColumn = colName;
    else if (role === 'description') descriptionColumn = colName;
    else if (role === 'amount') amountColumn = colName;
    else if (role === 'debit') debitColumn = colName;
    else if (role === 'credit') creditColumn = colName;
  }

  const amountMode = (debitColumn || creditColumn) ? 'split' : 'single';
  return { dateColumn, descriptionColumn, amountMode, amountColumn, debitColumn, creditColumn };
}

type InternalStep =
  | { step: 'summary' }
  | { step: 'column-mapping'; initialMapping?: ColumnRoleMapping }
  | { step: 'profile-naming'; mapping: ColumnRoleMapping };

export function ImportWizard({ state, filePath, onForceOffset, onClose, onProfileSaved, onImport }: ImportWizardProps) {
  const t = useI18n();
  const [internalStep, setInternalStep] = useState<InternalStep>({ step: 'summary' });

  useEffect(() => {
    setInternalStep({ step: 'summary' });
  }, [state]);

  const titleMap: Record<WizardState['type'], string> = {
    loading: t('import.ingesting'),
    error: t('import.error.readFailed'),
    'no-table': t('import.error.noTable'),
    'low-confidence': t('import.header.question'),
    'exact-match': t('import.match.exact.title'),
    'partial-match': t('import.match.partial.title'),
    'no-match': t('import.match.none.title'),
  };

  const displayTitle =
    internalStep.step === 'column-mapping' ? t('import.mapping.heading') :
    internalStep.step === 'profile-naming' ? t('import.profileName.heading') :
    titleMap[state.type];

  const fileName = filePath ? filePath.replace(/.*[/\\]/, '') : null;

  const ingestResult = (state.type === 'partial-match' || state.type === 'no-match')
    ? state.ingestResult
    : null;

  return (
    <Dialog open modal={false} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl w-full max-h-[80vh] overflow-y-auto"
        onInteractOutside={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{displayTitle}</DialogTitle>
          {fileName && (
            <p className="text-xs text-muted-foreground truncate">{fileName}</p>
          )}
        </DialogHeader>

        {state.type === 'loading' && <LoadingContent />}
        {state.type === 'error' && (
          <ErrorContent message={state.message} onClose={onClose} />
        )}
        {state.type === 'no-table' && <NoTableContent onClose={onClose} />}
        {state.type === 'low-confidence' && (
          <LowConfidenceContent
            ingestResult={state.ingestResult}
            initialOffset={state.selectedOffset}
            onForceOffset={onForceOffset}
          />
        )}
        {state.type === 'exact-match' && (
          <ExactMatchContent
            profile={state.profile}
            ingestResult={state.ingestResult}
            onClose={onClose}
            onImport={onImport}
          />
        )}
        {state.type === 'partial-match' && internalStep.step === 'summary' && (
          <PartialMatchContent
            profile={state.profile}
            ingestResult={state.ingestResult}
            onClose={onClose}
            onContinue={() => {
              const prefill = extractMappingFromProfile(state.profile);
              setInternalStep({ step: 'column-mapping', initialMapping: prefill });
            }}
          />
        )}
        {state.type === 'no-match' && internalStep.step === 'summary' && (
          <NoMatchContent
            ingestResult={state.ingestResult}
            onClose={onClose}
            onContinue={() => setInternalStep({ step: 'column-mapping' })}
          />
        )}
        {ingestResult && internalStep.step === 'column-mapping' && (
          <ColumnMappingContent
            ingestResult={ingestResult}
            initialMapping={internalStep.initialMapping}
            onNext={(mapping) => setInternalStep({ step: 'profile-naming', mapping })}
            onBack={() => setInternalStep({ step: 'summary' })}
          />
        )}
        {ingestResult && internalStep.step === 'profile-naming' && (
          <ProfileNamingContent
            filePath={filePath}
            prefillProfile={state.type === 'partial-match' ? state.profile : undefined}
            mapping={internalStep.mapping}
            ingestResult={ingestResult}
            onSave={onProfileSaved}
            onBack={() => setInternalStep(prev =>
              prev.step === 'profile-naming'
                ? { step: 'column-mapping', initialMapping: prev.mapping }
                : { step: 'summary' }
            )}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
