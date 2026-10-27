# Saarthi shared backend setup (optional)

This repository currently runs as a static GitHub Pages demo and stores its demo state in the browser. The SQL in `supabase/schema.sql` is the first step toward shared, multi-user onboarding tasks; it does **not** connect the live app to a database by itself.

## What this foundation adds

- Organization/tenant boundary for every task.
- Memberships with founder, HR, manager, and employee roles.
- Shared onboarding tasks, owner assignment, due dates, and reminder state.
- Audit-event storage.
- Row Level Security (RLS) policies intended to prevent cross-organization reads/writes.

## Set up a free Supabase project

1. Create a project at https://supabase.com/ and keep the database password in a password manager.
2. Open **SQL Editor** in the Supabase dashboard.
3. Review and run `supabase/schema.sql`.
4. In **Authentication → URL Configuration**, set the site URL to the deployed Saarthi URL and add any local development URL to the redirect allow list.
5. Before adding real users, implement a trusted first-founder provisioning flow. The schema deliberately has no public organization-creation or self-promotion policy.
6. Test with two separate test organizations and accounts. Verify that one organization's user cannot read or modify the other organization's tasks or memberships.

## Important security boundaries

- Never put a Supabase **service-role** key in `index.html`, GitHub Pages, or any client-side code. It bypasses RLS.
- A Supabase publishable/anon key is only suitable for browser use when RLS and policies have been tested thoroughly.
- Do not import real employee personal data until authentication, authorization, tenant isolation, audit behavior, backup/restore, and privacy requirements have been reviewed.
- The SQL is a starting foundation, not a security certification. Have the policies reviewed before production use.

## Email nudges

The schema includes `due_date` and `reminder_sent_at` to support scheduled reminders, but it does not send email. The next step is a server-side scheduled job (for example, a Supabase Edge Function plus a scheduler) and an email provider. Keep provider credentials in server-side secrets. Make reminders idempotent so a task does not send repeated emails on every run.

## Current limitations

- The deployed demo still uses browser-local storage; changes do not sync across devices or people.
- This commit adds schema and setup documentation only. Authentication wiring, app integration, first-founder provisioning, scheduled email delivery, and end-to-end RLS tests remain to be implemented.
- Supabase free-tier quotas and inactivity behavior can change; check the provider's current pricing before deployment: https://supabase.com/pricing.

## Suggested implementation order

1. Configure a Supabase project and authentication provider.
2. Add a small client adapter that keeps demo mode working when configuration is absent.
3. Add organization bootstrap/invitation flow and role-aware access.
4. Move onboarding tasks to the shared database with optimistic UI and error handling.
5. Add server-side reminder scheduling and email.
6. Add automated tests for cross-tenant isolation and role permissions before using real data.
