ALTER TABLE public.tasks_todos
  DROP CONSTRAINT tasks_todos_title_valid;

ALTER TABLE public.tasks_todos
  ADD CONSTRAINT tasks_todos_title_valid CHECK (
    char_length(title) <= 500
  );
