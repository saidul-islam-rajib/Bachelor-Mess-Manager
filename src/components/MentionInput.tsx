import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { EVERYONE_ALIASES, EVERYONE_ID, EVERYONE_NAME, parseMentions } from '@/lib/mentions';
import { validationConfig } from '@/config';
import { strings } from '@/lib/i18n';

export type Member = { id: string; name: string };

const TRIGGER = /(?:^|\s)@([^@]*)$/;
const MAX_QUERY_LENGTH = 30;
const MAX_SUGGESTIONS = 6;
const EVERYONE_OPTION: Member = { id: EVERYONE_ID, name: EVERYONE_NAME };

type MentionInputProps = {
  value: string;
  onChange: (value: string) => void;
  members: Member[];
  placeholder?: string;
  rows?: number;
  onSubmit?: () => void;
  variant?: 'textarea' | 'inline';
  showHint?: boolean;
  hint?: string;
  allowEveryone?: boolean;
  maxLength?: number;
  className?: string;
};

export function MentionInput({
  value,
  onChange,
  members,
  placeholder,
  rows = 3,
  onSubmit,
  variant = 'textarea',
  showHint = variant === 'textarea',
  hint = strings.comments.mentionHint,
  allowEveryone = true,
  maxLength = validationConfig.commentMaxLength,
  className = ''
}: MentionInputProps) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);

  const needle = (query ?? '').trim().toLowerCase();
  const matches =
    query === null
      ? []
      : [
          ...(allowEveryone && members.length > 1 && EVERYONE_ALIASES.some((alias) => alias.startsWith(needle))
            ? [EVERYONE_OPTION]
            : []),
          ...members.filter((member) => member.name.toLowerCase().includes(needle))
        ].slice(0, MAX_SUGGESTIONS);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  function detectMention(text: string, caret: number) {
    const before = text.slice(0, caret);
    const match = before.match(TRIGGER);

    if (!match || match[1].length > MAX_QUERY_LENGTH) {
      setQuery(null);
      return;
    }

    setQuery(match[1]);
  }

  function insert(member: Member) {
    const element = ref.current;
    if (!element) return;

    const caret = element.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const replaced = before.replace(TRIGGER, (whole) => {
      const lead = whole.startsWith('@') ? '' : whole[0];
      return `${lead}@${member.name} `;
    });

    onChange(replaced + after);
    setQuery(null);

    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(replaced.length, replaced.length);
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    if (matches.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((current) => (current + 1) % matches.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((current) => (current - 1 + matches.length) % matches.length);
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

  const shared = {
    ref,
    value,
    maxLength,
    placeholder,
    onChange: (event: { target: { value: string; selectionStart: number | null } }) => {
      onChange(event.target.value);
      detectMention(event.target.value, event.target.selectionStart ?? event.target.value.length);
    },
    onKeyDown,
    onBlur: () => setTimeout(() => setQuery(null), 120)
  };

  const inline = variant === 'inline';

  return (
    <div className="relative min-w-0 flex-1">
      {inline ? (
        <input
          {...shared}
          type="text"
          className={`w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${className}`}
        />
      ) : (
        <textarea
          {...shared}
          rows={rows}
          className={`w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${className}`}
        />
      )}

      {matches.length > 0 && (
        <ul
          className={`absolute z-30 w-64 max-w-[calc(100vw-3rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ${
            inline ? 'bottom-full left-0 mb-1' : 'left-3 top-full mt-1'
          }`}
        >
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
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${
                    member.id === EVERYONE_ID ? 'bg-amber-500' : 'bg-brand-600'
                  }`}
                >
                  {member.id === EVERYONE_ID ? '@' : member.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate">{member.name}</span>
                {member.id === EVERYONE_ID && (
                  <span className="ml-auto shrink-0 text-xs text-slate-400">{strings.comments.mentionEveryone}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showHint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function MentionText({
  text,
  members,
  mentionNames = {},
  className = 'whitespace-pre-wrap break-words text-slate-700'
}: {
  text: string;
  members: Member[];
  mentionNames?: Record<string, string>;
  className?: string;
}) {
  const parts = parseMentions(text, mentionNames, members);

  return (
    <p className={className}>
      {parts.map((part, index) =>
        typeof part === 'string' ? (
          <span key={index}>{part}</span>
        ) : (
          <span
            key={index}
            className={`rounded px-1 font-medium ${
              part.userId === null ? 'bg-amber-100 text-amber-800' : 'bg-slate-900/5 text-slate-900'
            }`}
          >
            @{part.name}
          </span>
        )
      )}
    </p>
  );
}
