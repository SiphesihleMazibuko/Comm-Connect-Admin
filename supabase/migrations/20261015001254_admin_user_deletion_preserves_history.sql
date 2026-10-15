-- Preserve operational history when an Auth user is deleted. Private user data
-- such as emergency contacts and saved pinpoints keeps its existing CASCADE rules.

ALTER TABLE public.cps_duty_sessions
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE public.cps_duty_sessions
  DROP CONSTRAINT "cps_duty_sessions_userId_fkey",
  ADD CONSTRAINT "cps_duty_sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.reports
  ALTER COLUMN "submittedBy" DROP NOT NULL;

ALTER TABLE public.reports
  DROP CONSTRAINT "reports_submittedBy_fkey",
  ADD CONSTRAINT "reports_submittedBy_fkey"
    FOREIGN KEY ("submittedBy") REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION private.anonymize_deleted_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public."emergencyRequests"
  SET
    "userName" = CASE WHEN "userId" = OLD.id THEN 'Deleted user' ELSE "userName" END,
    "userPhone" = CASE WHEN "userId" = OLD.id THEN NULL ELSE "userPhone" END,
    "responderName" = CASE WHEN "responderId" = OLD.id THEN 'Deleted user' ELSE "responderName" END
  WHERE "userId" = OLD.id OR "responderId" = OLD.id;

  UPDATE public.posts
  SET "createdByName" = 'Deleted user'
  WHERE "createdBy" = OLD.id;

  UPDATE public.cps_duty_sessions
  SET "memberName" = 'Deleted user'
  WHERE "userId" = OLD.id;

  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION private.anonymize_deleted_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS anonymize_deleted_auth_user ON auth.users;

CREATE TRIGGER anonymize_deleted_auth_user
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.anonymize_deleted_auth_user();
