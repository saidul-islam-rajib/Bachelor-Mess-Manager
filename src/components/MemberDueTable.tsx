import { formatCurrency } from '@/lib/format';
import { strings } from '@/lib/i18n';

const taka = formatCurrency;

export type MemberDueRow = {
  id: string;
  name: string;
  isCurrentUser?: boolean;
  hasLeft?: boolean;
  payable: number;
  paid: number;
  net: number;
};

function DueRefund({ net }: { net: number }) {
  if (net > 0.005) {
    return (
      <span className="font-semibold tabular-nums text-teal-700 dark:text-teal-400">
        {taka(net)} <span className="text-xs font-normal">{strings.payments.refund}</span>
      </span>
    );
  }
  if (net < -0.005) {
    return <span className="font-semibold tabular-nums text-rose-600">{taka(-net)}</span>;
  }
  return <span className="font-semibold tabular-nums text-slate-400 dark:text-slate-500">{taka(0)}</span>;
}

export function MemberDueTable({ rows, payableLabel }: { rows: MemberDueRow[]; payableLabel: string }) {
  if (rows.length === 0) return null;

  const totalPayable = rows.reduce((sum, row) => sum + row.payable, 0);
  const totalPaid = rows.reduce((sum, row) => sum + row.paid, 0);
  const totalNet = rows.reduce((sum, row) => sum + row.net, 0);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <th className="py-2 pr-3">{strings.settlement.member}</th>
            <th className="py-2 pr-3 text-right">{payableLabel}</th>
            <th className="py-2 pr-3 text-right">{strings.settlement.totalPaid}</th>
            <th className="py-2 text-right">{strings.settlement.dueOrRefund}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
              <td className="py-2.5 pr-3 font-medium">
                {row.name}
                {row.isCurrentUser && <span className="ml-1 text-xs font-normal text-brand-600">{strings.common.you}</span>}
                {row.hasLeft && (
                  <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {strings.payments.left}
                  </span>
                )}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{taka(row.payable)}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-slate-600 dark:text-slate-400">{taka(row.paid)}</td>
              <td className="py-2.5 text-right">
                <DueRefund net={row.net} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 dark:border-slate-700 text-sm font-semibold">
            <td className="py-2.5 pr-3">{strings.settlement.groupTotal}</td>
            <td className="py-2.5 pr-3 text-right tabular-nums">{taka(totalPayable)}</td>
            <td className="py-2.5 pr-3 text-right tabular-nums">{taka(totalPaid)}</td>
            <td className="py-2.5 text-right">
              <DueRefund net={totalNet} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
