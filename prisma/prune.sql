DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'Connection'
  ) THEN
    DELETE FROM "Connection"
    WHERE provider::text IN ('LINKEDIN', 'INSTAGRAM', 'PIPEDRIVE');
  END IF;
END $$;
