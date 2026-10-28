# Implementation Plan: Phase 0 through Phase 12

This document defines the roadmap, milestones, and acceptance criteria for building the production application. Each phase will be executed incrementally with testing and approval gates.

---

## Phase 0: Workspace Inspection & Architecture Planning (Current Phase)
- **Objective:** Understand requirements, inspect repository, specify data schemas, security policies, and prepare blueprint.
- **Tasks:**
  - Inspect repository files and environment.
  - Formulate detailed documentation: Project Specification, Architecture, Schema, Permissions, Security, Implementation Plan, and Environment Setup.
  - Identify open decisions (OTP channel, Email provider).
- **Verification:** User reviews and approves documentation before code modifications.

---

## Phase 1: Application Setup & Foundation
- **Objective:** Initialize Next.js 15+ App Router application with TypeScript, Tailwind CSS, Lucide Icons, and base configurations.
- **Tasks:**
  - Scaffold Next.js application with TypeScript, Tailwind CSS, App Router.
  - Configure ESLint, Prettier, PostCSS, and strict TypeScript checks.
  - Setup environment variable templates (`.env.example`).
  - Configure Supabase client libraries (`@supabase/supabase-js`, `@supabase/ssr`).
  - Build root layout, responsive navigation, footer, and basic landing page.
- **Acceptance Criteria:** `npm run dev` and `npm run build` execute without errors; clean component baseline established.

---

## Phase 2: Database Schema & Row Level Security Foundation
- **Objective:** Deploy reproducible PostgreSQL migrations covering all 9 tables, indexes, triggers, and comprehensive RLS policies.
- **Tasks:**
  - Write SQL migrations for:
    - `001_profiles.sql` (profiles, triggers for user sync, role check)
    - `002_posts_and_media.sql` (posts, post_media, published filter)
    - `003_conversations_and_assignments.sql` (conversations, assignments, uniqueness constraint)
    - `004_messages.sql` (messages, foreign keys, sender attribution)
    - `005_contact_inquiries.sql` (contact_inquiries, contact_inquiry_replies)
    - `006_audit_logs.sql` (audit_logs, append-only policies)
    - `007_security_policies.sql` (RLS policies across all tables, helper security definer functions)
  - Write database verification script to test RLS positive and negative test cases.
- **Acceptance Criteria:** Migrations apply cleanly; RLS blocks unauthorized reads/writes; customer isolation verified at the SQL level.

---

## Phase 3: Authentication & Role Management
- **Objective:** Implement passwordless OTP authentication (Email/Phone), session management, and server-side role resolution.
- **Tasks:**
  - Create login and OTP verification pages (`/login`, `/verify-otp`).
  - Setup Next.js server client session middleware and role protection utilities.
  - Implement protected route middleware for `/admin/*`, `/super-admin/*`, and `/chat/*`.
  - Create secure Super Admin bootstrap script and Admin invitation/provisioning API.
- **Acceptance Criteria:** OTP flow issues authenticated session; Customers cannot access `/admin`; Admins cannot access `/super-admin`; Super Admin verified via database profile.

---

## Phase 4: Public Content Website
- **Objective:** Build public-facing responsive content site loading published blogs, posters, and photo galleries from PostgreSQL.
- **Tasks:**
  - Implement Homepage with hero section, latest blogs, featured posters, and contact CTA.
  - Implement Blog listing (`/blog`) and Blog detail (`/blog/[slug]`) with SEO meta tags.
  - Implement Gallery (`/posts` or `/gallery`) with filter by post type (poster, photo).
  - Implement loading skeletons, empty states, and error boundaries.
- **Acceptance Criteria:** Only published posts load; draft content returns 404 to public users; responsive on desktop, tablet, and mobile.

---

## Phase 5: Content Management System (CMS) & File Storage
- **Objective:** Enable authorized staff (Admin and Super Admin) to manage content and upload media via Supabase Storage.
- **Tasks:**
  - Create admin CMS interfaces: post list, post editor (new/edit), preview mode.
  - Integrate Supabase Storage bucket (`post-media`) with client/server upload handlers.
  - Add client and server validation for image types (JPEG, PNG, WebP) and size limits (5MB).
  - Implement draft, publish, archive, and delete operations with permission checks.
- **Acceptance Criteria:** Admins can draft and publish posts; uploaded media is saved and linked; unauthorized users cannot access editor routes.

---

## Phase 6: Basic Authenticated Live Chat
- **Objective:** Build the core live chat data flow with persistent PostgreSQL storage and session verification.
- **Tasks:**
  - Create Customer Chat page (`/chat` or `/chat/[conversationId]`).
  - Implement conversation auto-creation or retrieval for the authenticated customer.
  - Implement message submission Route Handler/Action with server-side sender ID injection (`auth.uid()`).
  - Render message list with timestamps, sender bubbles, and auto-scroll.
- **Acceptance Criteria:** Authenticated customer can send and view messages; messages persist across reloads; Customer A cannot view Customer B's conversation.

---

## Phase 7: Multi-Admin Shared Chat & Conversation Assignments
- **Objective:** Implement the shared-conversation model where multiple assigned admins participate in a single customer chat.
- **Tasks:**
  - Build Admin Inbox (`/admin/inbox`) displaying assigned conversations.
  - Build Super Admin Assignment interface to assign/remove admins from any conversation.
  - Implement message authorship separation:
    - Customer UI renders staff messages as "Support Team".
    - Admin/Super Admin UI renders staff messages with true author names.
  - Enforce access revocation when an admin is removed from an assignment.
- **Acceptance Criteria:** Multiple admins can view and reply to the same conversation ID; customer sees unified "Support Team" sender; unassigned admins cannot view restricted chats.

---

## Phase 8: Real-Time Messaging & Synchronization
- **Objective:** Enable instant live-chat message delivery using Supabase Realtime without page refresh.
- **Tasks:**
  - Connect client to Supabase Realtime channel scoped to `conversation_id`.
  - Handle incoming message events with deduplication (by message ID) to prevent double-renders.
  - Implement connection status indicators (connecting, connected, reconnecting).
  - Implement message pagination for historical messages.
- **Acceptance Criteria:** Messages sent by customer immediately appear in all assigned admins' screens in real time, and vice versa; no duplicate messages; re-connection recovers missing state.

---

## Phase 9: Guest Contact Us System
- **Objective:** Build an unauthenticated Contact Us form with server-side validation, anti-spam, and an Admin inbox.
- **Tasks:**
  - Build public Contact Us page (`/contact`) with email, international phone, name, and message inputs.
  - Implement `/api/contact` Route Handler with Zod validation, honeypot spam detection, and rate limiting.
  - Build Admin Contact Requests inbox (`/admin/contact-requests`) to list and inspect inquiries.
  - Add status controls (`new`, `in_progress`, `replied`, `closed`).
- **Acceptance Criteria:** Guests can submit inquiries without logging in; inquiries appear in admin inbox; guests have zero access to chat or inquiry databases; spam is blocked.

---

## Phase 10: Inquiry Replies & Transactional Email Delivery
- **Objective:** Allow staff to reply to guest inquiries from the dashboard and dispatch emails to the guest's address.
- **Tasks:**
  - Build modular email sending adapter (`lib/email`) supporting transactional email providers (Resend / SendGrid).
  - Implement Admin Reply interface in the inquiry detail view.
  - Save replies to `contact_inquiry_replies` and record delivery status (`pending`, `sent`, `failed`).
  - Implement retry workflow for failed deliveries.
- **Acceptance Criteria:** Admin replies trigger email delivery to the submitted guest address; email failures are displayed with retry option; API keys remain strictly server-side.

---

## Phase 11: Super Admin Dashboard & Governance
- **Objective:** Provide platform-wide administration, user management, audit logs, and global controls.
- **Tasks:**
  - Build Super Admin dashboard overview (`/super-admin`) with platform analytics.
  - Implement User Management (`/super-admin/users`) to invite admins, toggle status, and change roles.
  - Implement Global Conversation Browser with staff participation and assignment tools.
  - Implement Audit Log viewer (`/super-admin/audit-logs`) with search and filter.
- **Acceptance Criteria:** Super Admin can access all conversations, assign/unassign staff, manage accounts, and view audit events; non-super admins are strictly barred.

---

## Phase 12: Final Hardening, End-to-End Testing & Production Readiness
- **Objective:** End-to-end verification, security audits, build validation, and deployment guide.
- **Tasks:**
  - Execute automated tests (unit, integration, RLS permissions, Playwright E2E).
  - Test edge cases: session expiry, rapid multi-admin messages, large file uploads, rate limit trips.
  - Run production build (`npm run build`) and lint checks.
  - Document deployment steps (Vercel / Supabase) and disaster recovery protocols.
- **Acceptance Criteria:** Zero lint/build errors; all permission tests pass; system ready for production deployment.
