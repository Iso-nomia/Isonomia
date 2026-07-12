-- ================================
-- Library Posts / Stacks (idempotent)
-- ================================
SET search_path TO public;

-- 0) Add enum value feed_post_type.LIBRARY (if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'feed_post_type'
      AND e.enumlabel = 'LIBRARY'
  ) THEN
    ALTER TYPE feed_post_type ADD VALUE 'LIBRARY';
  END IF;
END $$;

-- 1) stacks table ------------------------------------------
CREATE TABLE IF NOT EXISTS stacks (
  id          text PRIMARY KEY,
  owner_id    bigint NOT NULL,
  name        text NOT NULL,
  description text,
  is_public   boolean NOT NULL DEFAULT false,
  "order"     text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz(6) NOT NULL DEFAULT now(),
  parent_id   text NULL
);

-- Helpful indexes / uniqueness
CREATE INDEX IF NOT EXISTS stacks_parent_id_idx ON public.stacks(parent_id);
-- Use a UNIQUE INDEX to emulate Prisma @@unique([owner_id, name])
CREATE UNIQUE INDEX IF NOT EXISTS stacks_owner_id_name_idx ON public.stacks(owner_id, name);

-- FKs (added only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema='public' AND table_name='stacks'
      AND constraint_name='stacks_owner_id_fkey'
  ) THEN
    ALTER TABLE public.stacks
      ADD CONSTRAINT stacks_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES public.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema='public' AND table_name='stacks'
      AND constraint_name='stacks_parent_id_fkey'
  ) THEN
    ALTER TABLE public.stacks
      ADD CONSTRAINT stacks_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES public.stacks(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) library_posts table -----------------------------------
CREATE TABLE IF NOT EXISTS library_posts (
  id           text PRIMARY KEY,
  uploader_id  bigint NOT NULL,
  stack_id     text NULL,
  title        text,
  page_count   integer NOT NULL,
  file_url     text NOT NULL,
  thumb_urls   text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS library_posts_uploader_id_idx ON public.library_posts(uploader_id);
CREATE INDEX IF NOT EXISTS library_posts_stack_id_idx    ON public.library_posts(stack_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema='public' AND table_name='library_posts'
      AND constraint_name='library_posts_uploader_id_fkey'
  ) THEN
    ALTER TABLE public.library_posts
      ADD CONSTRAINT library_posts_uploader_id_fkey
      FOREIGN KEY (uploader_id) REFERENCES public.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema='public' AND table_name='library_posts'
      AND constraint_name='library_posts_stack_id_fkey'
  ) THEN
    ALTER TABLE public.library_posts
      ADD CONSTRAINT library_posts_stack_id_fkey
      FOREIGN KEY (stack_id) REFERENCES public.stacks(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) annotations table -------------------------------------
CREATE TABLE IF NOT EXISTS annotations (
  id         text PRIMARY KEY,
  post_id    text NOT NULL,
  page       integer NOT NULL,
  rect       jsonb NOT NULL,
  text       text NOT NULL,
  author_id  bigint NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS annotations_post_id_idx ON public.annotations(post_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema='public' AND table_name='annotations'
      AND constraint_name='annotations_post_id_fkey'
  ) THEN
    ALTER TABLE public.annotations
      ADD CONSTRAINT annotations_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES public.library_posts(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema='public' AND table_name='annotations'
      AND constraint_name='annotations_author_id_fkey'
  ) THEN
    ALTER TABLE public.annotations
      ADD CONSTRAINT annotations_author_id_fkey
      FOREIGN KEY (author_id) REFERENCES public.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 4) feed_posts wiring -------------------------------------
-- columns (no-ops if already present)
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS library_post_id text;
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS stack_id        text;
ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS portfolio       jsonb;

-- indexes
CREATE INDEX IF NOT EXISTS feed_posts_library_post_id_idx ON public.feed_posts(library_post_id);
CREATE INDEX IF NOT EXISTS feed_posts_stack_id_idx        ON public.feed_posts(stack_id);

-- FKs with ON DELETE SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema='public' AND table_name='feed_posts'
      AND constraint_name='feed_posts_library_post_id_fkey'
  ) THEN
    ALTER TABLE public.feed_posts
      ADD CONSTRAINT feed_posts_library_post_id_fkey
      FOREIGN KEY (library_post_id) REFERENCES public.library_posts(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema='public' AND table_name='feed_posts'
      AND constraint_name='feed_posts_stack_id_fkey'
  ) THEN
    ALTER TABLE public.feed_posts
      ADD CONSTRAINT feed_posts_stack_id_fkey
      FOREIGN KEY (stack_id) REFERENCES public.stacks(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Done.
