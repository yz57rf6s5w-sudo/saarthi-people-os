-- Saarthi People OS: shared-backend foundation
-- Apply in a new Supabase project via SQL Editor. Review before production use.
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('founder','hr','manager','employee')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_name text not null check (char_length(trim(employee_name)) between 1 and 160),
  title text not null check (char_length(trim(title)) between 1 and 180),
  details text not null default '',
  owner_name text not null default '',
  owner_user_id uuid references auth.users(id) on delete set null,
  due_date date,
  status text not null default 'Not started'
    check (status in ('Not started','In Progress','Done','Blocked')),
  reminder_sent_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists onboarding_tasks_org_due_idx
  on public.onboarding_tasks (organization_id, due_date)
  where status <> 'Done';
create index if not exists onboarding_tasks_owner_idx
  on public.onboarding_tasks (owner_user_id, due_date)
  where status <> 'Done';

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 100),
  entity_type text not null check (char_length(entity_type) between 1 and 100),
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_org_created_idx
  on public.audit_events (organization_id, created_at desc);

-- Security helpers avoid recursive RLS policy lookups on memberships.
create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = target_org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed_roles text[])
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = target_org and m.user_id = (select auth.uid())
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, text[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.onboarding_tasks enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "members can read their organizations" on public.organizations;
create policy "members can read their organizations" on public.organizations
for select to authenticated using (public.is_org_member(id));

drop policy if exists "members can read org memberships" on public.memberships;
create policy "members can read org memberships" on public.memberships
for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists "founders and HR manage memberships" on public.memberships;
create policy "founders and HR manage memberships" on public.memberships
for all to authenticated
using (public.has_org_role(organization_id, array['founder','hr']))
with check (public.has_org_role(organization_id, array['founder','hr']));

drop policy if exists "members read onboarding tasks" on public.onboarding_tasks;
create policy "members read onboarding tasks" on public.onboarding_tasks
for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists "founders HR managers create onboarding tasks" on public.onboarding_tasks;
create policy "founders HR managers create onboarding tasks" on public.onboarding_tasks
for insert to authenticated
with check (public.has_org_role(organization_id, array['founder','hr','manager']));

drop policy if exists "founders HR managers update onboarding tasks" on public.onboarding_tasks;
create policy "founders HR managers update onboarding tasks" on public.onboarding_tasks
for update to authenticated
using (public.has_org_role(organization_id, array['founder','hr','manager']))
with check (public.has_org_role(organization_id, array['founder','hr','manager']));

drop policy if exists "founders HR delete onboarding tasks" on public.onboarding_tasks;
create policy "founders HR delete onboarding tasks" on public.onboarding_tasks
for delete to authenticated
using (public.has_org_role(organization_id, array['founder','hr']));

drop policy if exists "members read audit events" on public.audit_events;
create policy "members read audit events" on public.audit_events
for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists "members add audit events" on public.audit_events;
create policy "members add audit events" on public.audit_events
for insert to authenticated
with check (public.is_org_member(organization_id) and actor_user_id = (select auth.uid()));

-- Intentionally no public signup / organization bootstrap policy. Provision the first
-- founder membership through a trusted admin workflow; never expose service-role keys
-- in browser code or GitHub Pages.
