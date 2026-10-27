// Finds location words in a posting's own text. This only reports what the text says.
// It does not decide whether a company accepts applicants from India.

const SIGNALS: { label: string; pattern: RegExp }[] = [
  { label: "India", pattern: /\bindia\b/i },
  { label: "Worldwide", pattern: /\bworld\s?wide\b|\bglobal(ly)?\b/i },
  { label: "Anywhere", pattern: /\banywhere\b/i },
  { label: "APAC", pattern: /\bapac\b|\basia[\s-]?pacific\b/i },
  { label: "Asia", pattern: /\basia\b/i },
  { label: "Remote", pattern: /\bremote\b/i },
];

const OPEN_TO_INDIA = ["India", "Worldwide", "Anywhere", "APAC", "Asia"];

export function locationSignals(text: string | null | undefined): string[] {
  if (!text) return [];
  return SIGNALS.filter((signal) => signal.pattern.test(text)).map((signal) => signal.label);
}

/** True when the text mentions India, worldwide, anywhere, APAC, or Asia. Always confirm on the posting. */
export function mentionsIndiaFriendlyLocation(text: string | null | undefined): boolean {
  return locationSignals(text).some((label) => OPEN_TO_INDIA.includes(label));
}
