-- Required for GiST equality operators on UUID columns.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Some development databases received the overlap constraint as a manual
-- hotfix before it was versioned. Keep this migration safe for both those
-- databases and clean installations.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'appointment_valid_time_range'
          AND conrelid = '"Appointment"'::regclass
    ) THEN
        ALTER TABLE "Appointment"
        ADD CONSTRAINT "appointment_valid_time_range"
        CHECK ("endsAt" > "startsAt");
    END IF;
END $$;

-- PostgreSQL is the final concurrency boundary: even requests handled by
-- different API replicas cannot reserve overlapping active intervals.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'appointment_professional_no_overlap'
          AND conrelid = '"Appointment"'::regclass
    ) THEN
        ALTER TABLE "Appointment"
        ADD CONSTRAINT "appointment_professional_no_overlap"
        EXCLUDE USING gist (
            "tenantId" WITH =,
            "employeeMembershipId" WITH =,
            tsrange("startsAt", "endsAt", '[)') WITH &&
        )
        WHERE ("status" IN ('PENDING', 'CONFIRMED'));
    END IF;
END $$;
