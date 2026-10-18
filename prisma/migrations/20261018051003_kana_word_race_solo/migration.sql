-- Keep legacy matches multiplayer; only explicitly marked solo matches allow one player.
ALTER TABLE "KanaRaceMatch"
  DROP CONSTRAINT "KanaRaceMatch_shape_check",
  ADD CONSTRAINT "KanaRaceMatch_shape_check" CHECK (
    jsonb_typeof("state") = 'object' AND ("state" ->> 'version') IS NOT DISTINCT FROM '1'
    AND COALESCE(jsonb_typeof("state" -> 'roster') = 'array', false)
    AND (
      (COALESCE("state" #>> '{config,mode}', 'multiplayer') = 'multiplayer'
        AND jsonb_array_length("state" -> 'roster') BETWEEN 2 AND 20)
      OR ("state" #>> '{config,mode}' IS NOT DISTINCT FROM 'solo'
        AND jsonb_array_length("state" -> 'roster') = 1)
    )
    AND COALESCE(jsonb_typeof("state" -> 'rounds') = 'array', false)
    AND jsonb_array_length("state" -> 'rounds') IN (3, 5, 10)
    AND "createdAt" < "expiresAt"
  ) NOT VALID;

ALTER TABLE "KanaRaceMatch" VALIDATE CONSTRAINT "KanaRaceMatch_shape_check";
