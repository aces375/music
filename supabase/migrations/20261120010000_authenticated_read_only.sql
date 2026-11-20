-- This project still auto-grants new tables to `authenticated`, so the select-only grant in the
-- previous migration was not enough to make signed-in users read-only. RLS already blocks writes
-- (only select policies exist); this makes the grants say the same thing.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
