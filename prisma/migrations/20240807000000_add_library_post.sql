-- ===========================
-- Library Post / Stacks schema
-- ===========================

-- 0) feed_post_type: add value 'LIBRARY' if missing
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

-- 1) Stacks (parent/child hierarchy)
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

CREATE UNIQUE INDEX IF NOT EXISTS stacks_owner_id_name_key ON stacks(owner_id, name);
CREATE INDEX IF NOT EXISTS stacks_parent_id_idx ON stacks(parent_id);

ALTER TABLE stacks
  ADD CONSTRAINT stacks_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE stacks
  ADD CONSTRAINT stacks_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES stacks(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 2) Library posts
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

CREATE INDEX IF NOT EXISTS library_posts_uploader_id_idx ON library_posts(uploader_id);
CREATE INDEX IF NOT EXISTS library_posts_stack_id_idx    ON library_posts(stack_id);

ALTER TABLE library_posts
  ADD CONSTRAINT library_posts_uploader_id_fkey
  FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE library_posts
  ADD CONSTRAINT library_posts_stack_id_fkey
  FOREIGN KEY (stack_id) REFERENCES stacks(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Annotations (per-page notes)
CREATE TABLE IF NOT EXISTS annotations (
  id         text PRIMARY KEY,
  post_id    text NOT NULL,
  page       integer NOT NULL,
  rect       jsonb NOT NULL,
  text       text NOT NULL,
  author_id  bigint NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS annotations_post_id_idx ON annotations(post_id);

ALTER TABLE annotations
  ADD CONSTRAINT annotations_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES library_posts(id) ON DELETE CASCADE;

ALTER TABLE annotations
  ADD CONSTRAINT annotations_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;

-- 4) Feed posts: columns + FKs + indexes
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS library_post_id text;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS stack_id        text;

-- optional: if you added portfolio Json? recently
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS portfolio jsonb;

CREATE INDEX IF NOT EXISTS feed_posts_library_post_id_idx ON feed_posts(library_post_id);
CREATE INDEX IF NOT EXISTS feed_posts_stack_id_idx        ON feed_posts(stack_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'feed_posts'
      AND constraint_name = 'feed_posts_library_post_id_fkey'
  ) THEN
    ALTER TABLE feed_posts
      ADD CONSTRAINT feed_posts_library_post_id_fkey
      FOREIGN KEY (library_post_id) REFERENCES library_posts(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'feed_posts'
      AND constraint_name = 'feed_posts_stack_id_fkey'
  ) THEN
    ALTER TABLE feed_posts
      ADD CONSTRAINT feed_posts_stack_id_fkey
      FOREIGN KEY (stack_id) REFERENCES stacks(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
