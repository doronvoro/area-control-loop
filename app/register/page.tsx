'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getDirection, getLanguage } from '@/lib/rtl';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const dir = getDirection();
  const lang = getLanguage();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
        },
      });

      if (authError) throw authError;

      if (data.user) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'אירעה שגיאה בעת ההרשמה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir={dir} lang={lang} className="min-h-screen flex">
      {/* Brand panel - desktop only */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center bg-[oklch(0.20_0.04_155)]">
        <div className="absolute inset-0 opacity-[0.07]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="30" cy="30" r="1.5" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 30% 50%, oklch(0.35 0.10 155 / 40%) 0%, transparent 70%)',
          }}
        />
        <div className="relative z-10 px-12 text-center max-w-md">
          <div className="flex justify-center mb-8">
            <div className="flex size-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <img src="/logo.svg" alt="Logo" width={48} height={48} className="size-12" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
            Area Control Loop
          </h1>
          <p className="text-[oklch(0.75_0.03_155)] text-base leading-relaxed">
            מערכת ניהול ובקרת שטחים חקלאיים.
            <br />
            ניטור, ניתוח, הערכת סיכונים וביצוע.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 mb-3">
              <img src="/logo.svg" alt="Logo" width={32} height={32} className="size-8" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Area Control Loop</h1>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">הרשמה</h2>
            <p className="text-sm text-muted-foreground mt-1">צור חשבון חדש</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-primary/30 bg-primary/5 text-primary">
                <CheckCircle2 className="size-4" />
                <AlertDescription>
                  ההרשמה בוצעה בהצלחה! מועבר לדף ההתחברות...
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium">
                שם מלא
              </label>
              <Input
                id="name"
                type="text"
                placeholder="הכנס את שמך המלא"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11"
              />
            </div>
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
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                סיסמה
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                אימות סיסמה
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading || success}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin me-2" />
                  נרשם...
                </>
              ) : success ? (
                'נרשם בהצלחה'
              ) : (
                'הרשמה'
              )}
            </Button>
            <div className="text-center text-sm text-muted-foreground pt-2">
              כבר יש לך חשבון?{' '}
              <Link href="/login" className="text-primary font-medium hover:underline">
                התחבר כאן
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
