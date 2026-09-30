/**
 * The legal identity printed in a report's footer, as it appears on the
 * client's sample report (2026-09-29). A constant rather than a tenant setting:
 * the olive module serves one company today, and a settings table for one row
 * would be a migration with nothing to migrate.
 */
export const COMPANY = {
  name: 'מטעים גשור אגש"ח בע"מ',
  line: 'קיבוץ גשור, רמת הגולן, מיקוד 1294200 · ח.פ 570044115 · טלפון 04-6764103',
} as const;
