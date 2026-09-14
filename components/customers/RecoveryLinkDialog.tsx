'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { showToast } from '@/lib/toast';
import { Copy, Check, KeyRound, Loader2 } from 'lucide-react';

interface RecoveryLinkDialogProps {
  customer: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shows a one-time recovery link for a customer's owner, to be passed on by
 * hand.
 *
 * The project's email sender is Supabase's built-in one, capped at a couple of
 * messages an hour, so a new owner often cannot receive the reset mail at all.
 * This gives the admin something to paste into WhatsApp instead — and crucially
 * means the admin never has to know the owner's password.
 */
export function RecoveryLinkDialog({ customer, open, onOpenChange }: RecoveryLinkDialogProps) {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setLink(null);
    setEmail(null);
    setError(null);
    setCopied(false);
  };

  const handleGenerate = async () => {
    if (!customer) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/recovery-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customer.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'יצירת הקישור נכשלה');
      setLink(data.link);
      setEmail(data.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'יצירת הקישור נכשלה');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      showToast.success('הקישור הועתק');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused outside a secure context, and on a plain
      // http:// deployment that is every time. The link stays selectable.
      showToast.error('ההעתקה נכשלה — סמן את הקישור והעתק ידנית');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>קישור לאיפוס סיסמה</DialogTitle>
          <DialogDescription>
            {customer?.name} — קישור חד-פעמי שאפשר לשלוח ישירות, בלי אימייל.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {link ? (
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                הקישור מחבר את המשתמש לחשבון ומאפשר לו לקבוע סיסמה חדשה — התייחס אליו כמו לסיסמה.
                תקף לשעה אחת, לשימוש חד-פעמי. שלח אותו ישירות ל־{email}, לא לקבוצה.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Input
                readOnly
                value={link}
                dir="ltr"
                className="text-left font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button type="button" variant="outline" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            שירות האימייל המובנה מוגבל לכמה הודעות בשעה, ולכן משתמש חדש לא תמיד מקבל את מייל האיפוס.
            כאן אפשר להפיק את הקישור ולהעביר אותו בעצמך.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            סגור
          </Button>
          {!link && (
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin me-2" />
                  יוצר...
                </>
              ) : (
                <>
                  <KeyRound className="size-4 me-2" />
                  צור קישור
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
