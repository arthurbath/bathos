-- Add Airtable-backed category value for Wardrobe imports.

ALTER TYPE public.wardrobe_category ADD VALUE IF NOT EXISTS 'accessories';
