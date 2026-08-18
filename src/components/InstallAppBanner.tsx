import { useEffect, useState } from 'react';
import { usePwa } from '@/components/PwaProvider';
import { strings } from '@/lib/i18n';
import { appConfig } from '@/config';

const DISMISS_KEY = 'bp-install-dismissed';

export default function InstallAppBanner() {
  const { installable, installed, platform, needsManualInstall, promptInstall } = usePwa();
  const [dismissed, setDismissed] = useState(true);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      return;
    }
  }

  if (installed || dismissed) return null;
  if (!installable && !needsManualInstall) return null;

  return (
    <div className="border-b border-slate-200 bg-slate-900 text-white">
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <path d="M12 18h.01" />
          </svg>
        </span>

        <p className="min-w-0 flex-1">
          <span className="font-semibold">{strings.installBanner.install(appConfig.name)}</span>
          <span className="ml-2 hidden text-slate-300 sm:inline">
            {strings.installBanner.hint}
          </span>
        </p>

        {platform === 'ios' ? (
          <button
            type="button"
            onClick={() => setShowIosSteps((v) => !v)}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100"
          >
            {showIosSteps ? strings.installBanner.hide : strings.installBanner.how}
          </button>
        ) : (
          <button
            type="button"
            onClick={promptInstall}
            className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100"
          >
            {strings.installBanner.installCta}
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label={strings.installBanner.dismiss}
          className="-mr-1.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {showIosSteps && (
          <ol className="w-full list-decimal space-y-1 rounded-xl bg-white/10 px-6 py-3 text-xs text-slate-200">
            <li>
              {strings.installBanner.step1Pre} <span className="font-semibold text-white">{strings.installBanner.step1Label}</span> {strings.installBanner.step1Post}
            </li>
            <li>
              {strings.installBanner.step2Pre} <span className="font-semibold text-white">{strings.installBanner.step2Label}</span>{strings.installBanner.step2Post}
            </li>
            <li>
              {strings.installBanner.step3Pre} <span className="font-semibold text-white">{strings.installBanner.step3Label}</span>{strings.installBanner.step3Post(appConfig.name)}
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}
