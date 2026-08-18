import { useEffect, useMemo, useRef, useState } from 'react';
import { LandingIcon, type LandingIconName } from '@/components/landing/Icons';
import { TOPIC_SCENES } from '@/components/landing/ExplainerScenes';
import { appConfig } from '@/config';
import { strings } from '@/lib/i18n';

const SCENE_ICONS: LandingIconName[] = [
  'check',
  'lock',
  'groups',
  'meals',
  'bazar',
  'bills',
  'history',
  'payments',
  'comments'
];

const SCENE_HOSTS: Array<'a' | 'b'> = ['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'a'];

const HOST_PALETTE = {
  a: { skin: '#f3ba8b', hair: '#1e1b4b', shirt: '#4f46e5' },
  b: { skin: '#e0a878', hair: '#0f172a', shirt: '#1e293b' }
} as const;

const WORDS_PER_MS = 138 / 60_000;

function HostCharacter({ variant, talking }: { variant: 'a' | 'b'; talking: boolean }) {
  const palette = HOST_PALETTE[variant];

  return (
    <svg viewBox="0 0 120 120" role="img" aria-hidden="true" className="h-24 w-24 shrink-0 sm:h-28 sm:w-28">
      <circle cx="60" cy="60" r="58" fill="#eef2ff" />
      <path d="M30 108v-8a30 30 0 0 1 60 0v8z" fill={palette.shirt} />
      <circle cx="60" cy="52" r="26" fill={palette.skin} />
      <path d="M34 46a26 26 0 0 1 52 0 32 32 0 0 0-52 0z" fill={palette.hair} />
      <circle cx="51" cy="54" r="3" fill="#1e293b" />
      <circle cx="69" cy="54" r="3" fill="#1e293b" />
      <path
        d={talking ? 'M50 64a10 10 0 0 0 20 0z' : 'M50 64a10 6 0 0 0 20 0'}
        fill={talking ? '#7f1d1d' : 'none'}
        stroke="#1e293b"
        strokeWidth="2.4"
        strokeLinecap="round"
        className={talking ? 'motion-safe:animate-pulse' : undefined}
      />
    </svg>
  );
}

export default function ExplainerVideo() {
  const copy = strings.landing.explainer;
  const scenes = copy.scenes;
  const total = scenes.length;

  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [finished, setFinished] = useState(false);

  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const englishVoice = useRef<SpeechSynthesisVoice | null>(null);

  const scriptFor = useMemo(
    () => scenes.map((scene) => scene.script(appConfig.name)),
    [scenes]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
    setSpeechSupported(true);

    function pickVoice() {
      const voices = window.speechSynthesis.getVoices();
      englishVoice.current = voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ?? voices[0] ?? null;
    }

    pickVoice();
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pickVoice);
  }, []);

  useEffect(() => {
    return () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!playing) return undefined;

    const text = scriptFor[sceneIndex];
    const minDurationMs = Math.max(6000, text.split(/\s+/).length / WORDS_PER_MS);

    function advance() {
      setSceneIndex((current) => {
        if (current + 1 >= total) {
          setPlaying(false);
          setFinished(true);
          return current;
        }
        return current + 1;
      });
    }

    if (!muted && speechSupported) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (englishVoice.current) utterance.voice = englishVoice.current;
      utterance.rate = 0.92;
      utterance.onend = advance;
      utterance.onerror = advance;
      window.speechSynthesis.speak(utterance);

      return () => window.speechSynthesis.cancel();
    }

    fallbackTimer.current = setTimeout(advance, minDurationMs);
    return () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, [playing, muted, sceneIndex, scriptFor, total, speechSupported]);

  function goTo(index: number) {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    setFinished(false);
    setSceneIndex(Math.min(total - 1, Math.max(0, index)));
  }

  function togglePlay() {
    if (finished) {
      setFinished(false);
      setSceneIndex(0);
      setPlaying(true);
      return;
    }
    setPlaying((current) => !current);
  }

  const scene = scenes[sceneIndex];
  const host = SCENE_HOSTS[sceneIndex];
  const icon = SCENE_ICONS[sceneIndex];

  return (
    <section className="border-b border-slate-200 bg-gradient-to-b from-brand-50/60 via-white to-white">
      <div className="mx-auto max-w-content px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-brand-700 shadow-sm ring-1 ring-brand-100">
            {copy.eyebrow}
          </span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{copy.title}</h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">{copy.subtitle}</p>
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 sm:px-5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white">
              <LandingIcon name={icon} className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{scene.title}</span>
            <span className="shrink-0 text-xs tabular-nums text-slate-400">{copy.sceneOf(sceneIndex + 1, total)}</span>
          </div>

          {TOPIC_SCENES[sceneIndex] ? (
            <div
              key={sceneIndex}
              className="flex flex-col items-center gap-6 px-5 py-8 sm:flex-row sm:items-center sm:gap-10 sm:px-8 lg:gap-14 lg:px-12"
            >
              <div className="flex w-full shrink-0 justify-center sm:w-[45%]">{TOPIC_SCENES[sceneIndex]()}</div>
              <p className="text-justify text-sm leading-relaxed text-slate-700 sm:text-base">
                {scriptFor[sceneIndex]}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 px-5 py-8 sm:flex-row sm:items-start sm:gap-6 sm:px-8">
              <HostCharacter variant={host} talking={playing && !muted} />
              <p className="text-justify text-sm leading-relaxed text-slate-700 sm:text-base">
                {scriptFor[sceneIndex]}
              </p>
            </div>
          )}

          {!speechSupported && (
            <p className="px-5 pb-2 text-center text-xs text-slate-400 sm:px-8">{copy.noSpeechNote}</p>
          )}

          <div className="flex items-center justify-center gap-1.5 pb-4">
            {scenes.map((item, index) => (
              <button
                key={item.title}
                type="button"
                onClick={() => goTo(index)}
                aria-label={copy.sceneOf(index + 1, total)}
                aria-current={index === sceneIndex ? 'true' : undefined}
                className={`h-1.5 rounded-full transition-all ${
                  index === sceneIndex ? 'w-6 bg-brand-600' : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => goTo(sceneIndex - 1)}
              disabled={sceneIndex === 0}
              aria-label={copy.previous}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition-all hover:bg-brand-700 active:translate-y-px"
            >
              {finished ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.8 12a8.2 8.2 0 1 0 2.6-6" />
                    <path d="M3.4 3.8v4.6h4.6" />
                  </svg>
                  {copy.restart}
                </>
              ) : playing ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                  {copy.pause}
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 4.5v15l13-7.5z" />
                  </svg>
                  {sceneIndex === 0 ? copy.play : copy.resume}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => goTo(sceneIndex + 1)}
              disabled={sceneIndex === total - 1}
              aria-label={copy.next}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>

            {speechSupported && (
              <button
                type="button"
                onClick={() => setMuted((current) => !current)}
                aria-label={muted ? copy.unmute : copy.mute}
                aria-pressed={muted}
                className="ml-1 flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
              >
                {muted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 9v6h4l5 5V4L8 9z" />
                    <path d="m16 9 5 6M21 9l-5 6" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 9v6h4l5 5V4L8 9z" />
                    <path d="M17 8.5a5.5 5.5 0 0 1 0 7M19.8 6a9.5 9.5 0 0 1 0 12" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
