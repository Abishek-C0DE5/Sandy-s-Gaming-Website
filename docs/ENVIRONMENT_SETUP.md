# Environment Setup & External Provider Configuration

## 1. Environment Variables Template (`.env.example`)

```bash
# ==============================================================================
# Supabase Configuration
# ==============================================================================
# Public credentials (Safe for browser / client components)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Secret credentials (SERVER-SIDE ONLY - NEVER EXPOSE TO CLIENT)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# ==============================================================================
# Application URL Configuration
# ==============================================================================
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# ==============================================================================
# Transactional Email Provider (For Guest Contact Form Replies)
# ==============================================================================
# Supported providers: 'resend', 'sendgrid', 'mock' (for local dev)
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_your_api_key_here
EMAIL_FROM_ADDRESS=support@yourdomain.com
EMAIL_FROM_NAME="Customer Support Team"

# ==============================================================================
# Supabase Auth OTP Configuration Options
# ==============================================================================
# Channel: 'email' (default/recommended), 'sms', or 'both'
NEXT_PUBLIC_AUTH_OTP_CHANNEL=email

# SMS Provider Credentials (Twilio / MessageBird) - Only needed if SMS OTP selected
# TWILIO_ACCOUNT_SID=AC...
# TWILIO_AUTH_TOKEN=...
# TWILIO_PHONE_NUMBER=+1234567890

# ==============================================================================
# Rate Limiting & Anti-Spam
# ==============================================================================
# Contact form rate limit (Submissions per 10 minutes per IP)
CONTACT_FORM_RATE_LIMIT=5
```

---

## 2. Supabase Setup Guide

### 2.1 Project Creation & Configuration
1. Create a project at [https://supabase.com](https://supabase.com).
2. Note your **Project URL**, **Anon Key**, and **Service Role Key**.

### 2.2 Supabase Auth URL Configuration
In the Supabase Dashboard, navigate to **Authentication > URL Configuration**:
- **Site URL:** Set to `http://localhost:3000` (or your production domain).
- **Redirect URLs:** Add the following allow-listed callback URLs:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/chat`
  - `http://localhost:3000/admin`
  - `http://localhost:3000/super-admin`
  - `https://your-production-domain.com/auth/callback`

### 2.3 Supabase Auth OTP Channel Configuration
1. **Email OTP (Default & Active):**
   - Go to **Authentication > Providers > Email**.
   - Ensure **Enable Email provider** is toggled ON.
   - Toggle **Confirm email** ON.
   - Under **Email Templates > Magic Link / Confirmation**:
     - Ensure the template includes `{{ .Token }}` so the user receives the 6-digit passcode.
     - Example template snippet:
       ```html
       <h2>Your Verification Code</h2>
       <p>Use the following 6-digit passcode to log in:</p>
       <h1 style="letter-spacing: 4px; font-family: monospace;">{{ .Token }}</h1>
       <p>This code expires in 60 minutes.</p>
       ```
   - **Rate Limits & Custom SMTP:**
     - Supabase's built-in email service is limited to **3 emails per hour**.
     - To remove this limit, configure custom SMTP under **Authentication > Settings > SMTP Settings** using [Resend](https://resend.com) (recommended: 3,000 free emails/mo) or SendGrid/Postmark.

2. **Phone / SMS OTP (Optional):**
   - Go to **Authentication > Providers > Phone**.
   - Toggle **Enable Phone provider** ON.
   - Choose your SMS provider (Twilio, MessageBird, Vonage, etc.).
   - Enter your Account SID, Auth Token, and Message Service SID.
   - Set `NEXT_PUBLIC_AUTH_OTP_CHANNEL=sms` or `both` in `.env.local`.

### 2.4 Storage Buckets Setup
Two buckets are utilized:
1. `post-media` (Public Bucket):
   - Access: Public read enabled.
   - Permitted MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`.
   - Max file size: `5242880` (5 MB).
2. `chat-attachments` (Private Bucket - Future Phase):
   - Access: Private (only accessible via signed URL generation).

### 2.5 Realtime Configuration
- In Supabase Dashboard, navigate to **Database > Publications**.
- Verify that table `messages` is included in the `supabase_realtime` publication:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  ```

---

## 3. Super Admin Bootstrap & Staff Management Procedure
The Super Admin role is never granted via public registration.

### 3.1 Initial Super Admin Bootstrap (CLI)
Run the administrative bootstrap command with your intended email address:
```bash
node scripts/bootstrap_super_admin.mjs admin@yourdomain.com
```
This script runs server-side with your `SUPABASE_SERVICE_ROLE_KEY`, verifies or provisions the auth account, assigns the `super_admin` role in `profiles`, and outputs confirmation.

### 3.2 Staff Provisioning Console (UI)
Once the Super Admin logs in:
1. Navigate to the **Super Admin Console** at `/super-admin/users`.
2. Enter the staff member's email, display name, and select role (`admin` or `super_admin`).
3. Click **Provision User**. An account will be provisioned in Supabase Auth, their profile will be configured with the role, and an immutable entry will be recorded in `audit_logs`.
4. The Super Admin can also activate or suspend accounts instantly from this console.

---

## 4. Email Provider Decision & Setup
- **Recommended Provider:** [Resend](https://resend.com)
  - Developer-friendly API, native Next.js/React Email integration, free tier includes 3,000 emails/month (100/day).
- **Alternative:** SendGrid, Postmark, or AWS SES.
- **Local Development Fallback:** The application includes a `mock` email driver that logs email payloads to the console during local development without needing active API keys.
