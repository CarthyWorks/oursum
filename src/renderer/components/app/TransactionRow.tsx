// src/renderer/components/app/TransactionRow.tsx
// RULE: memo wrapping is mandatory (ADR-006).
// RULE: No IPC, no store reads, no business logic — pure display.
import { memo } from 'react';
import type { ReactNode } from 'react';
import type { Transaction } from '../../../shared/types';
import { useFormatAmount } from '../../hooks/useFormatAmount';
import { useFormatDate } from '../../hooks/useFormatDate';
import { Checkbox } from '../ui/checkbox';

interface TransactionRowProps {
  transaction: Transaction;
  categoryCell?: ReactNode;
  /** Pre-resolved localised display label for the category. Falls back to transaction.category. */
  categoryDisplayName?: string;
  isSelected: boolean;
  onCheckboxClick: (isShift: boolean) => void;
  // Context menu (Story 4.3)
  onContextMenu?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
}

export const TransactionRow = memo(function TransactionRow({
  transaction,
  categoryCell,
  categoryDisplayName,
  isSelected,
  onCheckboxClick,
  onContextMenu,
}: TransactionRowProps) {
  const formatAmount = useFormatAmount();
  const formatDate = useFormatDate();

  const amountClass =
    transaction.amount < 0
      ? 'text-destructive'                        // expense — uses CSS token
      : 'text-green-600 dark:text-green-400';     // income — no semantic token exists; use explicit value

  return (
    <tr
      className={`border-b border-border hover:bg-muted/50 transition-colors${isSelected ? ' bg-primary/10' : ''}`}
      onContextMenu={onContextMenu}
    >
      <td className="px-2 py-2 w-10 text-center" data-checkbox>
        <Checkbox
          data-checkbox
          checked={isSelected}
          onCheckedChange={() => undefined}
          onClick={(e) => {
            e.stopPropagation();
            onCheckboxClick(e.shiftKey);
          }}
          aria-label={`Select transaction: ${transaction.description}`}
        />
      </td>
      <td className="px-3 py-2 text-sm whitespace-nowrap text-foreground">
        {formatDate(transaction.date)}
      </td>
      <td className="max-w-0 overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 text-sm text-foreground">
        {transaction.description}
      </td>
      <td className="px-3 py-2 text-sm text-foreground whitespace-nowrap">
        {categoryCell ?? (categoryDisplayName ?? transaction.category)}
      </td>
      <td className={`px-3 py-2 text-sm text-right tabular-nums whitespace-nowrap overflow-hidden text-ellipsis ${amountClass}`}>
        {formatAmount(transaction.amount)}
      </td>
    </tr>
  );
});
