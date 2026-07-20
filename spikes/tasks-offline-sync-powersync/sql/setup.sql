create table public.tasks_spike_items (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  destination text not null check (destination in ('inbox', 'today')),
  origin text not null check (origin in ('manual', 'server')),
  order_key text not null,
  completed_at timestamptz,
  deleted_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  client_mutation_id uuid not null unique,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table public.tasks_spike_items replica identity full;
alter table public.tasks_spike_items enable row level security;

grant select, insert, update, delete on table public.tasks_spike_items to authenticated, service_role;

create policy "tasks spike owners select"
on public.tasks_spike_items
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "tasks spike owners insert"
on public.tasks_spike_items
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "tasks spike owners update"
on public.tasks_spike_items
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "tasks spike owners delete"
on public.tasks_spike_items
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create index tasks_spike_items_owner_destination_order_idx
on public.tasks_spike_items (owner_id, destination, order_key, id)
where deleted_at is null;

create publication powersync for table public.tasks_spike_items;
