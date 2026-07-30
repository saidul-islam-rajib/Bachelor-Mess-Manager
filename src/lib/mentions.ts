export type MentionMember = { id: string; name: string };

const TOKEN = /@\[u:([0-9a-fA-F-]{36})\]/g;

export function encodeMentions(text: string, members: MentionMember[]): string {
  const byLongestName = [...members].filter((m) => m.name).sort((a, b) => b.name.length - a.name.length);

  let out = '';
  let rest = text;

  while (rest.length > 0) {
    const at = rest.indexOf('@');
    if (at === -1) {
      out += rest;
      break;
    }

    out += rest.slice(0, at);
    const after = rest.slice(at + 1);
    const match = byLongestName.find((m) => after.toLowerCase().startsWith(m.name.toLowerCase()));

    if (match) {
      out += `@[u:${match.id}]`;
      rest = after.slice(match.name.length);
    } else {
      out += '@';
      rest = after;
    }
  }

  return out;
}

export function mentionIdsIn(text: string): string[] {
  return [...text.matchAll(TOKEN)].map((m) => m[1]);
}

export type TextPart = string | { userId: string | null; name: string };

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
    parts.push({ userId, name: names[userId] ?? 'Unknown member' });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));

  const byLongestName = [...fallbackMembers].filter((m) => m.name).sort((a, b) => b.name.length - a.name.length);
  if (byLongestName.length === 0) return parts;

  const expanded: TextPart[] = [];
  for (const part of parts) {
    if (typeof part !== 'string') {
      expanded.push(part);
      continue;
    }

    let rest = part;
    while (rest.length > 0) {
      const at = rest.indexOf('@');
      if (at === -1) {
        expanded.push(rest);
        break;
      }

      const after = rest.slice(at + 1);
      const match = byLongestName.find((m) => after.toLowerCase().startsWith(m.name.toLowerCase()));

      if (!match) {
        expanded.push(rest.slice(0, at + 1));
        rest = after;
        continue;
      }

      if (at > 0) expanded.push(rest.slice(0, at));
      expanded.push({ userId: match.id, name: match.name });
      rest = after.slice(match.name.length);
    }
  }

  return expanded;
}
