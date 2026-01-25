---
name: hebrew
description: Add Hebrew text and translations with RTL support
argument-hint: [text-to-translate or component-name]
disable-model-invocation: true
---

Add Hebrew text/translations for: $ARGUMENTS

## Guidelines

### Text Direction
- The app is Hebrew-first with full RTL support
- HTML has `dir="rtl"` and `lang="he"`

### Tailwind RTL Classes

Always use directional-aware classes:

| Instead of | Use |
|------------|-----|
| `pl-4` | `ps-4` (padding-start) |
| `pr-4` | `pe-4` (padding-end) |
| `ml-4` | `ms-4` (margin-start) |
| `mr-4` | `me-4` (margin-end) |
| `left-0` | `start-0` |
| `right-0` | `end-0` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |

### Database Values

Worker types use English in DB but display Hebrew in UI:
- `inspector` → מפקח
- `action_worker` → עובד ביצוע

### Common Hebrew Terms

| English | Hebrew |
|---------|--------|
| Monitoring | ניטור |
| Action | ביצוע |
| Inspector | מפקח |
| Worker | עובד |
| Customer | לקוח |
| Area | אזור |
| Sub-area | תת-אזור |
| Finding | ממצא |
| Recommendation | המלצה |
| Report | דו"ח |
| Pest | מזיק |
| Risk | סיכון |

### Font Support

Hebrew font is configured in Tailwind. Use the default font stack.
