\set ON_ERROR_STOP on

begin;

select set_config('request.jwt.claim.sub', :'owner_b', true);
select set_config('spike.owner_a', :'owner_a', true);

set local role authenticated;

select count(*) as owner_a_rows_visible_to_owner_b
from public.tasks_spike_items
where owner_id = :'owner_a'::uuid;

with updated as (
  update public.tasks_spike_items
  set title = 'RLS probe must never persist'
  where id = :'owner_a_task'::uuid
  returning id
)
select count(*) as owner_a_rows_updated_by_owner_b
from updated;

do $$
declare
  spoofed_insert_blocked boolean := false;
begin
  begin
    insert into public.tasks_spike_items (
      id,
      owner_id,
      title,
      destination,
      origin,
      order_key,
      revision,
      client_mutation_id,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      current_setting('spike.owner_a')::uuid,
      'Owner spoof RLS probe',
      'inbox',
      'manual',
      'a0',
      1,
      gen_random_uuid(),
      clock_timestamp(),
      clock_timestamp()
    );
  exception
    when insufficient_privilege then
      spoofed_insert_blocked := true;
  end;

  if not spoofed_insert_blocked then
    raise exception 'Owner B unexpectedly inserted a task owned by owner A';
  end if;

  raise notice 'Owner-spoofed insert blocked by RLS';
end
$$;

rollback;
