-- Keep default rulesVersion=1 for old deployments; new code explicitly creates v2 matches.
-- Preserve the existing schedule/config checks while allowing both supported versions.
ALTER TABLE "KotobaClashMatch"
  DROP CONSTRAINT "KotobaClashMatch_schedule_check",
  ADD CONSTRAINT "KotobaClashMatch_schedule_check" CHECK (
    "rulesVersion" IN (1, 2) AND "startsAt" < "endsAt" AND "endsAt" < "expiresAt"
    AND jsonb_typeof("config") = 'object'
  ) NOT VALID;

ALTER TABLE "KotobaClashMatch"
  VALIDATE CONSTRAINT "KotobaClashMatch_schedule_check";
