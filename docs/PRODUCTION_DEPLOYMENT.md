# Production Deployment & Operations Runbook

This document serves as the comprehensive, authoritative production deployment guide and operations runbook for the **ApexPublish & Multi-Admin Live Support Platform**.

---

## 1. Production Architecture & Technology Stack

- **Framework**: Next.js 16.4.3 (App Router, Turbopack, React 19.3.0, Cache Components, Partial Prerendering).
- **Database & Auth Engine**: Supabase PostgreSQL 15+ (`@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.118.0).
- **Real-Time Engine**: Supabase Realtime (WebSocket dual-path delivery: private Broadcast channels + PostgreSQL CDC triggers).
- **Styling**: TailwindCSS v4 with Vanilla CSS design tokens.
- **Testing & QA**: Playwright End-to-End Suite, Node integration test harnesses, strict TypeScript (`tsc --noEmit`), and ESLint.

---

## 2. Environment Variables Matrix

Variables are strictly categorized into **Browser-Safe** (prefixed with `NEXT_PUBLIC_`) and **Server-Side Secrets** (accessible exclusively in Server Components, Server Actions, Route Handlers, and CLI scripts).

> [!CAUTION]
> **CRITICAL SECURITY REQUIREMENT:** Never prefix server-side secret keys with `NEXT_PUBLIC_`. The `SUPABASE_SERVICE_ROLE_KEY` and transactional email API keys must never be bundled into client-side JavaScript.

| Variable Name | Exposure | Required | Default / Example Value | Description & Purpose |
| :--- | :---: | :---: | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Browser-Safe** | Yes | `https://<project-id>.supabase.co` | Public HTTPS endpoint of your Supabase instance. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Browser-Safe** | Yes | `eyJhbGciOi...` | Supabase Anonymous JWT Key with RLS-scoped privileges. |
| `SUPABASE_SERVICE_ROLE_KEY` | **SERVER SECRET** | Yes | `eyJhbGciOi...` | High-privilege administrative service-role key. Bypasses RLS. Used strictly in trusted backend operations. |
| `NEXT_PUBLIC_SITE_URL` | **Browser-Safe** | Yes | `https://yourdomain.com` | Base canonical URL of the deployed application. Used for auth redirects and OpenGraph metadata. |
| `NEXT_PUBLIC_AUTH_OTP_CHANNEL` | **Browser-Safe** | Yes | `email` | Active authentication channel: `'email'` (recommended), `'sms'`, or `'both'`. |
| `EMAIL_PROVIDER` | **SERVER SECRET** | Yes | `resend` | Active transactional email provider: `'resend'`, `'sendgrid'`, `'postmark'`, or `'unconfigured'`. |
| `EMAIL_API_KEY` | **SERVER SECRET** | Yes* | `re_123456789...` | API Key for your email delivery service. (*Required for real email dispatch). |
| `EMAIL_FROM_ADDRESS` | **SERVER SECRET** | Yes | `support@yourdomain.com` | Verified sender email address matching your configured domain. |
| `EMAIL_FROM_NAME` | **SERVER SECRET** | No | `Sandy Support Team` | Sender display name shown in guest email inboxes. |
| `CONTACT_FORM_RATE_LIMIT` | **SERVER SECRET** | No | `5` | Anti-abuse limit: maximum contact submissions per 10 minutes per IP address. |

---

## 3. Supabase Project Production Checklist

Navigate to the [Supabase Dashboard](https://supabase.com/dashboard) and verify each configuration section before deploying:

### 3.1 Authentication & Redirect URLs
- [ ] **Site URL**: Set to your production canonical domain (`https://yourdomain.com`).
- [ ] **Redirect URLs (Allowlist)**: Add all valid callback targets:
  - `https://yourdomain.com/auth/callback`
  - `https://yourdomain.com/chat`
  - `https://yourdomain.com/admin`
  - `https://yourdomain.com/super-admin`
  - `https://yourdomain.com/account`
- [ ] **Email Provider**:
  - Under **Authentication > Providers > Email**, ensure **Enable Email provider** is toggled ON.
  - Set **Confirm email** to ON.
  - **Email Template (Magic Link / OTP)**: Ensure the template body contains `{{ .Token }}` for the 6-digit passcode.
- [ ] **Custom SMTP Settings (Mandatory for Production)**:
  - Supabase's default email service is rate-limited to 3 emails per hour.
  - In **Authentication > Settings > SMTP Settings**, configure custom SMTP credentials (e.g. Resend, SendGrid, Postmark, or Amazon SES) to eliminate rate limits.
- [ ] **Phone Provider (Optional)**:
  - If `NEXT_PUBLIC_AUTH_OTP_CHANNEL=sms` or `both`, configure your Twilio or MessageBird credentials under **Authentication > Providers > Phone**.

### 3.2 Storage Buckets Setup
- [ ] **Bucket `public-media`**:
  - Configuration: **Public Read = ON**.
  - Permitted MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`.
  - Max file size: `5242880` bytes (5 MB).
  - Policies: Uploads, updates, and deletes restricted strictly to staff via Migration 009.
- [ ] **Bucket `draft-media`**:
  - Configuration: **Public Read = OFF (Private)**.
  - Permitted MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`.
  - Max file size: `5242880` bytes (5 MB).
  - Policies: Accessible exclusively to authorized staff via signed URL generation.

### 3.3 Realtime & CDC Publications
- [ ] Under **Database > Publications**, verify that table `messages` is included in the `supabase_realtime` publication:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  ```
- [ ] Verify that Realtime Broadcast authorization policies on `realtime.messages` are active (Migration 011).

---

## 4. Hosting Provider Setup Checklist (Vercel / Node.js Container)

### 4.1 Vercel Deployment (Recommended for Next.js)
1. **Import Git Repository**: Link your GitHub/GitLab repository.
2. **Framework Preset**: Auto-detected as **Next.js**.
3. **Build & Development Settings**:
   - Build Command: `next build` (or `npm run build`)
   - Output Directory: `.next`
   - Install Command: `npm install`
4. **Node.js Version**: Ensure runtime is configured to **Node.js 20.x** or **22.x LTS**.
5. **Environment Variables**: Add all variables from Section 2 into the Vercel Project Settings for the `Production` environment.
6. **Domain & SSL**: Add custom domain (`yourdomain.com`). Vercel automatically provisions and renews SSL/TLS certificates.

### 4.2 Standalone Node.js / Docker Containerization
If self-hosting via Docker / AWS ECS / Render / Fly.io:
1. Ensure `output: 'standalone'` in `next.config.ts` if creating minimal Docker containers.
2. Expose port `3000`.
3. Provide `.env` variables via secure container environment injection (never bake `.env` into the image).
4. Run `node server.js` inside `.next/standalone`.

---

## 5. Database Migration & Safe Deployment Strategy

### 5.1 Migration Inventory
The repository contains 11 version-controlled SQL migrations in `supabase/migrations/`:
- `20261027000001_profiles.sql`: User profiles, role helper functions, and auto-provisioning triggers.
- `20261027000002_posts_and_media.sql`: Posts, post media assets, slug uniqueness, and publication status.
- `20261027000003_conversations_and_assignments.sql`: Multi-admin conversation assignments with partial unique index.
- `20261027000004_messages.sql`: Live chat messages and automated `last_message_at` maintenance triggers.
- `20261027000005_contact_inquiries.sql`: Isolated guest contact requests and staff reply records.
- `20261027000006_audit_logs.sql`: Security audit trail schema and index.
- `20261027000007_security_policies.sql`: Row Level Security policies across all 9 tables.
- `20261027000008_security_hardening.sql`: Role escalation prevention and append-only audit triggers.
- `20261027000009_storage_policies.sql`: Storage RLS policies for `public-media` and `draft-media`.
- `20261027000010_email_delivery_lifecycle.sql`: Idempotency keys, retry tracking, and delivery states.
- `20261027000011_realtime_broadcast_authorization.sql`: Private broadcast channel security on `realtime.messages`.

### 5.2 Non-Destructive Migration Rules
> [!IMPORTANT]
> - **NEVER run `supabase db reset` against a staging or production database.**
> - Apply migrations incrementally using `supabase db push` or by running individual migration files sequentially.
> - Verify the database state before pushing:
>   ```bash
>   node scripts/verify_db.mjs
>   ```

---

## 6. Disaster Recovery, Backup & Rollback Runbook

### 6.1 Database Backups & Point-in-Time Recovery (PITR)
- **Automated Backups**: Supabase automatically captures daily backups on all projects.
- **Point-In-Time Recovery (PITR)**: On Supabase Pro plans, enable PITR under **Database > Backups** to restore the database state to any specific second in the past 7 days.
- **Manual Snapshot before major releases**:
  ```bash
  # Create a timestamped SQL dump of data and schema
  supabase db dump --project-id <your-project-id> -f "backup_pre_deploy_$(date +%Y%m%d_%H%M%S).sql"
  ```

### 6.2 Application Code Rollback Procedure
- **Vercel**:
  1. Open the Vercel Dashboard > **Deployments**.
  2. Locate the previous stable deployment.
  3. Click **Instant Rollback**. Traffic is redirected instantly (zero downtime).
- **Docker / Git**:
  1. Re-deploy the previous release tag:
     ```bash
     git checkout tags/v1.0.0
     npm run build && npm run start
     ```

### 6.3 Failed Database Migration Recovery Plan
1. If a migration fails during deployment:
   - Identify the failing statement from Supabase migration logs.
   - **Do not drop tables**. Write a forward-fix migration (e.g., `20261027000012_fix_column.sql`) rather than attempting destructive rollbacks.
2. If data corruption occurs:
   - Use Supabase PITR to restore to the timestamp immediately preceding the migration deployment.

---

## 7. Pre-Deployment Smoke Testing

Before directing live user traffic to a newly deployed environment, execute the automated smoke test suite:

```bash
# Smoke test against local production build
npm run test:smoke

# Smoke test against staging or production URL
TARGET_URL=https://your-production-domain.com npm run test:smoke
```

The smoke test validates:
- HTTP 200 responses on all public pages (Home, Blog, Gallery, Contact, Login).
- Proper HTTP 404 boundaries on invalid slugs.
- HTTP 307/308 redirect security on unauthenticated visits to `/admin`, `/super-admin`, `/chat`.
- API input validation rejection on malformed payloads.
- Direct Supabase RLS integrity (draft isolation, profile isolation, inquiry protection).
- Storage bucket public/private configuration status.

---

## 8. Initial Super Admin Bootstrap (Post-Deployment)

Once production database migrations are applied:
1. Run the administrative bootstrap command with the designated client Super Admin email address:
   ```bash
   node scripts/bootstrap_super_admin.mjs client_superadmin@yourdomain.com
   ```
2. The user will be created in Supabase Auth, their profile role set to `super_admin`, and an audit log recorded.
3. The Super Admin can then log in via OTP at `https://yourdomain.com/login` and access `/super-admin`.

---

## 9. Production Deployment Readiness Checklist

| Action Item | Responsible Party | Status |
| :--- | :--- | :---: |
| Next.js production build (`npm run build`) | Developer | **COMPLETED** |
| TypeScript strict type-check (`tsc --noEmit`) | Developer | **COMPLETED** |
| ESLint code quality & hook validation (`npm run lint`) | Developer | **COMPLETED** |
| 10 Backend integration suites passing (314 tests) | Developer | **COMPLETED** |
| Playwright E2E suites passing (16 desktop & mobile tests) | Developer | **COMPLETED** |
| Read-only production smoke test runner implemented | Developer | **COMPLETED** |
| Storage buckets created & policies applied | Supabase Admin | **COMPLETED** |
| Realtime CDC publication & broadcast authorization active | Supabase Admin | **COMPLETED** |
| Environment variables documented and secrets quarantined | Developer | **COMPLETED** |
| Production domain selection & hosting platform provision | User / Client | **PENDING MANUAL INPUT** |
| Production SMTP credentials configured in Supabase | User / Client | **PENDING MANUAL INPUT** |
| Production email API key (`EMAIL_API_KEY`) provided | User / Client | **PENDING MANUAL INPUT** |
| Production deployment timing and target approval | User / Client | **AWAITING APPROVAL** |
