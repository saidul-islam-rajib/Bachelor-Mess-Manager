const XSS_PATTERNS: RegExp[] = [
  /<\s*script\b/i,
  /<\s*\/\s*script\s*>/i,
  /<\s*iframe\b/i,
  /<\s*object\b/i,
  /<\s*embed\b/i,
  /<\s*svg\b/i,
  /<\s*[a-z][^>]*\bon[a-z]+\s*=/i,
  /\bon(?:error|load|click|mouseover|focus|blur|submit|toggle)\s*=/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /\bsrcdoc\s*=/i,
  /document\s*\.\s*(?:cookie|domain|write)/i,
  /\beval\s*\(/i,
  /\bFunction\s*\(\s*['"`]/,
  /&#x?[0-9a-f]{2,};?\s*script/i
];

export function containsXss(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }

  return XSS_PATTERNS.some((pattern) => pattern.test(value) || pattern.test(decoded));
}

export function findXssField(fields: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(fields)) {
    if (containsXss(value)) return key;
  }
  return null;
}
