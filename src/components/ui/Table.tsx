import type { ReactNode } from 'react';
import { EmptyState, SkeletonRows } from '@/components/ui/Feedback';
import { strings } from '@/lib/i18n';

export type Column<T> = {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  render: (row: T) => ReactNode;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  footer?: ReactNode;
  renderCard?: (row: T) => ReactNode;
};

const ALIGN_CLASSES = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyTitle = strings.emptyState.noResults,
  emptyDescription = strings.emptyState.noResultsHint,
  footer,
  renderCard
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div role="status" aria-busy="true" aria-label={strings.common.loading}>
        <SkeletonRows rows={5} />
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <div className={`overflow-x-auto ${renderCard ? 'hidden md:block' : ''}`}>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`whitespace-nowrap px-3 py-2 ${ALIGN_CLASSES[column.align ?? 'left']}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 py-3 ${ALIGN_CLASSES[column.align ?? 'left']} ${column.className ?? ''}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>

      {renderCard && (
        <ul className="space-y-3 md:hidden">
          {rows.map((row) => (
            <li key={rowKey(row)}>{renderCard(row)}</li>
          ))}
        </ul>
      )}
    </>
  );
}

export default DataTable;
