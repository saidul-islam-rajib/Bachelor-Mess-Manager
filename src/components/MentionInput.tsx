import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { parseMentions } from '@/lib/mentions';

export type Member = { id: string; name: string };

const TRIGGER = /(?:^|\s)@([^@]*)$/;

export function MentionInput({
  value,
  onChange,
  members,
  placeholder,
  rows = 3,
  onSubmit
}: {
  value: string;
  onChange: (value: string) => void;
  members: Member[];
  placeholder?: string;
  rows?: number;
  onSubmit?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);

  const matches =
    query === null
      ? []
      : members.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  function detectMention(text: string, caret: number) {
    const before = text.slice(0, caret);
    const match = before.match(TRIGGER);
    if (!match) {
      setQuery(null);
      return;
    }
    // Stop offering names once the fragment is clearly no longer a name.
    if (match[1].length > 30) {
      setQuery(null);
      return;
    }
    setQuery(match[1]);
  }

  function insert(member: Member) {
    const el = ref.current;
    if (!el) return;

    const caret = el.selectionStart;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const replaced = before.replace(TRIGGER, (whole) => {
      const lead = whole.startsWith('@') ? '' : whole[0];
      return `${lead}@${member.name} `;
    });

    const next = replaced + after;
    onChange(next);
    setQuery(null);

    requestAnimationFrame(() => {
      el.focus();
      const pos = replaced.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (matches.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insert(matches[highlight]);
        return;
      }
      if (event.key === 'Escape') {
        setQuery(null);
        return;
      }
    }

    if (onSubmit && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        maxLength={1000}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          detectMention(event.target.value, event.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
      />

      {matches.length > 0 && (
        <ul className="absolute left-3 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {matches.map((member, index) => (
            <li key={member.id}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  insert(member);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  index === highlight ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                  {member.name.slice(0, 1).toUpperCase()}
                </span>
                {member.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1 text-xs text-slate-400">Type @ to mention someone.</p>
    </div>
  );
}

export function MentionText({
  text,
  members,
  mentionNames = {}
}: {
  text: string;
  members: Member[];
  mentionNames?: Record<string, string>;
}) {
  const parts = parseMentions(text, mentionNames, members);

  return (
    <p className="whitespace-pre-wrap break-words text-slate-700">
      {parts.map((part, index) =>
        typeof part === 'string' ? (
          <span key={index}>{part}</span>
        ) : (
          <span key={index} className="rounded bg-slate-900/5 px-1 font-medium text-slate-900">
            @{part.name}
          </span>
        )
      )}
    </p>
  );
}
