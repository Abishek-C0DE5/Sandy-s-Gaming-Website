import type {
  EmailAdapter,
  EmailMessage,
  EmailSendResult,
  EmailProviderName,
} from './types.ts';

/**
 * Fallback Adapter when no external email credentials are configured in .env.local.
 * Safely prevents pretend delivery while saving draft replies in PostgreSQL.
 */
export class UnconfiguredEmailAdapter implements EmailAdapter {
  readonly name: EmailProviderName = 'unconfigured';
  readonly isConfigured = false;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async send(_message: EmailMessage): Promise<EmailSendResult> {
    return {
      success: false,
      status: 'pending',
      providerMessageId: null,
      error:
        'Email delivery provider is not configured. Set EMAIL_PROVIDER (e.g. resend, sendgrid, postmark) and EMAIL_API_KEY in server environment to enable live dispatch.',
      isConfigured: false,
      provider: this.name,
    };
  }
}

/**
 * Resend Email Adapter
 * https://resend.com/docs/api-reference/emails/send-email
 */
export class ResendEmailAdapter implements EmailAdapter {
  readonly name: EmailProviderName = 'resend';
  readonly isConfigured = true;
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string) {
    this.apiKey = apiKey;
    this.defaultFrom = defaultFrom;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const fromAddress = message.from || this.defaultFrom;
    const formattedFrom = message.fromName
      ? `${message.fromName} <${fromAddress}>`
      : fromAddress;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (message.idempotencyKey) {
      headers['Idempotency-Key'] = message.idempotencyKey;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from: formattedFrom,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.message || data?.error || `Resend HTTP error ${response.status}`;
        return {
          success: false,
          status: 'failed',
          providerMessageId: null,
          error: `Resend error: ${errorMsg}`,
          isConfigured: true,
          provider: this.name,
        };
      }

      // Resend returns { id: '...' } upon acceptance
      return {
        success: true,
        status: 'accepted',
        providerMessageId: data?.id || null,
        error: null,
        isConfigured: true,
        provider: this.name,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network failure communicating with Resend';
      return {
        success: false,
        status: 'failed',
        providerMessageId: null,
        error: `Resend transport error: ${msg}`,
        isConfigured: true,
        provider: this.name,
      };
    }
  }
}

/**
 * SendGrid Email Adapter
 * https://docs.sendgrid.com/api-reference/mail-send/mail-send
 */
export class SendGridEmailAdapter implements EmailAdapter {
  readonly name: EmailProviderName = 'sendgrid';
  readonly isConfigured = true;
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string) {
    this.apiKey = apiKey;
    this.defaultFrom = defaultFrom;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const fromEmail = message.from || this.defaultFrom;

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: message.to, name: message.toName || undefined }],
            },
          ],
          from: { email: fromEmail, name: message.fromName || undefined },
          reply_to: message.replyTo ? { email: message.replyTo } : undefined,
          subject: message.subject,
          content: [
            { type: 'text/plain', value: message.text },
            { type: 'text/html', value: message.html },
          ],
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorMsg = data?.errors?.[0]?.message || `SendGrid HTTP ${response.status}`;
        return {
          success: false,
          status: 'failed',
          providerMessageId: null,
          error: `SendGrid error: ${errorMsg}`,
          isConfigured: true,
          provider: this.name,
        };
      }

      // SendGrid returns 202 Accepted with header X-Message-Id
      const messageId = response.headers.get('x-message-id') || null;

      return {
        success: true,
        status: 'accepted',
        providerMessageId: messageId,
        error: null,
        isConfigured: true,
        provider: this.name,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error reaching SendGrid';
      return {
        success: false,
        status: 'failed',
        providerMessageId: null,
        error: `SendGrid transport error: ${msg}`,
        isConfigured: true,
        provider: this.name,
      };
    }
  }
}

/**
 * Postmark Email Adapter
 * https://postmarkapp.com/developer/api/overview
 */
export class PostmarkEmailAdapter implements EmailAdapter {
  readonly name: EmailProviderName = 'postmark';
  readonly isConfigured = true;
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string) {
    this.apiKey = apiKey;
    this.defaultFrom = defaultFrom;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const fromEmail = message.from || this.defaultFrom;
    const formattedFrom = message.fromName
      ? `"${message.fromName}" <${fromEmail}>`
      : fromEmail;

    try {
      const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'X-Postmark-Server-Token': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          From: formattedFrom,
          To: message.to,
          Subject: message.subject,
          HtmlBody: message.html,
          TextBody: message.text,
          ReplyTo: message.replyTo,
          Tag: 'inquiry-response',
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.Message || `Postmark HTTP ${response.status}`;
        return {
          success: false,
          status: 'failed',
          providerMessageId: null,
          error: `Postmark error: ${errorMsg}`,
          isConfigured: true,
          provider: this.name,
        };
      }

      return {
        success: true,
        status: 'accepted',
        providerMessageId: data?.MessageID || null,
        error: null,
        isConfigured: true,
        provider: this.name,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error reaching Postmark';
      return {
        success: false,
        status: 'failed',
        providerMessageId: null,
        error: `Postmark transport error: ${msg}`,
        isConfigured: true,
        provider: this.name,
      };
    }
  }
}

/**
 * Factory function to retrieve active email adapter based on server environment.
 * Automatically falls back to UnconfiguredEmailAdapter when credentials are not supplied.
 */
export function getEmailAdapter(): EmailAdapter {
  const provider = (process.env.EMAIL_PROVIDER || 'unconfigured').toLowerCase().trim();
  const apiKey = (process.env.EMAIL_API_KEY || '').trim();
  const defaultFrom = (process.env.EMAIL_FROM_ADDRESS || 'support@sandysgaming.com').trim();

  // If no API key is supplied, we are strictly unconfigured
  if (!apiKey || provider === 'unconfigured' || provider === 'mock') {
    return new UnconfiguredEmailAdapter();
  }

  switch (provider) {
    case 'resend':
      return new ResendEmailAdapter(apiKey, defaultFrom);
    case 'sendgrid':
      return new SendGridEmailAdapter(apiKey, defaultFrom);
    case 'postmark':
      return new PostmarkEmailAdapter(apiKey, defaultFrom);
    default:
      return new UnconfiguredEmailAdapter();
  }
}
