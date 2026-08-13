export const STATUS_STYLES: Record<string, { pill: string; label: string; dot: string }> = {
  PAID: { pill: 'bg-green-100 text-green-800', label: 'Paid', dot: 'bg-green-500' },
  PARTIAL: { pill: 'bg-amber-100 text-amber-800', label: 'Part paid', dot: 'bg-amber-500' },
  PENDING: { pill: 'bg-rose-100 text-rose-800', label: 'Due', dot: 'bg-rose-500' },
  ADVANCE: { pill: 'bg-teal-100 text-teal-800', label: 'Gets back', dot: 'bg-teal-500' }
};

export function statusOf(entry: { status: string; advance: number }) {
  if (entry.advance > 0) return STATUS_STYLES.ADVANCE;
  return STATUS_STYLES[entry.status] ?? STATUS_STYLES.PENDING;
}

export function StatusPill({ entry }: { entry: { status: string; advance: number } }) {
  const style = statusOf(entry);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}
