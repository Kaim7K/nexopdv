DO $$
DECLARE
  required_columns text[] := ARRAY['id','name','slug','logo_url','primary_color','secondary_color','enabled_modules','active','next_sale_number','created_date','updated_date'];
  available_count integer;
BEGIN
  IF to_regclass('public.markets') IS NULL OR EXISTS (SELECT 1 FROM nexo.markets) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO available_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'markets' AND column_name = ANY(required_columns);

  IF available_count = cardinality(required_columns) THEN
    EXECUTE $copy$
      INSERT INTO nexo.markets (
        id,name,slug,logo_url,primary_color,secondary_color,enabled_modules,
        active,next_sale_number,created_date,updated_date
      )
      SELECT
        id,name,slug,logo_url,primary_color,secondary_color,enabled_modules,
        active,next_sale_number,created_date,updated_date
      FROM public.markets
      ON CONFLICT DO NOTHING
    $copy$;
  END IF;
END $$;
-- statement-breakpoint
DO $$
DECLARE
  required_columns text[] := ARRAY['id','market_id','email','password_hash','full_name','role','photo_url','active','created_date','updated_date'];
  available_count integer;
BEGIN
  IF to_regclass('public.users') IS NULL OR EXISTS (SELECT 1 FROM nexo.users) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO available_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = ANY(required_columns);

  IF available_count = cardinality(required_columns) THEN
    EXECUTE $copy$
      INSERT INTO nexo.users (
        id,market_id,email,password_hash,full_name,role,photo_url,active,created_date,updated_date
      )
      SELECT
        u.id,u.market_id,u.email,u.password_hash,u.full_name,u.role,u.photo_url,u.active,u.created_date,u.updated_date
      FROM public.users u
      WHERE u.market_id IS NULL OR EXISTS (SELECT 1 FROM nexo.markets m WHERE m.id = u.market_id)
      ON CONFLICT DO NOTHING
    $copy$;
  END IF;
END $$;
-- statement-breakpoint
DO $$
DECLARE
  required_columns text[] := ARRAY['id','market_id','entity','data','created_date','updated_date'];
  available_count integer;
BEGIN
  IF to_regclass('public.records') IS NULL OR EXISTS (SELECT 1 FROM nexo.records) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO available_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'records' AND column_name = ANY(required_columns);

  IF available_count = cardinality(required_columns) THEN
    EXECUTE $copy$
      INSERT INTO nexo.records (id,market_id,entity,data,created_date,updated_date)
      SELECT r.id,r.market_id,r.entity,r.data,r.created_date,r.updated_date
      FROM public.records r
      WHERE EXISTS (SELECT 1 FROM nexo.markets m WHERE m.id = r.market_id)
      ON CONFLICT DO NOTHING
    $copy$;
  END IF;
END $$;
