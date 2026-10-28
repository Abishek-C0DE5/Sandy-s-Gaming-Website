# Database Migrations Documentation

This document explains the version-controlled SQL migrations located in `supabase/migrations/`.

---

## Migration Index

| Migration File | Primary Domain | Tables / Functions Created | Key Security Controls & Constraints |
| :--- | :--- | :--- | :--- |
| `20261027000001_profiles.sql` | Profiles & Auth Sync | `public.profiles`<br>`public.handle_updated_at()`<br>`public.get_auth_role()`<br>`public.handle_new_user()` | 1:1 FK with `auth.users(id) ON DELETE CASCADE`. New signups restricted strictly to `'customer'` role. Role lookup helper function. |
| `20261027000002_posts_and_media.sql` | Content Publishing CMS | `public.posts`<br>`public.post_media` | Unique slug index. Normalized media assets table for multi-image galleries referencing Supabase Storage paths with MIME constraints. |
| `20261027000003_conversations_and_assignments.sql` | Multi-Admin Support Hub | `public.conversations`<br>`public.conversation_assignments`<br>`public.is_assigned_to_conversation()` | Many-to-many relationship mapping multiple admins to a customer conversation. **Partial Unique Index** (`idx_unique_active_assignment`) prevents duplicate active assignments while preserving historical audit logs. |
| `20261027000004_messages.sql` | Live-Chat Messages | `public.messages`<br>`public.maintain_conversation_last_message_at()` | Persistent chat messages retaining true `sender_id`. Automatic trigger updates `conversations.last_message_at` on message creation. |
| `20261027000005_contact_inquiries.sql` | Guest Contact Requests | `public.contact_inquiries`<br>`public.contact_inquiry_replies`<br>`public.handle_inquiry_reply_created()` | Completely decoupled from live chat tables. Public submission with zero public SELECT privileges. Auto-status update trigger on staff reply. |
| `20261027000006_audit_logs.sql` | Security Audit Trail | `public.audit_logs` | Immutable, append-only security logs for administrative interventions, role modifications, and assignments. |
| `20261027000007_security_policies.sql` | Row Level Security (RLS) | Tables RLS + Policies + Grants + Realtime Publication | Strict RLS across all 9 tables. Customer isolation, staff identity masking, public inquiry submission protection, and Supabase Realtime CDC publication. |
| `20261027000008_security_hardening.sql` | Role Escalation & Audit Guards | `trg_protect_profile_role`<br>`trg_protect_audit_logs` | Prevents unauthorized role escalation and enforces append-only immutability on audit logs. |
| `20261027000009_storage_policies.sql` | Storage RLS | Buckets `public-media`, `draft-media` | Restricts uploads to authorized staff and protects private media. |
| `20261027000010_email_delivery_lifecycle.sql` | Guest Inquiry Follow-ups | Columns on `contact_inquiry_replies` | Idempotency keys, retry tracking, and delivery statuses. |
| `20261027000011_realtime_broadcast_authorization.sql` | Realtime Broadcast Security | Policies on `realtime.messages`<br>`trg_broadcast_conversation_message` | Private broadcast authorization for conversation channels, RLS checks on `realtime.messages`, and instant database-triggered push. |

---

## Architectural Decisions & Constraints

### 1. Robust Active / Removal State in `conversation_assignments`
- **Design:** `status TEXT NOT NULL CHECK (status IN ('active', 'removed')) DEFAULT 'active'`
- **Constraint:**
  ```sql
  CREATE UNIQUE INDEX idx_unique_active_assignment 
    ON public.conversation_assignments(conversation_id, admin_id) 
    WHERE (status = 'active');
  ```
- **Rationale:** If an admin is unassigned from a customer's conversation, their active record's status is updated to `'removed'` and `removed_at` is stamped. Because the uniqueness constraint applies only `WHERE (status = 'active')`, the database simultaneously prevents accidental duplicate active assignments while preserving historical auditability of who handled the conversation previously.

### 2. Maintenance of `conversations.last_message_at`
- **Design:** Maintained via PostgreSQL trigger `maintain_conversation_last_message_at()` executing `AFTER INSERT ON public.messages`.
- **Rationale:** Ensures conversation sorting (`idx_conversations_last_message DESC`) remains lightning fast for Admin and Super Admin inboxes without requiring expensive aggregation (`MAX(created_at)`) queries across millions of messages.

### 3. Isolation of Guest Contact Inquiries from Live Chat
- **Design:** `contact_inquiries` and `contact_inquiry_replies` are physically separate tables from `conversations` and `messages`.
- **Rationale:** Guest visitors do not authenticate and do not have an `auth.uid()`. By keeping inquiries in separate tables, guest interactions cannot pollute customer live-chat state, cannot bypass RLS, and prevent malicious data injection into real-time channels.

---

## Regenerating Database TypeScript Definitions

When schema changes are deployed, regenerate the type definitions using:
```bash
# Using local Supabase instance
npx supabase gen types typescript --local > src/types/database.ts

# Using remote Supabase linked project
npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
```
