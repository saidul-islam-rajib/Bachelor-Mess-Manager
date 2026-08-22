import { usePwa } from '@/components/PwaProvider';
import { strings } from '@/lib/i18n';
import { appConfig } from '@/config';

export default function UpdateBanner() {
  const { updateReady, applyUpdate } = usePwa();

  if (!updateReady) return null;

  return (
    <div className="bg-green-600 text-white">
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <p className="font-medium">{strings.updateBanner.ready(appConfig.name)}</p>
        <button
          type="button"
          onClick={applyUpdate}
          className="rounded-full bg-white dark:bg-slate-800 px-4 py-1 text-xs font-semibold text-green-700 dark:text-green-400 hover:bg-green-50"
        >
          {strings.updateBanner.reloadNow}
        </button>
      </div>
    </div>
  );
}
