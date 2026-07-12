-- Add theory_work and theory_section to KbBlockType enum
ALTER TYPE "KbBlockType" ADD VALUE IF NOT EXISTS 'theory_work';
ALTER TYPE "KbBlockType" ADD VALUE IF NOT EXISTS 'theory_section';
