'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getDirection, getLanguage } from '@/lib/rtl';
import { Loader2, ShieldCheck } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 6;

/**
 * Where the emailed recovery link lands. Sets a new password.
 *
 * Supabase delivers the recovery credentials in one of two shapes, depending on
 * the project's flow:
 *   - PKCE:     ?code=...                     exchanged for a session
 *   - implicit: #access_token=&refresh_token=  installed with setSession
 *
 * Both are handled explicitly. Leaving the fragment case to the client's
 * detectSessionInUrl does NOT work here: the browser client from @supabase/ssr
 * defaults to the PKCE flow and ignores implicit fragment tokens, so a
 * perfectly valid link reported itself as expired. Verified with Playwright
 * against a real emailed link before and after.
 *
 * The page refuses to show the form until a session exists: without one,
 * updateUser would fail with a confusing "Auth session missing" after the user
 * had already typed a new password twice.
 */
export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const dir = getDirection();
  const lang = getLanguage();

  useEffect(() => {
    let cancelled = false;

    const fail = (message: string) => {
      if (cancelled) return;
      setChecking(false);
      setError(message);
    };

    const succeed = () => {
      if (cancelled) return;
      setReady(true);
      setChecking(false);
      // Only now is it safe to drop the token from the address bar.
      window.history.replaceState({}, '', '/reset-password');
    };

    (async () => {
      try {
        const url = new URL(window.location.href);

        // PKCE projects deliver ?code=.
        const code = url.searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          succeed();
          return;
        }

        // Otherwise the tokens arrive in the fragment. They are parsed and
        // installed explicitly rather than leaving it to detectSessionInUrl:
        // the browser client created by @supabase/ssr defaults to the PKCE
        // flow and does not pick these up, so relying on that detection left
        // a valid link reporting itself as expired.
        const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = fragment.get('access_token');
        const refreshToken = fragment.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          succeed();
          return;
        }

        // No token in the URL at all — but an already-signed-in user can still
        // change their password from here.
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          succeed();
          return;
        }

        fail('הקישור אינו תקף או שפג תוקפו. בקש קישור חדש מדף איפוס הסיסמה.');
      } catch (err) {
        fail(err instanceof Error ? err.message : 'הקישור אינו תקף');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
      return;
    }
    if (password !== confirm) {
      setError('הסיסמאות אינן תואמות');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'עדכון הסיסמה נכשל');
      setLoading(false);
    }
  };

  return (
    <div dir={dir} lang={lang} className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 mb-3">
            <img src="/logo.svg" alt="Logo" width={32} height={32} className="size-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Area Control Loop</h1>
        </div>

        {checking ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">בודק את הקישור...</p>
          </div>
        ) : done ? (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <ShieldCheck className="size-6 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">הסיסמה עודכנה</h2>
            <p className="text-sm text-muted-foreground">אפשר להתחבר עם הסיסמה החדשה.</p>
            <Button className="w-full h-11" onClick={() => (window.location.href = '/login')}>
              להתחברות
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight">בחירת סיסמה חדשה</h2>
              <p className="text-sm text-muted-foreground mt-1">
                הסיסמה חייבת להכיל לפחות {MIN_PASSWORD_LENGTH} תווים
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {ready && (
                <>
                  <div className="space-y-1.5">
                    <label htmlFor="password" className="text-sm font-medium">
                      סיסמה חדשה
                    </label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="confirm" className="text-sm font-medium">
                      אימות סיסמה
                    </label>
                    <Input
                      id="confirm"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin me-2" />
                        מעדכן...
                      </>
                    ) : (
                      'עדכן סיסמה'
                    )}
                  </Button>
                </>
              )}

              {!ready && (
                <Link
                  href="/forgot-password"
                  className="block text-center text-sm text-primary hover:underline"
                >
                  בקש קישור חדש
                </Link>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
