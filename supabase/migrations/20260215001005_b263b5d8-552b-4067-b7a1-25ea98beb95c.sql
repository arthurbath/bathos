
-- Update old darker palette colors to new lighter palette
UPDATE public.categories SET color = CASE color
  WHEN '#fca5a5' THEN '#fecaca'
  WHEN '#fdba74' THEN '#fed7aa'
  WHEN '#fcd34d' THEN '#fde68a'
  WHEN '#86efac' THEN '#bbf7d0'
  WHEN '#5eead4' THEN '#a5f3fc'
  WHEN '#7dd3fc' THEN '#bfdbfe'
  WHEN '#93c5fd' THEN '#c7d2fe'
  WHEN '#a78bfa' THEN '#ede9fe'
  WHEN '#f0abfc' THEN '#fbcfe8'
  ELSE color END
WHERE color IN ('#fca5a5','#fdba74','#fcd34d','#86efac','#5eead4','#7dd3fc','#93c5fd','#a78bfa','#f0abfc');

UPDATE public.budgets SET color = CASE color
  WHEN '#fca5a5' THEN '#fecaca'
  WHEN '#fdba74' THEN '#fed7aa'
  WHEN '#fcd34d' THEN '#fde68a'
  WHEN '#86efac' THEN '#bbf7d0'
  WHEN '#5eead4' THEN '#a5f3fc'
  WHEN '#7dd3fc' THEN '#bfdbfe'
  WHEN '#93c5fd' THEN '#c7d2fe'
  WHEN '#a78bfa' THEN '#ede9fe'
  WHEN '#f0abfc' THEN '#fbcfe8'
  ELSE color END
WHERE color IN ('#fca5a5','#fdba74','#fcd34d','#86efac','#5eead4','#7dd3fc','#93c5fd','#a78bfa','#f0abfc');

UPDATE public.linked_accounts SET color = CASE color
  WHEN '#fca5a5' THEN '#fecaca'
  WHEN '#fdba74' THEN '#fed7aa'
  WHEN '#fcd34d' THEN '#fde68a'
  WHEN '#86efac' THEN '#bbf7d0'
  WHEN '#5eead4' THEN '#a5f3fc'
  WHEN '#7dd3fc' THEN '#bfdbfe'
  WHEN '#93c5fd' THEN '#c7d2fe'
  WHEN '#a78bfa' THEN '#ede9fe'
  WHEN '#f0abfc' THEN '#fbcfe8'
  ELSE color END
WHERE color IN ('#fca5a5','#fdba74','#fcd34d','#86efac','#5eead4','#7dd3fc','#93c5fd','#a78bfa','#f0abfc');

UPDATE public.households SET partner_x_color = CASE partner_x_color
  WHEN '#fca5a5' THEN '#fecaca'
  WHEN '#fdba74' THEN '#fed7aa'
  WHEN '#fcd34d' THEN '#fde68a'
  WHEN '#86efac' THEN '#bbf7d0'
  WHEN '#5eead4' THEN '#a5f3fc'
  WHEN '#7dd3fc' THEN '#bfdbfe'
  WHEN '#93c5fd' THEN '#c7d2fe'
  WHEN '#a78bfa' THEN '#ede9fe'
  WHEN '#f0abfc' THEN '#fbcfe8'
  ELSE partner_x_color END
WHERE partner_x_color IN ('#fca5a5','#fdba74','#fcd34d','#86efac','#5eead4','#7dd3fc','#93c5fd','#a78bfa','#f0abfc');

UPDATE public.households SET partner_y_color = CASE partner_y_color
  WHEN '#fca5a5' THEN '#fecaca'
  WHEN '#fdba74' THEN '#fed7aa'
  WHEN '#fcd34d' THEN '#fde68a'
  WHEN '#86efac' THEN '#bbf7d0'
  WHEN '#5eead4' THEN '#a5f3fc'
  WHEN '#7dd3fc' THEN '#bfdbfe'
  WHEN '#93c5fd' THEN '#c7d2fe'
  WHEN '#a78bfa' THEN '#ede9fe'
  WHEN '#f0abfc' THEN '#fbcfe8'
  ELSE partner_y_color END
WHERE partner_y_color IN ('#fca5a5','#fdba74','#fcd34d','#86efac','#5eead4','#7dd3fc','#93c5fd','#a78bfa','#f0abfc');
