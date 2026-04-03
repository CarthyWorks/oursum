// src/renderer/App.tsx
// Three-phase state machine: loading → wizard (first launch) or home (returning user).
// RULE: No FS access here — all file operations go through IPC.
import { useCallback, useEffect, useRef, useState } from "react";
import { webviewRPC } from "./ipc/bridge";
import { LocaleProvider } from "./context/locale-context";
import { ThemeProvider } from "./context/theme-context";
import { LocaleWizardStep } from "./components/app/LocaleWizardStep";
import { ReportView, ReportViewSkipLink } from "./components/app/ReportView";
import { Toolbar } from "./components/app/Toolbar";
import { PostImportCard } from './components/app/PostImportCard';
import { ImportWizard, type WizardState, type ColumnRoleMapping } from './components/app/ImportWizard';
import { SupportedLanguage, type LocaleSettings } from '../core/i18n/types';
import type { ImportProfile, ImportSummary, IngestResult, Preferences, SplitCalculatorConfig } from '../shared/types';
import { useReportStore } from './store/report-store';
import { AddTransactionDialog } from './components/app/AddTransactionDialog';
import { SplitCalculatorPanel } from './components/app/SplitCalculatorPanel';
import { TooltipProvider } from './components/ui/tooltip';
import { useLoadTransactions } from './hooks/useLoadTransactions';
import { useFilteredTransactions, useFilteredStats } from './hooks/useFilteredTransactions';
import { makeDefaultContributors, type Contributor } from './hooks/useSplitCalculator';

async function computeRendererFingerprint(headerRow: string[]): Promise<string> {
  const normalized = [...headerRow].map(n => n.toLowerCase().trim()).sort().join('|');
  const encoded = new TextEncoder().encode(normalized);
  const buffer = await window.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Convert saved Preferences (5 fields) → LocaleSettings (4 fields, no theme). */
function prefsToLocale(prefs: Preferences): LocaleSettings {
  const language = Object.values(SupportedLanguage).includes(prefs.language as SupportedLanguage)
    ? (prefs.language as SupportedLanguage)
    : SupportedLanguage.EN;
  return {
    language,
    numberFormat: prefs.numberFormat,
    dateFormat: prefs.dateFormat,
    currencySymbol: prefs.currencySymbol,
  };
}

type Phase = 'loading' | 'wizard' | 'home';

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [detectedLocale, setDetectedLocale] = useState<LocaleSettings | null>(null);
  const [confirmedLocale, setConfirmedLocale] = useState<LocaleSettings | undefined>(undefined);
  const [platform, setPlatform] = useState<string>('darwin'); // default to macOS until IPC responds
  const [dataFolderPath, setDataFolderPath] = useState<string>('');
  const savedPrefsRef = useRef<Preferences | null>(null);

  const [wizardState, setWizardState] = useState<WizardState | null>(null);
  const [wizardFilePath, setWizardFilePath] = useState<string | null>(null);
  // Holds dropped file bytes (base64) for WKWebView drops where file.path is unavailable.
  // Retained so the low-confidence wizard can re-ingest with a forced header row offset.
  const [droppedFile, setDroppedFile] = useState<{ base64: string; filename: string } | null>(null);
  const [postImportSummary, setPostImportSummary] = useState<ImportSummary | null>(null);
  const [addTransactionOpen, setAddTransactionOpen] = useState(false);
  const [splitCalculatorOpen, setSplitCalculatorOpen] = useState(false);
  const [splitCalculatorTotal, setSplitCalculatorTotal] = useState<string | null>(null);
  // Session-scoped contributor state — lazy-loaded on first panel open, saved on every close
  const [splitCalculatorContributors, setSplitCalculatorContributors] = useState<Contributor[] | null>(null);
  const [splitCalculatorConfigWarning, setSplitCalculatorConfigWarning] = useState<string | null>(null);
  const [splitCalculatorConfigLoaded, setSplitCalculatorConfigLoaded] = useState(false);

  const resolveMatchState = useCallback(async (headerRow: string[], scannedRows: string[][], result: IngestResult): Promise<WizardState> => {
    const matchResponse = await webviewRPC.request.MATCH_IMPORT_PROFILE({ headerRow, scannedRows });

    if (!matchResponse.ok) {
      console.warn('[App] MATCH_IMPORT_PROFILE failed:', matchResponse.error);
      return { type: 'no-match', ingestResult: result };
    }

    const matchResult = matchResponse.result;

    if (matchResult.match === 'exact') {
      return { type: 'exact-match', profile: matchResult.profile, ingestResult: result };
    }

    if (matchResult.match === 'partial') {
      return { type: 'partial-match', profile: matchResult.profile, ingestResult: result };
    }

    return { type: 'no-match', ingestResult: result };
  }, []);

  const loadAllTransactions = useLoadTransactions();

  const filteredTransactions = useFilteredTransactions();
  const stats = useFilteredStats(filteredTransactions);

  const handleOpenSplitCalculator = useCallback(async () => {
    setSplitCalculatorTotal((currentTotal) => currentTotal ?? String(stats.totalExpenses));

    if (!splitCalculatorConfigLoaded) {
      try {
        const result = await webviewRPC.request.GET_SPLIT_CALCULATOR_CONFIG();
        if (result.ok) {
          setSplitCalculatorConfigWarning(null);
          setSplitCalculatorContributors(
            result.config !== null
              ? (result.config.contributors as Contributor[])
              : makeDefaultContributors()
          );
        } else {
          console.warn('[App] GET_SPLIT_CALCULATOR_CONFIG failed:', result.error);
          setSplitCalculatorContributors(makeDefaultContributors());
          setSplitCalculatorConfigWarning('split.config.invalidFallback');
        }
      } catch (e) {
        console.warn('[App] GET_SPLIT_CALCULATOR_CONFIG failed:', e);
        setSplitCalculatorContributors(makeDefaultContributors());
        setSplitCalculatorConfigWarning('split.config.invalidFallback');
      }
      setSplitCalculatorConfigLoaded(true);
    }

    setSplitCalculatorOpen(true);
  }, [stats.totalExpenses, splitCalculatorConfigLoaded]);

  const handleCloseSplitCalculator = useCallback(() => {
    setSplitCalculatorOpen(false);

    if (splitCalculatorConfigLoaded && splitCalculatorContributors !== null) {
      const config: SplitCalculatorConfig = { contributors: splitCalculatorContributors };
      void Promise.resolve(webviewRPC.request.SAVE_SPLIT_CALCULATOR_CONFIG({ config }))
        .then((result) => {
          if (!result.ok) {
            console.warn('[App] SAVE_SPLIT_CALCULATOR_CONFIG failed:', result.error);
            setSplitCalculatorConfigWarning('split.config.saveError');
            return;
          }

          setSplitCalculatorConfigWarning(null);
        })
        .catch((error: unknown) => {
          console.warn('[App] SAVE_SPLIT_CALCULATOR_CONFIG failed:', error);
          setSplitCalculatorConfigWarning('split.config.saveError');
        });
    }
  }, [splitCalculatorConfigLoaded, splitCalculatorContributors]);

  const loadAllCategories = useCallback(async () => {
    try {
      const result = await webviewRPC.request.GET_CATEGORIES();
      if (result.ok) {
        useReportStore.getState().setAllCategories(result.categories);
      } else {
        console.warn('[App] GET_CATEGORIES failed:', result.error);
      }
    } catch (e) {
      console.warn('[App] GET_CATEGORIES threw:', e);
    }
  }, []);

  // Fetch initial state from Bun and transition to appropriate phase
  useEffect(() => {
    void (async () => {
      try {
        // Race against a 5 s timeout so E2E / HMR-only mode falls back quickly
        const timeoutSignal = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GET_INITIAL_STATE timeout')), 5000)
        );
        const state = await Promise.race([
          webviewRPC.request.GET_INITIAL_STATE(),
          timeoutSignal,
        ]);
        setDetectedLocale(state.detectedLocale);
        savedPrefsRef.current = state.savedPreferences;
        setPlatform(state.platform);
        setDataFolderPath(state.dataFolderPath);

        if (state.firstLaunch) {
          setPhase('wizard');
        } else {
          setPhase('home');
          void Promise.all([loadAllTransactions(), loadAllCategories()]); // parallel startup load
        }
      } catch (e) {
        console.error('[App] GET_INITIAL_STATE failed, defaulting to home:', e);
        // Safe fallback — show the home screen; IPC unavailable (e.g. E2E / HMR-only mode)
        setPhase('home');
        void Promise.all([loadAllTransactions(), loadAllCategories()]); // best-effort; store starts empty if this fails too
      }
    })();
  }, [loadAllTransactions, loadAllCategories]);

  useEffect(() => {
    if (platform === 'darwin') {
      return;
    }

    const handleExitShortcut = (event: KeyboardEvent) => {
      const hasPrimaryModifier = event.metaKey || event.ctrlKey;
      if (!hasPrimaryModifier || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key !== 'q' && key !== 'w') {
        return;
      }

      event.preventDefault();

      if (key === 'q') {
        void Promise.resolve(webviewRPC.request.QUIT_APP(undefined)).catch((error: unknown) => {
          console.warn('[App] QUIT_APP failed:', error);
        });
        return;
      }

      void Promise.resolve(webviewRPC.request.CLOSE_WINDOW(undefined)).catch((error: unknown) => {
        console.warn('[App] CLOSE_WINDOW failed:', error);
      });
    };

    window.addEventListener('keydown', handleExitShortcut, true);
    return () => window.removeEventListener('keydown', handleExitShortcut, true);
  }, []);

  // Wire global drag-and-drop to IPC — runs in all phases
  const handleImportFile = useCallback(async (filePath: string, forcedOffset?: number) => {
    setDroppedFile(null);
    setWizardFilePath(filePath);
    setWizardState({ type: 'loading' });
    try {
      const response = await webviewRPC.request.INGEST_FILE({ filePath, forcedHeaderRowOffset: forcedOffset });
      if (!response.ok) {
        if (response.error === 'NO_TABLE_FOUND') {
          setWizardState({ type: 'no-table' });
        } else {
          const messageKey = response.error === 'CSV_PARSE_FAILED' || response.error === 'XLSX_PARSE_FAILED'
            ? 'import.error.parseError' : 'import.error.readFailed';
          setWizardState({ type: 'error', message: messageKey });
        }
        return;
      }
      const { result } = response;
      if (result.confidence === 'low') {
        setWizardState({ type: 'low-confidence', ingestResult: result, selectedOffset: result.headerRowOffset });
      } else {
        const nextState = await resolveMatchState(result.headerRow, result.scannedRows, result);
        setWizardState(nextState);
      }
    } catch {
      setWizardState({ type: 'error', message: 'import.error.readFailed' });
    }
  }, [resolveMatchState]);

  // Bytes-based ingest for WKWebView drag-and-drop (file.path unavailable).
  const handleImportFileBytes = useCallback(async (base64: string, filename: string, forcedOffset?: number) => {
    setDroppedFile({ base64, filename });
    setWizardFilePath(filename);
    setWizardState({ type: 'loading' });
    try {
      const response = await webviewRPC.request.INGEST_FILE_BYTES({ base64, filename, forcedHeaderRowOffset: forcedOffset });
      if (!response.ok) {
        if (response.error === 'NO_TABLE_FOUND') {
          setWizardState({ type: 'no-table' });
        } else {
          const messageKey = response.error === 'CSV_PARSE_FAILED' || response.error === 'XLSX_PARSE_FAILED'
            ? 'import.error.parseError' : 'import.error.readFailed';
          setWizardState({ type: 'error', message: messageKey });
        }
        return;
      }
      const { result } = response;
      if (result.confidence === 'low') {
        setWizardState({ type: 'low-confidence', ingestResult: result, selectedOffset: result.headerRowOffset });
      } else {
        const nextState = await resolveMatchState(result.headerRow, result.scannedRows, result);
        setWizardState(nextState);
      }
    } catch {
      setWizardState({ type: 'error', message: 'import.error.readFailed' });
    }
  }, [resolveMatchState]);

  const handleImport = useCallback(async (
    profile: ImportProfile,
    ingestResult: IngestResult,
  ): Promise<string | null> => {
    try {
      const filename = wizardFilePath ? wizardFilePath.split(/[/\\]/).pop() ?? 'unknown' : 'unknown';
      const response = await webviewRPC.request.EXECUTE_IMPORT({
        rows: ingestResult.rows,
        headerRow: ingestResult.headerRow,
        profile,
        originalFilename: filename,
      });
      if (!response.ok) {
        console.warn('[App] EXECUTE_IMPORT failed:', response.error);
        return 'import.error.executeFailed';
      }
      setWizardState(null);
      await loadAllTransactions(); // refresh dataset before summary is shown — AC 7
      setPostImportSummary(response.summary);
      return null;
    } catch (error) {
      console.warn('[App] EXECUTE_IMPORT threw unexpectedly:', error);
      return 'import.error.executeFailed';
    }
  }, [wizardFilePath, loadAllTransactions]);

  const handleUploadClick = useCallback(async () => {
    try {
      const response = await webviewRPC.request.OPEN_FILE_PICKER();
      if (response.path) {
        await handleImportFile(response.path);
      }
    } catch {
      setWizardState({ type: 'error', message: 'import.error.readFailed' });
    }
  }, [handleImportFile]);

  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;

      const file = files[0];
      const absolutePath = (file as File & { path?: string }).path;

      if (typeof absolutePath === 'string' && absolutePath.startsWith('/')) {
        // Electron-like env or e2e: file.path is an absolute filesystem path — use it directly.
        webviewRPC.send.FILE_DROPPED({ paths: [absolutePath] });
        void handleImportFile(absolutePath);
      } else {
        // WKWebView production: file.path is not exposed. Read the bytes in the renderer.
        webviewRPC.send.FILE_DROPPED({ paths: [file.name] });
        void (async () => {
          try {
            const buf = await file.arrayBuffer();
            const uint8 = new Uint8Array(buf);
            let binary = '';
            for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
            const base64 = btoa(binary);
            void handleImportFileBytes(base64, file.name);
          } catch {
            setWizardState({ type: 'error', message: 'import.error.readFailed' });
          }
        })();
      }
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleImportFile, handleImportFileBytes]);

  const handleProfileSaved = useCallback(async (
    mapping: ColumnRoleMapping,
    profileName: string,
    ingestResult: IngestResult,
    prefillProfile?: ImportProfile
  ): Promise<string | null> => {
    const fingerprint = await computeRendererFingerprint(ingestResult.headerRow);

    const columnMap: Record<string, string> = {
      [mapping.dateColumn!]: 'date',
      [mapping.descriptionColumn!]: 'description',
    };
    if (mapping.amountMode === 'single' && mapping.amountColumn) {
      columnMap[mapping.amountColumn] = 'amount';
    } else if (mapping.amountMode === 'split') {
      if (mapping.debitColumn) columnMap[mapping.debitColumn] = 'debit';
      if (mapping.creditColumn) columnMap[mapping.creditColumn] = 'credit';
    }

    const currentDateFormat =
      confirmedLocale?.dateFormat ??
      savedPrefsRef.current?.dateFormat ??
      'dd/mm/yyyy';

    const profile: ImportProfile = {
      id: prefillProfile?.id ?? crypto.randomUUID(),
      name: profileName.trim(),
      bankName: profileName.trim(),
      csvDelimiter: ingestResult.csvDelimiter ?? '',
      columnMap,
      dateFormat: currentDateFormat,
      amountMultiplier: 1,
      headerRowOffset: ingestResult.headerRowOffset,
      fingerprint,
    };

    try {
      const result = await webviewRPC.request.SAVE_PROFILE({ profile });
      if (!result.ok) {
        console.warn('[App] SAVE_PROFILE failed:', result.error);
        return 'import.profileName.saveFailed';
      }

      return handleImport(profile, ingestResult);
    } catch (error) {
      console.warn('[App] SAVE_PROFILE threw unexpectedly:', error);
      return 'import.profileName.saveFailed';
    }
  }, [confirmedLocale, handleImport]);

  const handleWizardConfirm = async (locale: LocaleSettings) => {
    const result = await webviewRPC.request.SAVE_PREFERENCES({ locale });
    if (!result.ok) {
      console.warn('[App] SAVE_PREFERENCES failed:', (result as { ok: false; error: string }).error);
    }
    // Populate savedPrefsRef synchronously (refs bypass React scheduling) so that initLocale
    // is always computed correctly when the home phase first renders, regardless of whether
    // setConfirmedLocale and setPhase land in the same React batch.
    savedPrefsRef.current = { ...locale, theme: 'mountain' };
    setConfirmedLocale(locale);
    setPhase('home');
    void Promise.all([loadAllTransactions(), loadAllCategories()]);
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <span className="text-muted-foreground text-lg">…</span>
      </div>
    );
  }

  if (phase === 'wizard') {
    return (
      <ThemeProvider key="wizard">
        <LocaleProvider>
          <LocaleWizardStep
            detectedLocale={detectedLocale ?? {
              language: SupportedLanguage.EN,
              numberFormat: '1,234.56',
              dateFormat: 'dd/mm/yyyy',
              currencySymbol: '€',
            }}
            onConfirm={handleWizardConfirm}
          />
        </LocaleProvider>
      </ThemeProvider>
    );
  }

  // phase === 'home'
  const initLocale = confirmedLocale ?? (
    savedPrefsRef.current ? prefsToLocale(savedPrefsRef.current) : undefined
  );

  return (
    <ThemeProvider key="home" initialTheme={savedPrefsRef.current?.theme ?? 'mountain'}>
      <LocaleProvider initialLocale={initLocale}>
        <TooltipProvider>
        <div className="flex flex-col h-screen overflow-hidden">
          <ReportViewSkipLink />
          <Toolbar
            platform={platform}
            dataFolderPath={dataFolderPath}
            onDataFolderRelocated={setDataFolderPath}
            onUploadClick={handleUploadClick}
            onAddTransaction={() => setAddTransactionOpen(true)}
            onSplitCalculatorClick={handleOpenSplitCalculator}
          />
          <ReportView
            onUploadClick={handleUploadClick}
            onAddTransaction={() => setAddTransactionOpen(true)}
          />
          {wizardState !== null && (
            <ImportWizard
              state={wizardState}
              filePath={wizardFilePath}
              onForceOffset={(offset) => {
                if (droppedFile) {
                  void handleImportFileBytes(droppedFile.base64, droppedFile.filename, offset);
                } else if (wizardFilePath) {
                  void handleImportFile(wizardFilePath, offset);
                }
              }}
              onClose={() => setWizardState(null)}
              onProfileSaved={handleProfileSaved}
              onImport={handleImport}
            />
          )}
          {postImportSummary !== null && (
            <PostImportCard
              summary={postImportSummary}
              onDismiss={() => setPostImportSummary(null)}
            />
          )}
          <AddTransactionDialog
            open={addTransactionOpen}
            onOpenChange={setAddTransactionOpen}
            onSuccess={loadAllTransactions}
          />
          <SplitCalculatorPanel
            open={splitCalculatorOpen}
            totalAmount={splitCalculatorTotal ?? ''}
            onTotalAmountChange={setSplitCalculatorTotal}
            onClose={handleCloseSplitCalculator}
            initialContributors={splitCalculatorContributors}
            onContributorsChange={setSplitCalculatorContributors}
            configWarning={splitCalculatorConfigWarning}
          />
        </div>
        </TooltipProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

