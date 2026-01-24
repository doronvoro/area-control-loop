/**
 * Email service utilities
 * Configure with Resend or SendGrid
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  // TODO: Implement with Resend or SendGrid
  // For now, just log
  console.log('Email would be sent:', options);
  
  // Example Resend implementation:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'noreply@yourapp.com',
  //   to: options.to,
  //   subject: options.subject,
  //   html: options.html,
  // });
}

export function generateInvitationEmail(
  name: string,
  token: string,
  type: 'customer' | 'worker',
  expiresAt: Date
): { subject: string; html: string } {
  const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invitations/accept/${token}`;
  const expirationDate = expiresAt.toLocaleDateString('he-IL');

  const subject =
    type === 'customer'
      ? `הזמנה להצטרף למערכת - ${name}`
      : `הזמנה להצטרף כעובד - ${name}`;

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif;">
      <h2>שלום ${name},</h2>
      <p>הוזמנת להצטרף למערכת Area Control Loop.</p>
      <p>
        <a href="${invitationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          לחץ כאן כדי לקבל את ההזמנה
        </a>
      </p>
      <p>ההזמנה תפוג ב-${expirationDate}</p>
      <p>אם לא ביקשת הזמנה זו, תוכל להתעלם מהמייל הזה.</p>
    </div>
  `;

  return { subject, html };
}
