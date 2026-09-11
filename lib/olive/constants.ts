/**
 * The crop that switches the olive module on.
 *
 * Everything olive-scoped keys off this rather than off a customer id, so the
 * next olive grower needs no code change. It gates the nav in /api/user/me and
 * filters every olive query, so a pest-management area can never appear in a
 * plot picker or be counted on the harvest dashboard.
 */
export const OLIVE_CROP_NAME = 'זית';
