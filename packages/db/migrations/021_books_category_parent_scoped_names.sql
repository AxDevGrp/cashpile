-- Allow the same category name under different parent categories while keeping
-- names unique among top-level categories and among siblings.

ALTER TABLE public.books_categories
    DROP CONSTRAINT IF EXISTS books_categories_user_id_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS books_categories_user_id_top_level_name_key
    ON public.books_categories(user_id, name)
    WHERE parent_category_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS books_categories_user_id_parent_name_key
    ON public.books_categories(user_id, parent_category_id, name)
    WHERE parent_category_id IS NOT NULL;
