const TITLE_CASE_MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'if',
  'in',
  'n',
  'o',
  'of',
  'on',
  'or',
  'tha',
  'the',
  'to',
  'wit',
  'with',
]);

const CANONICAL_WORDS = new Map([
  ['bathos', 'BathOS'],
  ['csv', 'CSV'],
  ['datagrid', 'DataGrid'],
  ['dsn', 'DSN'],
  ['ios', 'iOS'],
  ['macos', 'macOS'],
  ['mcp', 'MCP'],
  ['pdf', 'PDF'],
  ['powersync', 'PowerSync'],
  ['pwa', 'PWA'],
  ['ui', 'UI'],
  ['url', 'URL'],
]);

const LOWERCASE_CANONICAL_TOKENS = new Set(['eg:', 'g', 'ie:', 'nb:']);

function splitAffixes(token: string) {
  const prefix = token.match(/^[^A-Za-z0-9]*/u)?.[0] ?? '';
  const suffix = token.match(/[^A-Za-z0-9:]*$/u)?.[0] ?? '';
  return {
    prefix,
    core: token.slice(prefix.length, token.length - suffix.length),
    suffix,
  };
}

function hasCanonicalMixedCase(value: string) {
  return /[a-z][A-Z]|[A-Z].*[a-z].*[A-Z]/u.test(value);
}

function normalizeTitleWord(word: string, capitalizeMinorWord: boolean): string {
  if (!word || /^[\d\W_]+$/u.test(word)) return word;
  if (LOWERCASE_CANONICAL_TOKENS.has(word.toLowerCase())) return word.toLowerCase();

  const canonical = CANONICAL_WORDS.get(word.toLowerCase());
  if (canonical) return canonical;
  if (/^[A-Z\d]{2,}$/u.test(word) || hasCanonicalMixedCase(word)) return word;
  if (/[@:]|https?\/\//u.test(word)) return word;

  const lower = word.toLowerCase();
  if (!capitalizeMinorWord && TITLE_CASE_MINOR_WORDS.has(lower)) return lower;
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

function normalizeTitleToken(token: string, isFirst: boolean, isLast: boolean): string {
  const { prefix, core, suffix } = splitAffixes(token);
  if (!core) return token;

  const parts = core.split('-');
  const normalized = parts.map((part, index) => {
    const capitalizeMinorWord =
      isFirst ||
      isLast ||
      parts.length > 1 ||
      index > 0 ||
      !TITLE_CASE_MINOR_WORDS.has(part.toLowerCase());
    return normalizeTitleWord(part, capitalizeMinorWord);
  });

  return `${prefix}${normalized.join('-')}${suffix}`;
}

export function toBathosTitleCase(value: string): string {
  const tokens = value.match(/\S+|\s+/gu) ?? [];
  const wordIndexes = tokens
    .map((token, index) => (/[A-Za-z0-9]/u.test(token) ? index : -1))
    .filter((index) => index >= 0);
  const firstWordIndex = wordIndexes[0] ?? -1;
  const lastWordIndex = wordIndexes[wordIndexes.length - 1] ?? -1;

  return tokens
    .map((token, index) => {
      if (!/\S/u.test(token)) return token;
      return normalizeTitleToken(token, index === firstWordIndex, index === lastWordIndex);
    })
    .join('');
}

export function toBathosSentenceCase(value: string): string {
  const tokens = value.match(/\S+|\s+/gu) ?? [];
  let foundFirstWord = false;

  return tokens
    .map((token) => {
      if (!/\S/u.test(token)) return token;
      const { prefix, core, suffix } = splitAffixes(token);
      if (!core) return token;

      const parts = core.split('-');
      const normalized = parts.map((part, index) => {
        const canonical = CANONICAL_WORDS.get(part.toLowerCase());
        if (canonical) return canonical;
        if (/^[A-Z\d]{2,}$/u.test(part) || hasCanonicalMixedCase(part)) return part;
        if (LOWERCASE_CANONICAL_TOKENS.has(part.toLowerCase())) return part.toLowerCase();
        if (/[@:]|https?\/\//u.test(part)) return part;

        const lower = part.toLowerCase();
        const shouldCapitalize = !foundFirstWord && index === 0;
        return shouldCapitalize
          ? `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
          : lower;
      });
      foundFirstWord = true;
      const result = `${prefix}${normalized.join('-')}${suffix}`;
      if (/[.!?]["')\]]*$/u.test(result)) foundFirstWord = false;
      return result;
    })
    .join('');
}

export function isBathosTitleCase(value: string): boolean {
  return value === toBathosTitleCase(value);
}

export function isBathosSentenceCase(value: string): boolean {
  return value === toBathosSentenceCase(value);
}

export function hasBathosSentenceCaseStarts(value: string): boolean {
  return value
    .split(/(?<=[.!?])\s+/u)
    .every((sentence) => {
      const firstLetter = sentence.match(/[A-Za-z]/u)?.[0];
      return !firstLetter || firstLetter === firstLetter.toUpperCase();
    });
}
