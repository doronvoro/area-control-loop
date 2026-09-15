/**
 * The vocabulary of import flags: one label per kind of dirty data, and the
 * explanation behind it.
 *
 * WHY THIS MODULE EXISTS
 * The flags list is what goes back to the customer when their export is wrong,
 * and a single sentence per flag only says what happened to one value. The
 * operator reading it also has to answer three questions that are the same for
 * every flag of a kind — why does this happen, what does the database hold now,
 * and what do I compare against the file — so those answers live here once,
 * next to the label, instead of being repeated into every message.
 *
 * Kept apart from import-backup.ts so the admin page can render the
 * explanations without importing the importer, and so the wording can be
 * reviewed as one Hebrew text rather than hunted across twenty call sites.
 */

export type IssueCategory =
  | 'plotSkipped'
  | 'plantYear'
  | 'numberValue'
  | 'lookupValue'
  | 'taktCount'
  | 'yieldAmbiguous'
  | 'yieldUnmatched'
  | 'yieldMissingValue'
  | 'yieldConflict'
  | 'yieldNoSeason'
  | 'nirOrphan'
  | 'nirTakt'
  | 'nirDry'
  | 'varietyWindow'
  | 'categoryThresholds'
  | 'alertThresholds';

/** One flag: the kind of problem, and the specific value it happened to. */
export interface ImportIssue {
  category: IssueCategory;
  message: string;
}

/**
 * What a label means, in the three parts an operator acts on.
 *
 * `effect` is the one that matters most and the one a message cannot carry on
 * its own: "imported with a caveat" and "not imported at all" look alike in a
 * list, and only the second is a reason to fix the file and run again.
 */
export interface IssueCategoryInfo {
  /** Badge text. Short enough to sit next to a count. */
  label: string;
  /** Why this kind of flag exists at all. */
  what: string;
  /** What the database holds now, which is what the list cannot show. */
  effect: string;
  /** What to compare against the original file, and how to close the gap. */
  action: string;
}

export const ISSUE_CATEGORIES: Record<IssueCategory, IssueCategoryInfo> = {
  plotSkipped: {
    label: 'חלקה שלא יובאה',
    what: 'לחלקה בקובץ אין שם, והשם הוא המפתח שלפיו חלקות מזוהות, מותאמות לחלקה קיימת ומשויכות לבדיקות.',
    effect: 'החלקה כולה לא יובאה — יחד איתה גם בדיקות ה-NIR ואומדני היבול שתלויים בה.',
    action: 'יש לאתר את החלקה בקובץ המקורי, לתת לה שם, ולייבא מחדש.',
  },
  plantYear: {
    label: 'תאריך נטיעה',
    what: 'דשבורד המסיק מחזיק את מועד הנטיעה כטקסט חופשי — "2006" שנה בלבד, "2006/7" שנה וחודש (יולי 2006) — ואילו במערכת זהו שדה תאריך מלא.',
    effect:
      'הטקסט המקורי נשמר כתווית וזה מה שמוצג במסכים. התאריך נבנה מהחלקים שהקובץ כן רשם: חודש ללא יום נשמר כ-1 באותו חודש, וערך שלא זוהה בו חודש נשמר כ-1 בינואר.',
    action:
      'יש לוודא מול הקובץ שהחודש נקרא כנדרש — ההודעה מציינת אותו בשמו. חישובי גיל החלקה ומיון לפי תאריך נטיעה מסתמכים על התאריך הזה; אם היום בחודש חשוב, יש להשלים אותו במסך השטחים — כרטיס החלקה עורך את התווית בלבד.',
  },
  numberValue: {
    label: 'ערך לא מספרי',
    what: 'שדה שהמערכת שומרת כמספר (גודל, אחוזי שמן ומים, ק"ג) הגיע בקובץ כטקסט שלא ניתן להמרה למספר.',
    effect: 'השדה הזה בלבד נשאר ריק. שאר הרשומה יובאה כרגיל.',
    action:
      'יש לאתר את השדה בקובץ המקורי ולהזין את הערך ידנית אחרי הייבוא, או לתקן בקובץ ולייבא מחדש.',
  },
  lookupValue: {
    label: 'ערך שאינו ברשימה',
    what: 'שדות בחירה — סוג מגדל, סוג מוסקת וסוג מים — מתורגמים מהטקסט העברי שבקובץ לקוד קבוע במערכת, לפי רשימה סגורה.',
    effect: 'ערך שאינו ברשימה נשמר כריק ולא הומצא לו קוד. שאר פרטי החלקה יובאו.',
    action:
      'יש לבדוק כיצד נכתב הערך בקובץ. לרוב זו צורת כתיבה חלופית של ערך מוכר (רווח מיותר, כתיב שונה) — אפשר לתקן בקובץ ולייבא מחדש, או לבחור את הערך ידנית בכרטיס החלקה.',
  },
  taktCount: {
    label: 'מספר טאקטים',
    what: 'מספר הטאקטים בחלקה חייב להיות מספר שלם בין 1 ל-10 — זו מגבלה של מסד הנתונים, לא של הייבוא.',
    effect: 'פרטי החלקה נשמרו, אך לא נוצרו עבורה טאקטים כלל.',
    action:
      'יש לוודא מהו המספר הנכון בקובץ. אפשר גם להזין מספר בשדה "טאקטים לחלקה" במסך הייבוא — הוא ממלא רק חלקות שהקובץ אינו מציין עבורן מספר.',
  },
  yieldAmbiguous: {
    label: 'אומדן יבול דו-משמעי',
    what: 'אומדני היבול מגיעים בגיליון נפרד, ללא מזהה חלקה: השיוך נעשה לפי הצירוף גוש + שנת נטיעה + זן. כאן יותר מחלקה אחת נושאת את אותו צירוף — בדרך כלל משום שהגוש או השנה חסרים באחת מהן.',
    effect: 'לא נכתב אומדן לאף אחת מהחלקות. בחירה שרירותית הייתה מצמידה מספר לחלקה הלא נכונה בשקט.',
    action:
      'יש להשלים בקובץ את הגוש ואת שנת הנטיעה של החלקות עד שהצירוף ייחודי, ולייבא מחדש — או להזין את האומדן ידנית במסך היבול.',
  },
  yieldUnmatched: {
    label: 'שורת יבול ללא חלקה',
    what: 'שורה בגיליון היבול מצביעה על צירוף גוש/שנה/זן שאינו קיים באף חלקה בקובץ.',
    effect: 'הערך לא נכתב לשום חלקה, והחלקה שאליה הוא התכוון מופיעה במערכת ללא אומדן יבול.',
    action:
      'הסיבה השכיחה היא שנה שונה בין הגיליון לחלקה. כשיש מועמדת אחת סבירה ההודעה מציינת אותה בשמה — יש לאמת את השנה מול הקובץ המקורי לפני שמזינים את הערך ידנית.',
  },
  yieldMissingValue: {
    label: 'שורת יבול ללא ערך',
    what: 'השורה קיימת בגיליון היבול, אך עמודת ק"ג/דונם ריקה או אינה מספר.',
    effect: 'השורה דולגה. החלקה שאליה התכוונה נשארת ללא אומדן.',
    action: 'יש להשלים את הערך בקובץ ולייבא מחדש, או להזין אותו במסך היבול.',
  },
  yieldConflict: {
    label: 'אומדן קיים שונה מהקובץ',
    what: 'לחלקה כבר קיים אומדן יבול במערכת, והקובץ מציין ערך אחר.',
    effect: 'הערך הקיים נשמר כמות שהוא; הקובץ לא דרס אותו.',
    action:
      'יש להחליט איזה מקור עדכני יותר. בייבוא ממסך זה הדבר אינו אמור לקרות — הנתונים נמחקים לפני הטעינה — ולכן הודעה כזו מצביעה על הרצה מהטרמינל ללא ‎--overwrite-yield.',
  },
  yieldNoSeason: {
    label: 'אין עונה לאומדנים',
    what: 'אומדן יבול נשמר תמיד מול עונה, ולא אותרה עונה עבור הייבוא הזה.',
    effect: 'כל אומדני היבול דולגו, גם אלה שהותאמו לחלקה בהצלחה.',
    action: 'יש לוודא שבקובץ קיימת שנת מסיק (harvestYear) ולייבא מחדש.',
  },
  nirOrphan: {
    label: 'בדיקת NIR ללא חלקה',
    what: 'הבדיקה מפנה למזהה חלקה שאינו קיים ברשימת החלקות של אותו קובץ.',
    effect: 'הבדיקה לא יובאה כלל — אין לה חלקה להיתלות עליה, והיא אינה נספרת במספר הבדיקות שיובאו.',
    action:
      'בדרך כלל מדובר בחלקה שנמחקה בדשבורד המקור אחרי שהבדיקה נרשמה. יש לבדוק בקובץ אם הבדיקה עדיין רלוונטית, ואם כן — להחזיר את החלקה ולייבא מחדש.',
  },
  nirTakt: {
    label: 'טאקט שאינו קיים',
    what: 'הטאקטים נוצרים כתתי-חלקות בשם "טאקט 1" עד "טאקט N", לפי מספר הטאקטים של החלקה. הבדיקה נרשמה על מספר טאקט שאין לו תת-חלקה כזו — או שלחלקה אין טאקטים כלל, או שהמספר גבוה ממספר הטאקטים שלה.',
    effect:
      'הבדיקה יובאה, אך ברמת החלקה כולה ולא ברמת הטאקט. סינון והשוואה לפי טאקט לא יציגו אותה.',
    action:
      'יש להשלים את מספר הטאקטים של החלקה — בקובץ, או בשדה "טאקטים לחלקה" במסך הייבוא — ולייבא מחדש. לחלופין אפשר לשייך את הטאקט ידנית בבדיקה.',
  },
  nirDry: {
    label: 'שמן בחומר יבש מחושב',
    what: 'אחוז השמן בחומר יבש אינו נשמר במערכת כפי שהוזן אלא מחושב מהשמן והמים: שמן ÷ (100 − מים) × 100. בדשבורד המקור הוא נשמר כערך עצמאי, ולכן השניים יכולים להיפרד.',
    effect: 'הערך המחושב הוא שנשמר; הערך שבקובץ אינו נשמר בשום מקום.',
    action:
      'פער של עד עשירית האחוז הוא עיגול וניתן להתעלם ממנו. פער גדול יותר מעיד על טעות באחד משלושת הערכים — יש להשוות מול דוח המעבדה, שכן ערך זה קובע את סף המוכנות למסיק.',
  },
  varietyWindow: {
    label: 'חלון זן חסר',
    what: 'לחלון הזן חסר אחד משלושת הנתונים: הזן, תאריך הפתיחה או תאריך הסגירה.',
    effect: 'החלון לא נוצר. לזן הזה לא יוצג טווח מומלץ למסיק.',
    action: 'יש להשלים את הנתון החסר בקובץ ולייבא מחדש.',
  },
  categoryThresholds: {
    label: 'ספי כרטיסי סטטוס',
    what: 'שמונת הספים של כרטיסי הסטטוס (מוכן למסיק / תקין / חריגה) נלקחים מהקובץ רק כמערכת שלמה — סט חלקי היה שופט את החלקות לפי תערובת של שני כיולים.',
    effect: 'כשחסר ולו סף אחד לא נכתב דבר, והכרטיסים ממשיכים לפי הספים הקיימים במערכת.',
    action:
      'יש להשלים את הספים החסרים בקובץ, או לכוון אותם במסך הספים. לתשומת לב: אלה ספים גלובליים — הם חלים על כל הלקוחות, לא רק על זה שמייבאים.',
  },
  alertThresholds: {
    label: 'ספי התראה',
    what: 'ספי ההתראה (שמן, מים, חומר יבש) הם הגדרה של המערכת ואינם מיובאים לעולם: ייבוא שלהם היה משנה בשקט את חומרת ההתראות עבור כל הלקוחות.',
    effect: 'לא נכתב דבר. ההודעה מדווחת על הפער בלבד, והמערכת שומרת על הערכים הקיימים.',
    action:
      'יש להשוות מול הקובץ אם הלקוח אכן כייל מחדש את הספים; אם כן — לעדכן אותם ידנית במסך הספים.',
  },
};

/**
 * The flags grouped by label, in the order the categories first appear.
 *
 * File order rather than category order on purpose: the list reads as a pass
 * over the file (plots, then yield, then NIR), and re-sorting it would break
 * the operator's ability to follow it against the export.
 */
export function groupIssues(
  issues: ImportIssue[]
): { category: IssueCategory; info: IssueCategoryInfo; messages: string[] }[] {
  const order: IssueCategory[] = [];
  const byCategory = new Map<IssueCategory, string[]>();

  for (const issue of issues) {
    const bucket = byCategory.get(issue.category);
    if (bucket) {
      bucket.push(issue.message);
    } else {
      order.push(issue.category);
      byCategory.set(issue.category, [issue.message]);
    }
  }

  return order.map((category) => ({
    category,
    info: ISSUE_CATEGORIES[category],
    messages: byCategory.get(category) as string[],
  }));
}
