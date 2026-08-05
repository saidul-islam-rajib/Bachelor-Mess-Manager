export type MentionMember = { id: string; name: string };

const TOKEN = /@\[(?:u:([0-9a-fA-F-]{36})|all)\]/g;
const UNKNOWN_MENTION = 'Unknown member';

export const EVERYONE_TOKEN = '@[all]';
export const EVERYONE_ID = '@everyone';
export const EVERYONE_NAME = 'everyone';
export const EVERYONE_ALIASES = ['everyone', 'all'];

export type TextPart = string | { userId: string | null; name: string };

function aliasAt(text: string, alias: string): boolean {
  if (!text.toLowerCase().startsWith(alias)) return false;
  const next = text.charAt(alias.length);
  return next === '' || !/[a-z0-9_]/i.test(next);
}

function scanPlainText(text: string, members: MentionMember[]): TextPart[] {
  const byLongestName = [...members].filter((member) => member.name).sort((a, b) => b.name.length - a.name.length);
  const parts: TextPart[] = [];
  let rest = text;
  let buffer = '';

  const flush = () => {
    if (buffer) parts.push(buffer);
    buffer = '';
  };

  while (rest.length > 0) {
    const at = rest.indexOf('@');
    if (at === -1) {
      buffer += rest;
      break;
    }

    buffer += rest.slice(0, at);
    const after = rest.slice(at + 1);
    const member = byLongestName.find((candidate) => after.toLowerCase().startsWith(candidate.name.toLowerCase()));
    const alias = EVERYONE_ALIASES.find((candidate) => aliasAt(after, candidate));

    if (alias && (!member || member.name.length < alias.length)) {
      flush();
      parts.push({ userId: null, name: EVERYONE_NAME });
      rest = after.slice(alias.length);
      continue;
    }

    if (member) {
      flush();
      parts.push({ userId: member.id, name: member.name });
      rest = after.slice(member.name.length);
      continue;
    }

    buffer += '@';
    rest = after;
  }

  flush();
  return parts;
}

export function encodeMentions(text: string, members: MentionMember[]): string {
  return scanPlainText(text, members)
    .map((part) => {
      if (typeof part === 'string') return part;
      return part.userId ? `@[u:${part.userId}]` : EVERYONE_TOKEN;
    })
    .join('');
}

export function mentionIdsIn(text: string): string[] {
  return [...text.matchAll(TOKEN)].map((match) => match[1]).filter((id): id is string => Boolean(id));
}

export function mentionsEveryone(text: string): boolean {
  return text.includes(EVERYONE_TOKEN);
}

export function flattenMentions(text: string, names: Record<string, string>): string {
  return text.replace(TOKEN, (_token, userId: string | undefined) =>
    userId ? `@${names[userId] ?? UNKNOWN_MENTION}` : `@${EVERYONE_NAME}`
  );
}

export function parseMentions(
  text: string,
  names: Record<string, string>,
  fallbackMembers: MentionMember[] = []
): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push(text.slice(cursor, start));
    const userId = match[1];
    parts.push(userId ? { userId, name: names[userId] ?? UNKNOWN_MENTION } : { userId: null, name: EVERYONE_NAME });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));

  const expanded: TextPart[] = [];
  for (const part of parts) {
    if (typeof part !== 'string') {
      expanded.push(part);
      continue;
    }
    expanded.push(...scanPlainText(part, fallbackMembers));
  }

  return expanded;
}
