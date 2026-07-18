ALTER TABLE public.garage_servicing_receipts
ADD COLUMN name text;

UPDATE public.garage_servicing_receipts
SET name = COALESCE(
  NULLIF(regexp_replace(filename, '\.[^.]+$', ''), ''),
  filename
);

ALTER TABLE public.garage_servicing_receipts
ALTER COLUMN name SET NOT NULL;

ALTER TABLE public.garage_servicing_receipts
ADD CONSTRAINT garage_servicing_receipts_name_not_blank
CHECK (btrim(name) <> '');
