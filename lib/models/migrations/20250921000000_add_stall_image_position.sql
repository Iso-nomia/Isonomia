ALTER TABLE stall_image ADD COLUMN position INT NOT NULL DEFAULT 0;
CREATE INDEX stall_image_stall_id_position_idx
  ON stall_image (stall_id, position);
