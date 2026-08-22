import { Button } from '@/components/ui/Button';
import { ListboxControl } from '@/components/ui/Listbox';
import { paginationConfig } from '@/config';
import { strings } from '@/lib/i18n';
import type { PageMeta } from '@/lib/query';

export type PaginationProps = {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  disabled?: boolean;
};

export function Pagination({ meta, onPageChange, onPageSizeChange, disabled = false }: PaginationProps) {
  if (meta.total === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
      <p className="text-sm text-slate-500 dark:text-slate-400">{strings.pagination.showing(meta.from, meta.to, meta.total)}</p>

      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange && (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span id="pagination-page-size-label">{strings.common.perPage}</span>
            <ListboxControl
              className="w-24"
              labelledBy="pagination-page-size-label"
              value={String(meta.pageSize)}
              disabled={disabled}
              onChange={(next) => onPageSizeChange(Number(next))}
              buttonClassName="!min-h-[2.25rem] !rounded-xl !px-3 !py-1.5 text-sm"
              options={paginationConfig.pageSizeOptions.map((size) => ({
                value: String(size),
                label: String(size)
              }))}
            />
          </div>
        )}

        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || !meta.hasPrevious}
          onClick={() => onPageChange(meta.page - 1)}
        >
          {strings.pagination.previous}
        </Button>

        <span className="px-1 text-sm text-slate-600 dark:text-slate-400">
          {strings.pagination.page} {meta.page} {strings.common.of} {meta.totalPages}
        </span>

        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || !meta.hasNext}
          onClick={() => onPageChange(meta.page + 1)}
        >
          {strings.pagination.next}
        </Button>
      </div>
    </div>
  );
}

export default Pagination;
