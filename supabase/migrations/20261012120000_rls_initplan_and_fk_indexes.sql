-- RLS: wrap auth.uid() in a scalar subquery so Postgres evaluates it once per
-- statement instead of once per row (Supabase lint 0003_auth_rls_initplan), and
-- scope the policies to the authenticated role (anon never has rows).

drop policy if exists "Users see own journal entries" on public.journal_entries;
create policy "Users see own journal entries" on public.journal_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users see own mood logs" on public.mood_logs;
create policy "Users see own mood logs" on public.mood_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users see own screener results" on public.screener_results;
create policy "Users see own screener results" on public.screener_results
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users see own gratitude snippets" on public.gratitude_snippets;
create policy "Users see own gratitude snippets" on public.gratitude_snippets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Cover unindexed foreign keys (lint 0001). The user_id indexes also match the
-- backend's "own rows, newest first" list queries.
create index if not exists idx_gratitude_user_created on public.gratitude_snippets (user_id, created_at desc);
create index if not exists idx_gratitude_source_entry on public.gratitude_snippets (source_entry_id);
create index if not exists idx_mood_entry on public.mood_logs (entry_id);
create index if not exists idx_screener_user_created on public.screener_results (user_id, created_at desc);
