-- =============================================================================
-- Security hardening (fixes from the Supabase security advisor)
--
-- 1. Trigger functions get a fixed, empty search_path. Their bodies already use
--    schema-qualified names (public.…), so nothing else changes. Without this, a
--    function would resolve names through the caller's search_path.
-- 2. handle_new_user() is SECURITY DEFINER and only meant to run as the trigger on
--    auth.users. Postgres doesn't check EXECUTE when a trigger fires, so revoking it
--    keeps sign-up working while removing /rest/v1/rpc/handle_new_user from the API.
-- =============================================================================

alter function public.set_updated_at()    set search_path = '';
alter function public.handle_deal_stage() set search_path = '';
alter function public.log_deal_stage()    set search_path = '';

revoke execute on function public.handle_new_user()   from public, anon, authenticated;
revoke execute on function public.set_updated_at()    from public, anon, authenticated;
revoke execute on function public.handle_deal_stage() from public, anon, authenticated;
revoke execute on function public.log_deal_stage()    from public, anon, authenticated;
