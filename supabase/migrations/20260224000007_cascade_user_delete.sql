-- Add cascade behavior for user deletion
-- endpoints.user_id → ON DELETE CASCADE (cascades to webhook_logs via existing FK)
-- admin_audit_log columns → ON DELETE SET NULL (preserve audit history)

-- 1. endpoints.user_id: drop existing FK, re-add with CASCADE
ALTER TABLE public.endpoints
  DROP CONSTRAINT endpoints_user_id_fkey,
  ADD CONSTRAINT endpoints_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. admin_audit_log.admin_id: make nullable, drop existing FK, re-add with SET NULL
ALTER TABLE public.admin_audit_log
  ALTER COLUMN admin_id DROP NOT NULL;

ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT admin_audit_log_admin_id_fkey,
  ADD CONSTRAINT admin_audit_log_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. admin_audit_log.target_user_id: make nullable, drop existing FK, re-add with SET NULL
ALTER TABLE public.admin_audit_log
  ALTER COLUMN target_user_id DROP NOT NULL;

ALTER TABLE public.admin_audit_log
  DROP CONSTRAINT admin_audit_log_target_user_id_fkey,
  ADD CONSTRAINT admin_audit_log_target_user_id_fkey
    FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
