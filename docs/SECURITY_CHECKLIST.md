# Security Checklist & Threat Mitigation Strategy

## 1. Threat Model & Mitigations

| Threat Vector | Potential Impact | Architecture Mitigation Strategy |
| :--- | :--- | :--- |
| **Privilege Escalation** | Customer modifies role to `admin` or `super_admin` | - Roles stored in `profiles`, never in JWT or client storage.<br>- `profiles` UPDATE RLS forbids modifying `role` or `account_status` unless caller is `super_admin`.<br>- Server-side middleware and Route Handlers re-verify role directly against DB. |
| **Data Leakage Across Customers** | Customer A accesses Customer B's chat history | - Strict RLS on `conversations` and `messages` scoped to `customer_id = auth.uid()`.<br>- Next.js Route Handlers validate conversation ownership before returning data. |
| **Staff Identity Disclosure** | Customer sees personal admin names/emails | - Message serialization layer masks staff identities to a generic "Support Team" persona for customer responses.<br>- `conversation_assignments` table has no SELECT policy for customers. |
| **Unauthorized Chat Access by Staff** | Unassigned admin snoops on private customer chat | - Admin SELECT policy on `conversations` and `messages` strictly requires active membership in `conversation_assignments` (`is_assigned_to_conversation`).<br>- Revoking assignment instantly severs RLS query access. |
| **Contact Form Abuse / Spam** | Flooding system with fake inquiries / DB exhaustion | - In-memory / edge rate limiting (max 5 submissions per IP per 10 minutes).<br>- Honeypot field in public form.<br>- Server-side Zod validation with character constraints and sanitization.<br>- Zero public SELECT access on `contact_inquiries`. |
| **Email Spoofing / Unauthorized Dispatch** | Malicious user triggers email delivery | - Email sending endpoints (`/api/contact-replies`) require authenticated staff session.<br>- Transactional email API keys strictly kept in server environment variables. |
| **Malicious Media Uploads** | Executable scripts / SVG XSS / file bombs | - File validation in Route Handlers: strict MIME whitelist (`image/jpeg`, `image/png`, `image/webp`, `image/avif`).<br>- Max file size limit: 5MB.<br>- Files served through Supabase Storage with sanitized filenames. |
| **Realtime Channel Snooping** | Client listens to other conversations via WebSocket | - Supabase Realtime authorization checks table-level RLS policies on change events.<br>- Private channels scoped by conversation ID with authorized tokens. |

---

## 2. Security Best Practices Checklist

- [x] **No Plaintext Secrets in Code:** All keys (Supabase Service Role, Email Provider API Keys) stored in `.env.local` and excluded via `.gitignore`.
- [x] **Strict Input Validation:** Zod schemas for all client-submitted payloads (Contact Form, Chat Messages, Post CMS).
- [x] **CSRF / Origin Protection:** Next.js Route Handlers enforce POST-only requests with CORS checks.
- [x] **Immutable Audit Trail:** `audit_logs` has no UPDATE or DELETE policies.
- [x] **Safe Database Triggers:** SECURITY DEFINER functions set explicit `search_path = public` to prevent search_path hijacking.
- [x] **Session Security:** Supabase Auth manages secure, HTTP-only, encrypted refresh tokens and short-lived JWTs.

---

## 3. Anti-Spam & CAPTCHA Provider Configuration Guide

### 3.1 Implemented Server Protections (Active Out-of-the-Box)
1. **Sliding Window Rate Limiter:**
   - Active on `POST /api/contact` via `src/lib/rate-limit.ts`.
   - Rejects flooding (>5 submissions per minute per IP) with HTTP 429 Too Many Requests and a `Retry-After` header.
2. **Honeypot Trap:**
   - The public contact form renders a hidden field (`honeypot`) positioned off-screen.
   - Legitimate browser visitors leave this field empty. Automated spambots filling this field trigger an immediate HTTP 400 rejection.
3. **Database RLS Shielding:**
   - Public visitors only hold an `INSERT` grant on `contact_inquiries`.
   - Zero `SELECT`, `UPDATE`, or `DELETE` access is granted, preventing database enumeration or tampering.

### 3.2 Optional External CAPTCHA Setup (Cloudflare Turnstile or hCaptcha)
If public traffic requires enterprise-grade bot defense in production, follow these steps:
1. **Cloudflare Turnstile (Recommended):**
   - Register the domain in the Cloudflare Dashboard under **Turnstile**.
   - Obtain `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
   - Add keys to `.env.local`:
     ```env
     NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAA...
     TURNSTILE_SECRET_KEY=0x4AAAAAA...
     ```
   - In `src/app/contact/ContactFormClient.tsx`, embed the Turnstile widget:
     `<Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onVerify={(token) => setCaptchaToken(token)} />`
   - In `src/app/api/contact/route.ts`, verify the token with Cloudflare's validation endpoint:
     `https://challenges.cloudflare.com/turnstile/v0/siteverify` before database insertion.

