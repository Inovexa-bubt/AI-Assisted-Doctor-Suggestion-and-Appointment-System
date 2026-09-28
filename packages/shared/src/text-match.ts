// Keyword matching for Bangla, English and romanised Bangla ("Banglish") text.

/** Lower-cases, unifies apostrophes, drops zero-width joiners and collapses whitespace. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[‌‍]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const compiled = new Map<string, RegExp>()

/**
 * English keywords match whole words, with an optional plural or verb ending, so 'nose' does not
 * match 'diagnosed' but 'vomit' matches 'vomiting'. Bangla keywords match anywhere, because Bangla
 * attaches case endings to the word ('বাচ্চা' → 'বাচ্চার').
 */
function keywordRegExp(keyword: string): RegExp {
  let re = compiled.get(keyword)
  if (!re) {
    const k = escapeRegExp(normalizeText(keyword))
    re = /^[\x20-\x7e]+$/.test(keyword)
      ? new RegExp(`(?<![a-z0-9])${k}(?:s|es|ed|ing)?(?![a-z0-9])`, 'g')
      : new RegExp(k, 'g')
    compiled.set(keyword, re)
  }
  re.lastIndex = 0
  return re
}

export interface KeywordMatch<T> {
  keyword: string
  value: T
  index: number
  length: number
}

/**
 * Finds every keyword in the text. When matches overlap, only the longest is kept, so
 * 'heartburn' counts as heartburn and not also as 'heart'.
 */
export function findKeywords<T>(
  text: string,
  entries: Iterable<{ keyword: string; value: T }>,
): KeywordMatch<T>[] {
  const haystack = normalizeText(text)
  const all: KeywordMatch<T>[] = []
  for (const { keyword, value } of entries) {
    const re = keywordRegExp(keyword)
    for (let m = re.exec(haystack); m; m = re.exec(haystack)) {
      all.push({ keyword, value, index: m.index, length: m[0].length })
    }
  }
  all.sort((a, b) => b.length - a.length || a.index - b.index)
  const kept: KeywordMatch<T>[] = []
  for (const m of all) {
    const overlaps = kept.some((k) => m.index < k.index + k.length && k.index < m.index + m.length)
    if (!overlaps) kept.push(m)
  }
  return kept.sort((a, b) => a.index - b.index)
}
