DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'Connection'
  ) THEN
    DELETE FROM "Connection"
    WHERE provider::text IN ('LINKEDIN', 'INSTAGRAM');

    DELETE FROM "Connection" a
    USING "Connection" b
    WHERE a.id < b.id AND a.provider = b.provider;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'CacheEntry'
  ) THEN
    DELETE FROM "CacheEntry";
  END IF;
END $$;
