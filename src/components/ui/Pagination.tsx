import { Button } from '@/components/ui/Button';
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
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
      <p className="text-sm text-slate-500">{strings.pagination.showing(meta.from, meta.to, meta.total)}</p>

      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <span>{strings.common.perPage}</span>
            <select
              value={meta.pageSize}
              disabled={disabled}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="rounded-xl border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              {paginationConfig.pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || !meta.hasPrevious}
          onClick={() => onPageChange(meta.page - 1)}
        >
          {strings.pagination.previous}
        </Button>

        <span className="px-1 text-sm text-slate-600">
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
