import { useEffect, useState } from 'react';
import type { Rule } from '../../../shared/types';
import { useI18n } from '../../hooks/useI18n';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { webviewRPC } from '../../ipc/bridge';

interface RuleManagementDialogProps {
  open: boolean;
  onClose: () => void;
}

export function RuleManagementDialog({ open, onClose }: RuleManagementDialogProps) {
  const t = useI18n();
  const [rules, setRules] = useState<Rule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPendingDeleteId(null);
      setError(null);
      return;
    }

    void (async () => {
      setIsLoading(true);
      setError(null);
      const result = await webviewRPC.request.GET_RULES(undefined);
      setIsLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setRules(result.rules);
    })();
  }, [open]);

  async function handleDelete(ruleId: string) {
    setError(null);
    const result = await webviewRPC.request.DELETE_RULE({ id: ruleId });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setRules((currentRules) => currentRules.filter((rule) => rule.id !== ruleId));
    setPendingDeleteId(null);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('rules.management.title')}</DialogTitle>
          <DialogDescription>
            {t('rules.management.learnedFromCorrections')}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('rules.management.loading')}</p>
        ) : rules.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-4 text-center">
            <p className="text-sm font-medium">{t('rules.management.empty')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('rules.management.emptyHint')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rules.map((rule) => {
              const isDeleting = pendingDeleteId === rule.id;

              return (
                <li
                  key={rule.id}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{rule.matchType}</Badge>
                        <span className="text-sm font-medium text-foreground">{rule.pattern}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t('rules.management.targetCategory')}: {rule.category}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setPendingDeleteId(rule.id)}
                    >
                      {t('rules.delete.label')}
                    </Button>
                  </div>

                  {isDeleting ? (
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                      <p className="text-xs text-muted-foreground">
                        {t('rules.delete.confirm')}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingDeleteId(null)}
                        >
                          {t('rules.inlinePicker.cancel')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => void handleDelete(rule.id)}
                        >
                          {t('rules.delete.label')}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}