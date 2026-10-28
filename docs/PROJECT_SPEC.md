# Project Specification: Content Publishing, OTP Authentication, and Multi-Admin Customer Support Platform

## 1. Executive Summary & Product Vision
This project is an enterprise-grade, production-ready web platform that seamlessly unifies two core capabilities:
1. **Public Content Publishing Platform:** A modern, responsive content publication engine featuring blogs, posters, and photo galleries with rich media and tag/category filtering.
2. **Dual-Channel Customer Support Platform:**
   - **Authenticated Multi-Admin Live Chat:** A real-time, shared-conversation live chat system where authenticated customers receive support from multiple assigned admins under a unified "Support Team" identity while maintaining complete internal message authorship attribution.
   - **Guest Contact Us System:** An isolated, secure inquiry system for unauthenticated visitors that routes inquiries to an administrative inbox and delivers staff responses directly to the visitor via email.

---

## 2. User Roles & Personas

### 2.1 Public / Guest Visitor (Unauthenticated)
- **Privileges:**
  - Browse all published blogs, posters, and photos.
  - Submit inquiries via the public "Contact Us" form (Name, Email, Phone, Message).
  - Request OTP login/registration.
- **Restrictions:**
  - Cannot access authenticated live chat or view existing chat messages.
  - Cannot view, update, or delete submitted contact inquiries.
  - Cannot access any administrative routes, APIs, or drafts.

### 2.2 Authenticated Customer
- **Authentication:** Passwordless OTP (Email or Phone/SMS).
- **Privileges:**
  - Browse public content and access private customer portal.
  - Initiate and participate in an authenticated live-chat conversation with support.
  - Send messages, receive real-time staff replies, and review personal chat history.
  - View staff responses attributed to "Support Team".
  - Manage own profile information and active session.
- **Restrictions:**
  - Strictly isolated to their own conversation(s) (cannot access another customer's chats).
  - Cannot see individual admin names, emails, IDs, or assignment metadata.
  - Cannot publish, edit, or delete website content.
  - Cannot access administrative dashboards or APIs.

### 2.3 Admin (Operational Support Staff)
- **Authentication:** Passwordless OTP with provisioned `admin` role.
- **Privileges:**
  - Access the dedicated Admin Dashboard (`/admin`).
  - View and participate in conversations explicitly assigned to them.
  - See real author attribution for all messages (customer and fellow admins).
  - View and manage permitted website content (create, edit, preview, publish, draft).
  - View the Contact Requests inbox, inspect visitor inquiries, and draft email replies.
  - Send email replies to guest inquiries via server-side email dispatch.
- **Restrictions:**
  - Cannot elevate own privileges or alter user roles.
  - Cannot access conversations outside their authorized scope.
  - Cannot perform Super Admin operations (user provisioning, global settings, audit logs, system-wide admin assignments).

### 2.4 Super Admin (Platform Owner / Chief Administrator)
- **Authentication:** Passwordless OTP bootstrapped via secure database seed/environment procedure.
- **Privileges:**
  - Access the Super Admin Dashboard (`/super-admin`).
  - User and role management: Provision, activate, suspend, and invite Admin accounts.
  - Conversation management: View all customer conversations, inspect full message histories, join and reply to any conversation, and assign/unassign multiple admins per conversation.
  - Contact inquiry management: Full oversight, assignment, and status control of guest contact requests.
  - Content management: Unrestricted control over all posts, media, drafts, and categories.
  - Audit logging: Complete visibility into security events, role changes, assignments, and publishing actions.
  - System configuration: Global support and platform settings.

---

## 3. Functional Requirements

### 3.1 Content Publishing Engine
- **Post Types:**
  - **Blog:** Title, slug, excerpt, body (Markdown/rich text), cover image, author, publication status, timestamps.
  - **Poster:** Title/caption, featured image, optional category, author, publication status, timestamps.
  - **Photo Post:** Caption, media gallery (one or more assets stored in `post_media`), author, publication status, timestamps.
- **Lifecycle Management:** Draft, Published, Archived.
- **Public Visibility:** Strictly enforced at database/query level (only `status = 'published'` and `published_at <= NOW()` are accessible to public visitors).
- **Media Management:** Files stored in dedicated Supabase Storage buckets with metadata tracked in PostgreSQL.

### 3.2 Dual-Channel Contact Architecture

```
                                  [ Visitor / User ]
                                           |
                    +----------------------+----------------------+
                    |                                             |
             [ Unauthenticated ]                           [ Authenticated ]
                    |                                             |
            Guest Contact Form                              Live Chat Hub
                    |                                             |
          (Email, Phone, Message)                        (Persistent Session)
                    |                                             |
        PostgreSQL `contact_inquiries`               PostgreSQL `conversations`
                    |                                             |
          Admin Inbox Notification                   Multi-Admin Realtime Chat
                    |                                             |
         Admin Email Dispatch (Resend/SendGrid)       Realtime Staff Replies ("Support Team")
                    |                                             |
          Guest Email Inbox                             Customer Chat UI
```

#### A. Guest Contact Inquiries
- Validated submission endpoint accepting: `name` (optional), `email` (required, valid format), `phone` (required, E.164 international format), `message` (required, 10–3000 chars).
- Rate-limited and bot-protected (honeypot + IP/token limits).
- Complete isolation: Does not create user accounts, does not create live-chat threads.
- Replies triggered from Admin Dashboard and delivered via external transactional email provider.

#### B. Authenticated Multi-Admin Live Chat
- **Shared Conversation Model:**
  - Customer owns conversation `C`.
  - Admins $A_1, A_2, A_3$ are assigned to conversation $C$ via `conversation_assignments`.
  - All participants post to the same conversation ID `C`.
  - Customer sees messages from $A_1, A_2, A_3$ as "Support Team".
  - Admins and Super Admins see exact author attribution ($A_1$, $A_2$, $A_3$, Customer).
- **Delivery:** PostgreSQL persistence first; Supabase Realtime for instant event push.
- **Resilience:** Auto-reconnect, message deduplication by message ID, pagination for older records.

---

## 4. Non-Functional & Architecture Requirements
1. **Security:** PostgreSQL Row Level Security (RLS) on all exposed tables. Server-side validation via Zod on all endpoints.
2. **Performance:** Sub-100ms API response time, optimized SQL queries with composite indexes, cached static content via Next.js ISR/SSR.
3. **Availability & Scalability:** Stateless Next.js compute, managed PostgreSQL database, CDN-cached media assets.
4. **Maintainability:** Modular directory structure, strict TypeScript interfaces, unified error handling, reproducible database migrations.
