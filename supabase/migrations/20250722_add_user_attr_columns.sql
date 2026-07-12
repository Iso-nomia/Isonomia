ALTER TABLE user_attributes
  ADD COLUMN IF NOT EXISTS artists       text[],
  ADD COLUMN IF NOT EXISTS albums        text[],
  ADD COLUMN IF NOT EXISTS songs         text[],
  ADD COLUMN IF NOT EXISTS interests     text[],
  ADD COLUMN IF NOT EXISTS movies        text[],
  ADD COLUMN IF NOT EXISTS communities   text[],
  ADD COLUMN IF NOT EXISTS hobbies       text[],
  ADD COLUMN IF NOT EXISTS location      text,
  ADD COLUMN IF NOT EXISTS books         text[],
  ADD COLUMN IF NOT EXISTS birthday      date;