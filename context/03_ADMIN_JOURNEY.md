# Click — Admin Journey
> Developer implementation spec. Covers every admin workflow, access control requirement, moderation process, and data operation. All admin actions must be audit-logged. No admin action should be reversible without a trace.

---

## 0. Design Constraints

- **Every write action by an admin is logged** in `admin_audit_log` — no exceptions. Implement as a reusable `logAdminAction()` utility that wraps the write.
- **Admin access requires MFA.** Enforce at auth layer. Block portal access if MFA is not enabled on the account.
- **RLS exemption is narrow.** Admins get a service-role query path for reads, but writes still go through application layer with audit logging — not raw DB access.
- **No admin action is instantaneous for destructive operations.** Bans, deletions, and financial overrides require a confirmation dialog with reason field (min 20 chars).
- **Admin accounts can only be created by existing admins.** No self-registration path. No edge function or API endpoint should grant `role = 'admin'` without an existing admin as the actor.

---

## 1. Access Control

### Route guard
```
/admin-portal/*
  │
  ▼
Check: auth.uid() exists AND user_roles.role = 'admin'
  ├─ Pass: render portal
  └─ Fail: redirect to / (no 403 page — don't confirm admin portal exists to non-admins)
```

### Admin account creation
- Only via Supabase dashboard or an existing admin running:
  ```sql
  INSERT INTO user_roles(user_id, role) VALUES('<uid>', 'admin');
  -- This insert is itself audit-logged via trigger
  ```
- No `/admin/register` route exists or should ever exist

### MFA requirement
- On login, after JWT issued: check `auth.users.factors` — if empty, redirect to MFA setup before portal loads
- Portal is unreachable without MFA enrolled

### Role switching
- An account can hold multiple roles (admin + merchant + user)
- Header dropdown lets the same `auth.uid()` switch dashboards without re-login
- Switching is cosmetic only — RLS policies enforce actual data access per role

---

## 2. Admin Portal Structure

| Tab | Purpose | Primary data source |
|---|---|---|
| Platform Analytics | Growth, revenue, engagement overview | Aggregates across all tables |
| Merchant Approvals | Review pending merchant applications | `merchants WHERE status='pending'` |
| Event Moderation | Review pending events, flag/unpublish | `events WHERE status='pending_review'` |
| User Moderation | View, flag, suspend, or ban users | `profiles`, `user_roles` |
| Tag Management | CRUD on interest tag taxonomy | `interest_tags`, `categories` |
| Financial Review | Stripe transaction audit, failed refunds | `payment_transactions` |
| Audit Log | All admin actions, chronological | `admin_audit_log` |
| System Settings | Maintenance mode, commission rate | `platform_settings` |

---

## 3. Merchant Approvals

This is the most critical admin workflow. A merchant is locked out of all event creation until approved here.

### Queue view
- List of `merchants WHERE status = 'pending'`, ordered by `submitted_at ASC` (oldest first)
- Columns: business_name, ABN, contact_email, business_type, submitted_at, documents (linked)
- Document links are Supabase signed URLs (30-minute expiry) — generate on demand, not on page load

### Approval flow
```
Admin opens merchant application
  │
  ▼
Admin reviews:
  ✓ ABN validity (pre-validated on submission — show result)
  ✓ Insurance document uploaded and not expired
  ✓ Business name not already active in system
  ✓ No prior rejection / ban on this user account
  │
  ├─ Approve:
  │    UPDATE merchants SET status='approved', verified_at=now(), verified_by=auth.uid()
  │    INSERT INTO user_roles(user_id, role='merchant') -- if not already present
  │    logAdminAction('merchant_approved', merchant_id)
  │    Edge fn: send-merchant-approval-email
  │
  └─ Reject:
       Admin must enter rejection_reason (required, min 20 chars)
       UPDATE merchants SET status='rejected', rejection_reason, rejected_by=auth.uid()
       logAdminAction('merchant_rejected', merchant_id, {reason})
       Edge fn: send-merchant-rejection-email (includes reason + resubmit instructions)
```

**Edge case:** Merchant resubmits after rejection. A new `merchants` row is created (or existing row updated — define one approach, don't allow both). Prior rejection history must remain visible to admins on the new application. Implement via `merchant_application_history` table or a `previous_application_id` FK.

**Edge case:** Admin approves merchant whose Stripe Connect onboarding is incomplete. This is valid — Stripe onboarding can happen after approval. But merchant cannot create paid events until `stripe_account_id` is set.

---

## 4. Event Moderation

### Queue view
- List of `events WHERE status = 'pending_review'`, ordered by `published_at ASC`
- Columns: title, merchant_name, category, tags, start_time, price, submitted_at

### Review checklist (admin validates before approving)
- [ ] Title is accurate and not misleading
- [ ] Category and interest tags are correct and not spam
- [ ] Photos are appropriate (not offensive, not stock-photo spam)
- [ ] No duplicate event already active from same merchant at same time
- [ ] Paid events: merchant has Stripe Connect account (`stripe_account_id IS NOT NULL`)
- [ ] External booking URL is valid and loads (manual check)

### Approval flow
```
Admin approves event
  │
  ▼
UPDATE events SET status='published', approved_at=now(), approved_by=auth.uid()
logAdminAction('event_approved', event_id)
  │
  ▼
Event appears in /events feed immediately
```

```
Admin rejects event
  │
  ▼
Admin enters rejection_reason (required)
UPDATE events SET status='rejected', rejection_reason, rejected_by=auth.uid()
logAdminAction('event_rejected', event_id, {reason})
Edge fn: send-event-rejection-email (merchant notified with reason + edit instructions)
```

### Unpublish (live event takedown)
```
Admin unpublishes a live event (flags or reports trigger this)
  │
  ▼
UPDATE events SET status='unpublished', unpublished_reason, unpublished_by, unpublished_at
logAdminAction('event_unpublished', event_id, {reason})
  │
  ├─ Auto-refund option: admin checkbox "Issue refunds to confirmed attendees"
  │    If checked: trigger cancel-refund edge fn (same as merchant cancellation)
  │
  └─ Attendee notification:
       Resend email to all confirmed attendees: "Event unavailable — refund initiated"
```

**This is a destructive action.** Require confirmation dialog with reason field before executing.

---

## 5. User Moderation

### User list
- Paginated list of `profiles` with filters: verified / unverified / flagged / suspended / banned
- Columns: name, email, join date, intent, last active, flag count

### Moderation actions

| Action | DB change | Audit log | User notified |
|---|---|---|---|
| View profile | Read-only | ❌ | ❌ |
| Flag for review | `profiles.flagged = true, flag_reason` | ✅ | ❌ |
| Suspend (temp) | `profiles.suspended_until = timestamp` | ✅ | ✅ (email) |
| Ban (permanent) | `profiles.is_banned = true, ban_reason, banned_at, banned_by` | ✅ | ✅ (email) |
| Restore | Reverse above flags | ✅ | ✅ (email) |
| Force email re-verification | `auth.users.email_confirmed_at = NULL` | ✅ | ✅ |

**Suspension and ban gate (enforce in RLS):**
```sql
-- Banned or suspended users cannot log in or perform actions
-- Check on every request via a helper function:
CREATE OR REPLACE FUNCTION is_user_active(uid uuid)
RETURNS boolean AS $$
  SELECT NOT (
    is_banned = true OR
    (suspended_until IS NOT NULL AND suspended_until > now())
  )
  FROM profiles WHERE id = uid;
$$ LANGUAGE sql SECURITY DEFINER;
```

**Reporting flow:**
- Users can report other users or events from the UI
- Reports write to `user_reports(reporter_id, target_type, target_id, reason, created_at)`
- Admins see open reports in User Moderation tab
- Each report has: Open / Under Review / Resolved / Dismissed status
- Resolving a report requires an admin action (ban, suspend, dismiss) + reason

---

## 6. Tag Management

Interest Tags are admin-curated. Life Tags are system-generated (quiz outputs) — admins cannot delete them, only archive.

### Tag operations

| Operation | Where | Notes |
|---|---|---|
| Create tag | Admin → Tag Management → New Tag | Requires: label, category, type (user/event/both) |
| Edit tag label | Admin → Tag Management → Edit | Cascades to all profiles + events using the tag ID — ID never changes |
| Merge tags | Admin → Tag Management → Merge | Combines tag A into tag B; all references to A updated to B; A archived |
| Archive tag | Admin → Tag Management → Archive | Tag no longer appears in selection UI; existing references preserved |
| Delete tag | Not available in UI | Raw DB only; requires confirming no references exist first |

**Merge is a destructive operation.** Confirm dialog listing: "X user profiles and Y events will be updated." Require admin to type the source tag name to confirm.

**Tag categories** are also admin-managed: create / rename / reorder. Deleting a category is blocked if any tags reference it.

---

## 7. Financial Review

### View
- All `payment_transactions` across all merchants
- Filters: date range, status (completed / failed / refunded / disputed), merchant

### Admin actions on transactions
| Action | When | DB change |
|---|---|---|
| Mark refund resolved | Failed refund manually processed outside Stripe | `payment_transactions.refund_status = 'resolved_manual', resolved_by, resolved_at` |
| Initiate manual refund | Stripe UI doesn't cover edge case | Admin calls Stripe directly; then marks in DB |
| Flag transaction | Potential dispute | `payment_transactions.flagged = true, flag_reason` |

**Platform commission rate** is set in `platform_settings.commission_rate` (decimal). Changing this affects all future bookings. Admin must confirm change. Log: `logAdminAction('commission_rate_changed', null, {old_rate, new_rate})`.

---

## 8. Audit Log

Every admin action writes to `admin_audit_log`:

```sql
CREATE TABLE admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid REFERENCES auth.users(id),
  action      text NOT NULL,         -- e.g. 'merchant_approved', 'user_banned'
  target_type text,                  -- 'merchant' | 'user' | 'event' | 'tag' | 'setting'
  target_id   uuid,
  metadata    jsonb,                 -- reason, old/new values, etc.
  created_at  timestamptz DEFAULT now()
);

-- RLS: admin read only
CREATE POLICY "audit_log_admin_read" ON admin_audit_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
-- No update or delete policy — audit log is append-only
```

### `logAdminAction()` utility
```typescript
// src/utils/admin/audit-logger.ts
async function logAdminAction(
  action: string,
  targetId: string | null,
  metadata?: Record<string, unknown>
) {
  await supabase.from('admin_audit_log').insert({
    admin_id: currentAdminUid,
    action,
    target_id: targetId,
    metadata: metadata ?? {},
  });
}
```

**Wrap every admin write with this.** It should be called inside the same transaction as the primary write where possible, so a DB failure doesn't produce a write with no audit record.

### Audit log view (Admin Portal)
- Paginated table, newest first
- Filters: admin (actor), action type, date range, target type
- Columns: timestamp, admin name, action, target (link to record), metadata summary
- Export to CSV available

---

## 9. Platform Analytics Dashboard

All metrics read from live DB. No caching layer at MVP — add if query latency becomes a problem.

| Metric | Query |
|---|---|
| Total users (all time) | `COUNT(profiles)` |
| New users (this week/month) | `COUNT(profiles WHERE created_at > ...)` |
| Total events (published) | `COUNT(events WHERE status='published')` |
| Total bookings (confirmed) | `COUNT(event_bookings WHERE status='confirmed')` |
| Total platform revenue | `SUM(event_bookings.amount_paid) * commission_rate` |
| Active merchants | `COUNT(merchants WHERE status='approved')` |
| Top categories by bookings | JOIN `event_interest_tags` + `event_bookings` |
| User retention (30-day) | Users with ≥1 action in last 30 days / total users |
| Mutual click rate | `COUNT(mutual_clicks)` / `COUNT(clicks)` |

Charts: Recharts. Timeframe selector: 7 / 30 / 90 days / All time. All write to `?timeframe=` URL param.

---

## 10. System Settings

| Setting | DB field | Notes |
|---|---|---|
| Commission rate | `platform_settings.commission_rate` | Decimal; affects all future bookings |
| Maintenance mode | `platform_settings.maintenance_mode` | Boolean; shows maintenance page to all non-admin users |
| Waitlist offer expiry | `platform_settings.waitlist_offer_minutes` | Default 15; affects `waitlist_offers.expires_at` |
| Mutual click expiry | `platform_settings.mutual_click_expiry_days` | Default 7 |
| FOMO minimum cohort | `platform_settings.fomo_min_cohort` | Default 5; prevents de-anonymising small groups |

All settings changes are logged via `logAdminAction('setting_changed', null, {key, old, new})`.

**Maintenance mode** should be a middleware check on every request — not a React component check. If `platform_settings.maintenance_mode = true`, all non-admin routes return a maintenance page. Supabase function or edge middleware is the right place for this.

---

## Appendix: Key RLS Policies (Admin Scope)

```sql
-- Admins can read all profiles
CREATE POLICY "admin_read_profiles" ON profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Admins can update profiles (for moderation)
CREATE POLICY "admin_update_profiles" ON profiles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Admins can read all events (any status)
CREATE POLICY "admin_read_events" ON events
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Admins can update events
CREATE POLICY "admin_update_events" ON events
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Admins can read all merchants
CREATE POLICY "admin_read_merchants" ON merchants
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Admins can read all bookings
CREATE POLICY "admin_read_bookings" ON event_bookings
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Audit log: insert for all, select for admin only, no update/delete
CREATE POLICY "audit_log_insert" ON admin_audit_log
  FOR INSERT WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "audit_log_admin_read" ON admin_audit_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- has_role helper (security definer — bypasses RLS for this check only)
CREATE OR REPLACE FUNCTION has_role(uid uuid, check_role text)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = uid AND role = check_role
  );
$$ LANGUAGE sql SECURITY DEFINER;
```
