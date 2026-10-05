create or replace function public.set_momentum_memory_observation_flag()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.observation_flag :=
    new.prev3_avg_ai_power >= 85
    and new.prev3_max_ai_power >= 90
    and new.current_ai_power <= 50;
  return new;
end;
$$;

revoke all on function public.set_momentum_memory_observation_flag()
  from public, anon, authenticated;

drop trigger if exists momentum_memory_set_flag
  on public.momentum_memory_observations;

create trigger momentum_memory_set_flag
before insert or update of current_ai_power, prev3_avg_ai_power, prev3_max_ai_power, observation_flag
on public.momentum_memory_observations
for each row execute function public.set_momentum_memory_observation_flag();
