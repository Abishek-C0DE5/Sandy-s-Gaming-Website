/**
 * Email template generator for Sandy's Gaming Lounge guest inquiry responses.
 * Generates both sanitized HTML and accessible Plaintext versions.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface InquiryEmailContext {
  recipientName?: string | null;
  inquiryDate: string;
  originalMessage: string;
  responseBody: string;
  staffName: string;
}

export function generateInquiryReplyEmail(context: InquiryEmailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = context.recipientName ? `Hi ${context.recipientName},` : 'Hello,';
  const subject = `Re: Your Inquiry to Sandy's Gaming Lounge`;

  const safeResponseBody = escapeHtml(context.responseBody).replace(/\n/g, '<br />');
  const safeOriginalMessage = escapeHtml(context.originalMessage).replace(/\n/g, '<br />');
  const safeStaffName = escapeHtml(context.staffName);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #0a0a0c; color: #e4e4e7; }
    .container { max-width: 600px; margin: 30px auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 32px 28px; text-align: left; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .content { padding: 32px 28px; font-size: 14px; line-height: 1.6; color: #d4d4d8; }
    .response-box { background-color: #27272a; border-left: 4px solid #3b82f6; padding: 18px 20px; border-radius: 8px; margin: 24px 0; color: #ffffff; font-size: 14px; }
    .original-inquiry { margin-top: 32px; padding-top: 20px; border-top: 1px solid #27272a; font-size: 12px; color: #71717a; }
    .original-inquiry p { margin: 4px 0; }
    .footer { padding: 24px 28px; background-color: #121214; text-align: center; font-size: 11px; color: #71717a; border-top: 1px solid #27272a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Sandy's Gaming Lounge</h1>
    </div>
    <div class="content">
      <p style="margin-top: 0;">${greeting}</p>
      <p>Thank you for reaching out to us. A member of our support team has responded to your inquiry:</p>
      
      <div class="response-box">
        ${safeResponseBody}
      </div>

      <p style="margin-bottom: 0;">Best regards,<br><strong>${safeStaffName}</strong><br>Sandy's Gaming Operations Team</p>

      <div class="original-inquiry">
        <p><strong>Your Original Message (${escapeHtml(context.inquiryDate)}):</strong></p>
        <p style="font-style: italic;">"${safeOriginalMessage}"</p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0;">Sandy's Gaming Lounge &bull; 404 Cyber Arcade Way, Level 2</p>
      <p style="margin: 4px 0 0 0;">This email is sent in response to your guest submission on our website.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Sandy's Gaming Lounge

${greeting}

Thank you for reaching out to us. A member of our team has responded to your inquiry:

--------------------------------------------------
${context.responseBody}
--------------------------------------------------

Best regards,
${context.staffName}
Sandy's Gaming Operations Team

==================================================
Your Original Message (${context.inquiryDate}):
"${context.originalMessage}"
==================================================

Sandy's Gaming Lounge | 404 Cyber Arcade Way, Level 2
  `.trim();

  return { subject, html, text };
}
