import { usePwa } from '@/components/PwaProvider';

export default function UpdateBanner() {
  const { updateReady, applyUpdate } = usePwa();

  if (!updateReady) return null;

  return (
    <div className="bg-green-600 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <p className="font-medium">A new version of Bachelor Point is ready.</p>
        <button
          type="button"
          onClick={applyUpdate}
          className="rounded-full bg-white px-4 py-1 text-xs font-semibold text-green-700 hover:bg-green-50"
        >
          Reload now
        </button>
      </div>
    </div>
  );
}
