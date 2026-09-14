'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getDirection, getLanguage } from '@/lib/rtl';
import { Loader2, MailCheck } from 'lucide-react';

/**
 * Request a password reset link.
 *
 * Until this existed there was no recovery path at all: no reset page, no link
 * on the login form, and the invitation flow is dead code (nothing serves
 * /invitations/accept). Every forgotten password was a manual job in the
 * Supabase dashboard — untenable now that the app has external users.
 *
 * Depends on the project's Site URL / redirect allowlist being set to the
 * deployed origin. `redirectTo` below uses window.location.origin, so the link
 * comes back wherever the request was made from, but Supabase still refuses
 * origins that are not on the allowlist.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const dir = getDirection();
  const lang = getLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שליחת הקישור נכשלה');
    } finally {
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

        {sent ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <MailCheck className="size-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">בדוק את תיבת הדואר</h2>
              {/*
                Deliberately not "we sent a link to <email>": confirming which
                addresses have accounts turns this form into a way to enumerate
                users. The wording is the same whether the account exists or not.
              */}
              <p className="text-sm text-muted-foreground">
                אם קיים חשבון עם כתובת זו, נשלח אליו קישור לאיפוס הסיסמה. הקישור תקף לשעה אחת.
              </p>
              <p className="text-sm text-muted-foreground">
                לא הגיע? בדוק בתיקיית הספאם, או נסה שוב.
              </p>
            </div>
            <Button variant="outline" className="w-full h-11" onClick={() => setSent(false)}>
              שלח שוב
            </Button>
            <Link href="/login" className="block text-center text-sm text-primary hover:underline">
              חזרה להתחברות
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight">איפוס סיסמה</h2>
              <p className="text-sm text-muted-foreground mt-1">
                הכנס את כתובת האימייל שלך ונשלח לך קישור לאיפוס
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                  אימייל
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                  className="text-left h-11"
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin me-2" />
                    שולח...
                  </>
                ) : (
                  'שלח קישור לאיפוס'
                )}
              </Button>
              <Link
                href="/login"
                className="block text-center text-sm text-primary hover:underline"
              >
                חזרה להתחברות
              </Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
