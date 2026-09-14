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
 * Supabase delivers the recovery session before this page can use it, in one of
 * two shapes depending on the project's flow:
 *   - PKCE:     ?code=... , exchanged for a session
 *   - implicit: #access_token=...&type=recovery , picked up by the client
 *     automatically via detectSessionInUrl
 *
 * Both are handled below rather than assuming one, because which you get
 * depends on project configuration rather than on anything in this codebase.
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
    let settled = false;

    const markReady = () => {
      if (settled) return;
      settled = true;
      setReady(true);
      setChecking(false);
      // Strip the token from the address bar — but ONLY once the session
      // exists. Doing it earlier destroys the very hash that carries it.
      window.history.replaceState({}, '', '/reset-password');
    };

    // The implicit flow delivers the token in the URL fragment, which
    // supabase-js consumes asynchronously during client start-up
    // (detectSessionInUrl). Waiting for the event is the only reliable way to
    // know it has finished — polling getSession() alone loses the race and
    // reports a perfectly good link as expired.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && ['PASSWORD_RECOVERY', 'SIGNED_IN', 'INITIAL_SESSION'].includes(event)) {
        markReady();
      }
    });

    (async () => {
      try {
        // PKCE projects send ?code= instead of a fragment. Handle both rather
        // than assuming one: which you get is project configuration, not code.
        const code = new URL(window.location.href).searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          markReady();
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) markReady();
      } catch (err) {
        if (!settled) {
          settled = true;
          setChecking(false);
          setError(err instanceof Error ? err.message : 'הקישור אינו תקף');
        }
      }
    })();

    // If nothing has arrived by now, the link really is bad.
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      setChecking(false);
      setError('הקישור אינו תקף או שפג תוקפו. בקש קישור חדש מדף איפוס הסיסמה.');
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
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
