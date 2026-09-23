import { Heebo, Assistant, Frank_Ruhl_Libre } from 'next/font/google';

/**
 * Chrome-free layout for printable documents.
 *
 * A sibling route group to (authenticated) purely to escape AppShell — its
 * sidebar, bottom nav and container padding have no place on a sheet of paper,
 * and UserProvider lives inside it, so anything calling useUser() must stay out
 * of here. The root layout still supplies <html lang dir>, so RTL is inherited.
 *
 * These routes are NOT public: middleware.ts exempts only the auth pages, and
 * every page under here calls requireAuth() as well.
 *
 * The three families are the client prototype's, loaded only for this group so
 * the app's own typography (Rubik, app/layout.tsx) is untouched. Frank Ruhl
 * Libre is the footer tagline and is only ever used in italic.
 */

const heebo = Heebo({
  variable: '--font-heebo',
  subsets: ['latin', 'hebrew'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
});

const assistant = Assistant({
  variable: '--font-assistant',
  subsets: ['latin', 'hebrew'],
  weight: ['400', '600'],
  display: 'swap',
});

const frankRuhl = Frank_Ruhl_Libre({
  variable: '--font-frank-ruhl',
  subsets: ['latin', 'hebrew'],
  weight: ['400'],
  display: 'swap',
});

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${heebo.variable} ${assistant.variable} ${frankRuhl.variable}`}>
      {children}
    </div>
  );
}
