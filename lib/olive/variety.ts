/**
 * Variety name normalisation, shared by the importer, /api/varieties and the
 * plots screen.
 *
 * Mirrors variety_normalize() in 20261001100000_create_varieties.sql: NFC,
 * trimmed, inner whitespace collapsed. NFC matters because the geresh in
 * לצ'ינו arrives in more than one encoding. The API normalises with this
 * before its own checks so a 409 is decided on the same spelling the
 * database will store.
 */
export function normalizeVarietyName(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ');
}
