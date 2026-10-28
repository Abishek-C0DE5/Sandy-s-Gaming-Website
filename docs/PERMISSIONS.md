# Permissions & Row Level Security (RLS) Matrix

## 1. Role-Permission Matrix

| Resource / Action | Guest (Public) | Customer | Admin | Super Admin |
| :--- | :---: | :---: | :---: | :---: |
| **Browse Published Posts & Media** | Allowed | Allowed | Allowed | Allowed |
| **View Draft / Archived Posts** | Denied | Denied | Allowed | Allowed |
| **Create / Edit / Delete Posts** | Denied | Denied | Allowed | Allowed |
| **Submit Guest Contact Form** | Allowed | Allowed | Allowed | Allowed |
| **View Contact Inquiries** | Denied | Denied | Allowed (Assigned/Scoped) | Allowed (Global) |
| **Reply to Contact Inquiries (Email)**| Denied | Denied | Allowed | Allowed |
| **Initiate Live Chat** | Denied | Allowed (Own) | Denied (As Customer) | Denied (As Customer) |
| **View Live Chat Conversation** | Denied | Allowed (Own) | Allowed (Assigned Only)| Allowed (All) |
| **Send Message in Live Chat** | Denied | Allowed (Own) | Allowed (Assigned Only)| Allowed (All) |
| **Assign / Unassign Admins to Chat**| Denied | Denied | Denied | Allowed |
| **View Staff Sender Real Identity**| Denied | Denied ("Support Team")| Allowed | Allowed |
| **View / Manage Users & Roles** | Denied | Denied | Denied | Allowed |
| **View Audit Logs** | Denied | Denied | Denied | Allowed |
| **Manage Global System Settings** | Denied | Denied | Denied | Allowed |

---

## 2. Table Grants & RLS Audit Matrix

| Table | Role | SQL Grants (`GRANT`) | RLS Policy Name | Permitted Operations & Predicate |
| :--- | :--- | :--- | :--- | :--- |
| **`profiles`** | `anon` | None (`REVOKE ALL`) | N/A | None (Table completely inaccessible to anonymous visitors) |
| | `customer` | `SELECT`, `UPDATE` | `profiles_select_self_or_staff`<br>`profiles_update_self_safe` | **SELECT:** `id = auth.uid()`<br>**UPDATE:** `id = auth.uid()` (Role/status escalation locked via trigger + `WITH CHECK`) |
| | `admin` | `SELECT`, `UPDATE` | `profiles_select_self_or_staff` | **SELECT:** `get_auth_role() IN ('admin', 'super_admin')`<br>**UPDATE:** Self only (Cannot escalate role) |
| | `super_admin` | `SELECT`, `UPDATE`, `INSERT`, `DELETE` | `profiles_super_admin_all` | Full administrative control over all profile records and roles |
| **`posts`** | `anon` | `SELECT` | `posts_select_published` | **SELECT:** `status = 'published' AND published_at <= timezone('utc', now())` |
| | `customer` | `SELECT` | `posts_select_published` | **SELECT:** Same as public (published posts only) |
| | `admin` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `posts_select_published`<br>`posts_staff_write`<br>`posts_staff_update`<br>`posts_staff_delete` | Full read of drafts/published. Write/Update any post. Delete if `author_id = auth.uid()` |
| | `super_admin` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Same as admin + unrestricted delete | Unrestricted content management and deletion |
| **`post_media`** | `anon` | `SELECT` | `post_media_select` | **SELECT:** Read media metadata attached to published posts |
| | `customer` | `SELECT` | `post_media_select` | **SELECT:** Same as public |
| | `admin` | `ALL` | `post_media_staff_write` | Full media management for post assets |
| | `super_admin` | `ALL` | `post_media_staff_write` | Full media management |
| **`conversations`**| `anon` | None (`REVOKE ALL`) | N/A | None (Live chat requires authenticated customer or staff session) |
| | `customer` | `SELECT`, `INSERT`, `UPDATE` | `conversations_select`<br>`conversations_insert_customer`<br>`conversations_update` | **SELECT/UPDATE:** `customer_id = auth.uid()`<br>**INSERT:** `customer_id = auth.uid()` |
| | `admin` | `SELECT`, `UPDATE` | `conversations_select`<br>`conversations_update` | **SELECT/UPDATE:** Only if actively assigned (`is_assigned_to_conversation(id)`) |
| | `super_admin` | `SELECT`, `INSERT`, `UPDATE`, `DELETE`| All conversation policies | Unrestricted global oversight of all customer conversations |
| **`conversation_assignments`** | `anon` | None (`REVOKE ALL`) | N/A | None |
| | `customer` | None (`REVOKE ALL`) | N/A | **Zero access:** Customer cannot select or discover assigned staff personas |
| | `admin` | `SELECT` | `assignments_select_assigned_or_super_admin` | **SELECT:** Only their own assignment records (`admin_id = auth.uid()`) |
| | `super_admin` | `ALL` | `assignments_super_admin_manage` | Can assign, unassign, and audit all staff memberships |
| **`messages`** | `anon` | None (`REVOKE ALL`) | N/A | None |
| | `customer` | `SELECT`, `INSERT` | `messages_select`<br>`messages_insert` | **SELECT/INSERT:** Messages belonging strictly to own conversation (`customer_id = auth.uid()`). `sender_id` must match `auth.uid()`. |
| | `admin` | `SELECT`, `INSERT` | `messages_select`<br>`messages_insert` | **SELECT/INSERT:** Only if currently assigned (`is_assigned_to_conversation(conversation_id)`) |
| | `super_admin` | `SELECT`, `INSERT`, `DELETE` | `messages_select`<br>`messages_insert`<br>`messages_super_admin_delete` | Can view, post into, or remove any message across all chats |
| **`contact_inquiries`** | `anon` | `INSERT` | `contact_inquiries_insert_public` | **INSERT ONLY:** Anonymous visitors can submit inquiries (`WITH CHECK (true)`). **SELECT/UPDATE/DELETE revoked.** Prevents enumeration. |
| | `customer` | `INSERT` | `contact_inquiries_insert_public` | Same as public: can submit inquiries, cannot browse or query table |
| | `admin` | `SELECT`, `UPDATE` | `contact_inquiries_staff_select`<br>`contact_inquiries_staff_update` | **SELECT/UPDATE:** Can view and manage inquiry status/triage |
| | `super_admin` | `ALL` | `contact_inquiries_super_admin_delete` | Can view, update, triage, or purge inquiry records |
| **`contact_inquiry_replies`** | `anon` | None (`REVOKE ALL`) | N/A | None (Guest replies are delivered externally via transactional email) |
| | `customer` | None (`REVOKE ALL`) | N/A | None |
| | `admin` | `SELECT`, `INSERT` | `inquiry_replies_staff_select`<br>`inquiry_replies_staff_insert` | Can view replies and record staff outbound replies |
| | `super_admin` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Staff policies + Super admin rights | Full oversight of inquiry reply history |
| **`audit_logs`** | `anon` | None (`REVOKE ALL`) | N/A | None |
| | `customer` | None (`REVOKE ALL`) | N/A | None |
| | `admin` | `INSERT` | `audit_logs_authenticated_insert` | **INSERT ONLY:** Can record operational actions (`actor_id = auth.uid()`). **SELECT DENIED.** |
| | `super_admin` | `SELECT`, `INSERT` | `audit_logs_super_admin_select`<br>`audit_logs_authenticated_insert` | **SELECT:** Unrestricted audit view.<br>**UPDATE/DELETE:** Blocked at DB trigger level (immutable append-only). |

---

## 3. Row Level Security (RLS) Policy Specifications

### 2.1 Helper Functions (PostgreSQL)
To ensure reliable, non-recursive, high-performance role evaluation:
```sql
-- Returns the role of the calling user from profiles
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Checks if calling user is an active assigned admin for a conversation
CREATE OR REPLACE FUNCTION public.is_assigned_to_conversation(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_assignments
    WHERE conversation_id = conv_id
      AND admin_id = auth.uid()
      AND status = 'active'
  );
$$;
```

---

### 2.2 Table-by-Table RLS Policies

#### 1. `profiles`
- **SELECT:**
  - Self: `id = auth.uid()`
  - Staff: `get_auth_role() IN ('admin', 'super_admin')`
- **INSERT:**
  - Automated via auth trigger (`on_auth_user_created`), role defaults strictly to `'customer'`.
- **UPDATE:**
  - Self: `id = auth.uid()` (WITH CHECK: `role = OLD.role AND account_status = OLD.account_status` to prevent privilege self-escalation).
  - Super Admin: `get_auth_role() = 'super_admin'` can update roles and statuses.
- **DELETE:**
  - Super Admin only.

#### 2. `posts`
- **SELECT:**
  - Public & Customer: `status = 'published' AND (published_at IS NULL OR published_at <= timezone('utc', now()))`
  - Staff: `get_auth_role() IN ('admin', 'super_admin')`
- **INSERT / UPDATE:**
  - Staff: `get_auth_role() IN ('admin', 'super_admin')`
- **DELETE:**
  - Super Admin: `get_auth_role() = 'super_admin'` (or Admin if author).

#### 3. `post_media`
- **SELECT:**
  - Accessible if parent post in `posts` is readable.
- **INSERT / UPDATE / DELETE:**
  - Staff: `get_auth_role() IN ('admin', 'super_admin')`.

#### 4. `conversations`
- **SELECT:**
  - Customer: `customer_id = auth.uid()`
  - Admin: `is_assigned_to_conversation(id)`
  - Super Admin: `get_auth_role() = 'super_admin'`
- **INSERT:**
  - Customer: `customer_id = auth.uid()`
- **UPDATE:**
  - Customer: `customer_id = auth.uid()` (limited fields: `subject`, `status = 'closed'`)
  - Admin: `is_assigned_to_conversation(id)`
  - Super Admin: `get_auth_role() = 'super_admin'`
- **DELETE:**
  - Super Admin only.

#### 5. `conversation_assignments`
- **SELECT:**
  - Admin: `admin_id = auth.uid()`
  - Super Admin: `get_auth_role() = 'super_admin'`
  - *(Customers have NO select privilege on this table; preventing disclosure of assigned staff).*
- **INSERT / UPDATE / DELETE:**
  - Super Admin: `get_auth_role() = 'super_admin'`.

#### 6. `messages`
- **SELECT:**
  - Customer: `conversation_id IN (SELECT id FROM conversations WHERE customer_id = auth.uid())`
  - Admin: `is_assigned_to_conversation(conversation_id)`
  - Super Admin: `get_auth_role() = 'super_admin'`
- **INSERT:**
  - Must satisfy conversation access AND `sender_id = auth.uid()`.
- **UPDATE / DELETE:**
  - Sender within 5 minutes (for typo edits) OR Super Admin.

#### 7. `contact_inquiries`
- **SELECT:**
  - Staff only: `get_auth_role() IN ('admin', 'super_admin')`.
  - *(Public users have ZERO SELECT access to prevent data enumeration).*
- **INSERT:**
  - Public anonymous access enabled via server-side Route Handler with service validation or direct insert policy with rate limiting.
- **UPDATE / DELETE:**
  - Staff only: `get_auth_role() IN ('admin', 'super_admin')`.

#### 8. `contact_inquiry_replies`
- **SELECT:**
  - Staff only: `get_auth_role() IN ('admin', 'super_admin')`.
- **INSERT / UPDATE:**
  - Staff only: `get_auth_role() IN ('admin', 'super_admin')` and `admin_id = auth.uid()`.

#### 9. `audit_logs`
- **SELECT:**
  - Super Admin only: `get_auth_role() = 'super_admin'`.
- **INSERT:**
  - Authenticated staff or system triggers.
- **UPDATE / DELETE:**
  - Strictly **DENIED** (Audit logs are append-only/immutable).
