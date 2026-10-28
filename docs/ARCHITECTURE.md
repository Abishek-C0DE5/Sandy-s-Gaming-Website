# Architecture & System Design Document

## 1. High-Level System Architecture

The application adopts a modern, decoupled JAMstack/Serverless architecture utilizing Next.js (App Router) on the frontend/application tier and Supabase (PostgreSQL, Auth, Realtime, Storage) on the backend tier.

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|  +--------------------+  +----------------------+  +---------------------------+  |
|  |   Public Visitor   |  | Authenticated Client |  | Staff (Admin/Super Admin) |  |
|  | (Browsing/Contact) |  |  (Live Chat Portal)  |  |   (Operational Dashboards)|  |
|  +--------------------+  +----------------------+  +---------------------------+  |
+---------------------------+-----------------------------------+-------------------+
                            |                                   |
                            v                                   v
+-----------------------------------------------------------------------------------+
|                        APPLICATION LAYER (Next.js App Router)                     |
|                                                                                   |
|  +-------------------------------------+  +------------------------------------+  |
|  |     Server Components & Pages       |  |       API / Route Handlers         |  |
|  |  - (public): Blogs, Posters, Gallery|  |  - POST /api/contact               |  |
|  |  - (auth): Login, OTP Verification  |  |  - POST /api/contact-replies       |  |
|  |  - (customer): Chat View            |  |  - POST /api/chat                  |  |
|  |  - admin/: Inbox, Content, Inquiries|  |  - POST /api/admin/assignments     |  |
|  |  - super-admin/: Users, Logs, Config|  |  - POST /api/admin/users           |  |
|  +-------------------------------------+  +------------------------------------+  |
|                                     |                     |                       |
|                 +-------------------+---------------------+                       |
|                 | Zod Validation & Server-Side Role Enforcement (SSR / Actions)    |
+-----------------+-----------------------------------------+-----------------------+
                  |                                         |
                  v                                         v
+-----------------------------------------------------------------------------------+
|                                DATA SERVICES (Supabase)                           |
|                                                                                   |
|  +------------------+  +-------------------+  +-----------------+  +------------+ |
|  |  Supabase Auth   |  |   PostgreSQL 15   |  |Supabase Realtime|  |  Supabase  | |
|  | (Passwordless    |  |  (Relational Data |  | (WebSockets/    |  |  Storage   | |
|  |   OTP via Email/ |  |   + Row Level     |  |  Postgres CDC   |  | (Post Media| |
|  |   Phone SMS)     |  |     Security RLS) |  |  Pub/Sub)       |  |  & Assets) | |
|  +------------------+  +-------------------+  +-----------------+  +------------+ |
+-----------------------------------------------------------------------------------+
                  |                                         |
                  v                                         v
+------------------------------------+   +------------------------------------------+
|  TRANSACTIONAL EMAIL SERVICE       |   | AUDIT LOGGING & SECURITY MONITORS        |
|  (Resend / SendGrid / Postmark)    |   | PostgreSQL `audit_logs` + Server Monitors|
+------------------------------------+   +------------------------------------------+
```

---

## 2. Key Architecture Principles

### 2.1 Defense in Depth
1. **Frontend / Route Protection:** Next.js Middleware and Layout checks prevent unauthorized page access and route leaks.
2. **Server-Side Validation:** All API endpoints and Route Handlers strictly validate payloads using Zod before calling data services.
3. **Database Security (RLS):** Every PostgreSQL table has Row Level Security enabled. Database policies enforce user-level and role-level isolation even if server application logic has bugs.

### 2.2 Shared Conversation Model for Multi-Admin Support
Unlike legacy ticketing systems that duplicate tickets or transfer sessions across agents, our architecture maintains a **single canonical conversation** per customer:
- `conversations` records customer-level threads.
- `conversation_assignments` associates multiple admin IDs with a single `conversation_id`.
- `messages` references the `conversation_id` and records the true `sender_id`.
- **View Masking:** When customer views staff messages, client-side/server-side serializing replaces staff metadata with the persona "Support Team". When admins or super admins view the conversation, the true `sender_id` and admin profile are exposed.

```
Conversation C100 (Customer: Alice)
  ├── Assignment: Admin Bob
  ├── Assignment: Admin Carol
  └── Messages:
       ├── M1: Alice: "Help with setup"               (True Sender: Alice)
       ├── M2: Bob: "Checking this now"               (Customer sees: Support Team; Staff sees: Bob)
       └── M3: Carol: "Updated your settings"         (Customer sees: Support Team; Staff sees: Carol)
```

### 2.3 Guest Contact Request vs Authenticated Chat Separation
- **Guest Inquiries (`contact_inquiries`):**
  - Completely unauthenticated.
  - Insert-only for anonymous users through rate-limited API route.
  - Staff replies write to `contact_inquiry_replies` and dispatch an email via a transactional email provider.
- **Authenticated Chat (`conversations` / `messages`):**
  - Requires authenticated session (`auth.uid()`).
  - Read/write access strictly governed by `conversations.customer_id = auth.uid()` or an active record in `conversation_assignments` or `role = 'super_admin'`.

---

## 3. Realtime Flow Architecture

### 3.1 Architecture Overview & PostgreSQL Source of Truth
Real-time delivery operates strictly on top of persistent PostgreSQL storage. Real-time broadcast packets never replace stored history; they provide instantaneous zero-latency UI updates without requiring page refreshes or periodic polling.

```
[ Customer Browser ]                [ Next.js API / PostgreSQL ]              [ Assigned Admins ]
        |                                        |                                     |
        |--- 1. POST /api/conversations/[id] --->|                                     |
        |    (Validates token & saves to DB)     |                                     |
        |                                        |-- 2. Commit to public.messages      |
        |                                        |                                     |
        |                                        |-- 3. Broadcast Event to Channel ---->
        |<-- 4. Receive 'new_message' via WS ----+-- 4. Receive 'new_message' via WS --|
        |    (Masked as "Support Team")          |       (Displays true staff author)  |
```

### 3.2 Channel Topic Convention & Private Scoping
- **Standard Format:** `conversation:<conversation_id>` (UUID-scoped).
- **Security Mode:** `config: { private: true, broadcast: { ack: true } }`. Unrestricted public channels are strictly forbidden for private customer conversations.
- **Authorization Enforcement:**
  - Evaluated on `realtime.messages` via PostgreSQL RLS policies (`realtime_conversation_select` and `realtime_conversation_insert`).
  - Allowed listeners: Conversation customer owner, actively assigned staff (`conversation_assignments.status = 'active'`), and Super Admin.
  - Unauthorized clients (unassigned admins or unrelated customers) are rejected at the WebSocket server level (`CHANNEL_ERROR: Unauthorized: You do not have permissions to read from this Channel topic`).

### 3.3 Dual-Path Delivery Pipeline
1. **Primary Database Trigger (`trg_broadcast_conversation_message`):**
   - Fires `AFTER INSERT ON public.messages`.
   - Inserts sanitized payload directly into `realtime.messages`, causing the Realtime server to stream the packet via WAL replication.
2. **Server Broadcast Dispatch (`broadcastConversationEvent`):**
   - In Next.js route handlers (`POST /api/conversations/[id]/messages`), after successful database commit, the server dispatches a broadcast event via the service role client.
   - Dual-path ensures instant delivery even if database extension queues experience transient latency.

### 3.4 Identity Masking Protocol
- **Customer View:** All staff authors are rendered as `"Support Team"` with a verified specialist badge. Raw staff UUIDs and internal email handles are hidden on customer UI streams.
- **Staff View:** Staff colleagues see the actual author (`true_sender_name`) for accountability and collaboration.

### 3.5 Reconnection & Deduplication
- **Deduplication Engine:** Clients maintain a local message cache keyed by `id`. When a message arrives via Realtime, the client verifies `prev.some(m => m.id === newMsg.id)` before insertion, and matches optimistic pending messages by body/timestamp.
- **Network Reconnection:** On reconnect, the client syncs from PostgreSQL via `GET /api/conversations/[id]/messages`, ensuring zero dropped messages during offline periods with zero visible duplicates.

### 3.6 Immediate Revocation Severance
When a Super Admin unassigns an admin (`DELETE /api/conversations/[id]/assignments`):
1. Database marks `conversation_assignments.status = 'removed'`.
2. Server broadcasts `assignment_revoked` with `{ admin_id }`.
3. The removed admin's client intercepts the event, immediately unmounts the WebSocket channel (`supabase.removeChannel`), locks the message textarea, and displays an access revocation notice.
4. Any attempt by the removed admin to reconnect or send messages is denied at both the WebSocket level and PostgreSQL RLS level (`403/404`).

---

## 4. Storage Architecture & Content Management Workflow

### 4.1 Bucket Segregation (Least-Privilege Storage Intent)
Storage assets are strictly segregated into two dedicated Supabase Storage buckets based on publishing intent:
- **`public-media` (Public Bucket):**
  - **Purpose:** Published blog cover images, poster graphics, and photography assets.
  - **Read Access:** Public visitors (anonymous) and authenticated users have direct read access.
  - **Write Access:** Restricted exclusively to staff (`admin` and `super_admin`) via storage RLS policies and server-side validation.
  - **Constraints:** 5MB max file size; permitted MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`.
- **`draft-media` (Private Bucket):**
  - **Purpose:** Unpublished drafts, confidential prototypes, and work-in-progress content.
  - **Read Access:** Strictly forbidden to public visitors (returns HTTP 400/403). Requires authenticated staff sessions generating time-limited signed URLs (`createSignedUrl`).
  - **Write Access:** Restricted exclusively to staff (`admin` and `super_admin`).
  - **Constraints:** 5MB max file size; permitted MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`.
- **Private Chat Attachments:**
  - Out of scope for this phase.

### 4.2 Server-Side Upload Verification & Sanitization
All client media uploads flow through `POST /api/admin/media/upload`:
1. Authenticates user session and validates staff role (`admin` or `super_admin`) and active account status.
2. Inspects file MIME type against whitelist (`image/jpeg`, `image/png`, `image/webp`, `image/avif`). Disallowed types (`.exe`, `.html`, `.sh`, `text/plain`) are rejected with HTTP 400.
3. Enforces strict file size ceiling (<= 5MB).
4. Generates a cryptographically random, sanitized storage path (`uploads/${Date.now()}_${randomUUID}.${ext}`), never trusting client-supplied file names or directory paths.
5. Emits an immutable audit log entry in `audit_logs` recording the actor ID, bucket, storage path, file size, and draft status.

### 4.3 Orphan Asset Prevention & Lifecycle Management
To prevent orphaned storage binaries from accumulating:
1. **Asset Replacement:** When an existing post is updated via `PATCH /api/admin/posts/[id]` with a new cover image URL, the server extracts the old storage path and invokes `storage.from(bucket).remove([oldPath])`.
2. **Post Deletion:** When a post is deleted via `DELETE /api/admin/posts/[id]`, the server queries the cover image and all records in `post_media`, cascades the database deletion, and purges all associated binaries from Supabase Storage.
3. **Audit Logging:** Every post creation, update, and deletion is recorded in `audit_logs` with actor and target IDs.

---

## 5. Transactional Email Follow-Up Architecture

### 5.1 Provider Adapter Pattern
Email delivery for guest Contact Us responses utilizes a pluggable `EmailAdapter` interface (`src/lib/email/adapter.ts`):
- **Supported Providers:** Resend (`https://api.resend.com/emails`), SendGrid v3 (`https://api.sendgrid.com/v3/mail/send`), Postmark (`https://api.postmarkapp.com/email`).
- **Unconfigured Fallback:** When `EMAIL_API_KEY` is not present in `.env.local`, the system automatically resolves `UnconfiguredEmailAdapter`.
  - Dispatches return `{ success: false, status: 'pending', isConfigured: false }`.
  - Responses are safely recorded as internal drafts in PostgreSQL without falsely claiming delivery.
  - The UI clearly labels records as `"Draft / Pending Dispatch"`.

### 5.2 Delivery Lifecycle & Granular States
To avoid misleading delivery claims, the system tracks specific states:
- **`pending`**: Saved locally as draft; awaiting provider dispatch or credentials.
- **`queued` / `accepted`**: Provider accepted message for queueing/dispatch (e.g. Resend `id` or SendGrid `X-Message-Id` returned).
- **`sent`**: Transmitted to upstream relay.
- **`delivered`**: Confirmed delivered to recipient inbox (requires webhook receipt).
- **`failed` / `bounced`**: Provider reported transport error or delivery failure. Safe error recorded in `last_delivery_error`.

### 5.3 Idempotency & Duplicate Send Prevention
- Every send request attaches a client- or server-generated `idempotencyKey`.
- If an admin clicks "Send" multiple times or network latency delays a response, the server detects the existing record and avoids duplicate provider dispatch.
- Retries on already accepted/sent emails are strictly blocked.

### 5.4 Retry Mechanism & Safeguards
- When a dispatch fails or remains pending, authorized staff can click **"Retry Send"** on `/admin/contact-requests/[id]`.
- The endpoint `POST /api/admin/contact-requests/[id]/replies/[replyId]/retry` increments `retry_count`, updates `last_attempted_at`, enforces a maximum ceiling of 5 attempts, and logs `INQUIRY_REPLY_RETRIED` in `audit_logs`.

### 5.5 Privacy & Third-Party Isolation
- Email replies strictly transmit the customer's email and message copy.
- The customer's phone number is **never** transmitted to email providers or SMS gateways.
---

## 6. Authenticated Live-Chat & PostgreSQL Messaging Architecture

### 6.1 PostgreSQL as the Ground Truth
Live-chat messages are persistently stored and authorized via PostgreSQL before being confirmed as sent:
- **`conversations`**: Single shared thread per active support topic (`customer_id`, `subject`, `status`, `last_message_at`, `closed_at`).
- **`conversation_assignments`**: Many-to-many relationship mapping multiple specialists to a single conversation. Partial unique index `idx_unique_active_assignment` ensures an admin has at most one active assignment per thread while preserving historical records.
- **`messages`**: Chronological messages referencing `conversation_id`, actual `sender_id`, and `body` (length bounded between 1 and 5000 characters).
- **Trigger `maintain_conversation_last_message_at`**: Automatically touches `conversations.last_message_at` and `updated_at` on message creation, ensuring fast inbox ordering without expensive table aggregations.

### 6.2 Strict Server-Derived Sender Identity
To prevent identity spoofing or tampering:
- Any `sender_id` supplied in incoming JSON payloads is discarded.
- The server extracts the sender identity strictly from `supabase.auth.getUser()`.
- RLS policies enforce `WITH CHECK (sender_id = auth.uid())` at the database engine level.

### 6.3 Shared Conversation Model (Multi-Admin)
- Assigned admins and Super Admins read and reply through the exact same conversation ID (`/admin/conversations/[id]`).
- The system does not spawn fragmented per-admin chats; all specialists assigned to a customer collaborate in the same thread.

### 6.4 Role-Aware Identity Masking & Privacy (Requirement 11)
- **Customer View (`/chat`)**: All staff replies are generically rendered as **`Support Team`**. Individual specialist names, roles, and user IDs are not leaked in the customer API response.
- **Staff View (`/admin/conversations/[id]`)**: Full real attribution is rendered (e.g. "Customer Alice", "Admin Bob", "Super Admin Carol"), allowing supervisors and peers to see exactly which specialist answered each inquiry.

---

## 7. Multi-Admin Assignment & Access Severance Architecture

### 7.1 Shared Conversation Mapping (`conversation_assignments`)
- Rather than duplicating customer conversations or messages across specialists, the system utilizes a normalized relational mapping table `public.conversation_assignments`.
- **Columns**: `id`, `conversation_id`, `admin_id`, `assigned_by`, `status` (`'active'` | `'removed'`), `assigned_at`, `removed_at`.
- **Partial Unique Index**:
  ```sql
  CREATE UNIQUE INDEX idx_unique_active_assignment 
    ON public.conversation_assignments(conversation_id, admin_id) 
    WHERE (status = 'active');
  ```
  Guarantees that an admin cannot hold duplicate active assignments on the same thread, while allowing historical records with `status = 'removed'` to coexist for auditable tracking.

### 7.2 Authorization Matrix & Target Account Validation
- **Super Admin Sole Authority**: Only authenticated Super Admins (`role = 'super_admin'`) may invoke assignment mutations (`POST` / `DELETE` on `/api/conversations/[id]/assignments`). Any regular admin or customer attempting assignment changes receives `403 Forbidden`.
- **Target Account Rules**:
  - Target user must exist in `public.profiles`.
  - Target user must hold an administrative role (`admin` or `super_admin`). Customers are strictly rejected (`400 Bad Request`).
  - Target account status must be `active`. Suspended or disabled staff accounts are barred from assignment (`400 Bad Request`).

### 7.3 Immediate Access Severance
- When a specialist is removed from a thread:
  1. The server executes:
     ```sql
     UPDATE public.conversation_assignments 
     SET status = 'removed', removed_at = timezone('utc', now()) 
     WHERE id = target_id;
     ```
  2. The PostgreSQL security helper `is_assigned_to_conversation(conv_id)` immediately evaluates to `false` for that admin.
  3. Table-level RLS policies on `conversations` and `messages` automatically revoke `SELECT` and `INSERT` capabilities, returning 0 rows immediately.
  4. API endpoints re-verify active assignment status, preventing UI-only access bypass.

### 7.4 Auditable Trail
Every assignment addition and removal logs an immutable event to `public.audit_logs`:
- **`CONVERSATION_ASSIGNED`**: Emitted with `actor_id` (Super Admin), `target_type: 'conversation_assignment'`, `target_id`, and metadata containing `conversation_id`, `admin_id`, `admin_name`, and timestamp.
- **`CONVERSATION_UNASSIGNED`**: Emitted with `actor_id` (Super Admin), `target_type: 'conversation_assignment'`, `target_id`, and metadata containing `conversation_id`, `admin_id`, and `removed_at`.




