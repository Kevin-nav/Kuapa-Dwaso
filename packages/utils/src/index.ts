export function formatWorkspaceName(name: string): string {
  return name.trim();
}

export function nowTimestamp(): number {
  return Date.now();
}

export function normalizeCodeSegment(value: string | number): string {
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildReadableCode(prefix: string, value: string | number): string {
  const normalizedPrefix = normalizeCodeSegment(prefix);
  const normalizedValue = normalizeCodeSegment(value);

  if (normalizedPrefix.length === 0) {
    return normalizedValue;
  }

  if (normalizedValue.length === 0) {
    return normalizedPrefix;
  }

  return `${normalizedPrefix}-${normalizedValue}`;
}
