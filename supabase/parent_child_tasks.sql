-- Schema migration: Task dependencies (Parent-Child relationships)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS entity_tag TEXT;

-- Auto-linking trigger function
CREATE OR REPLACE FUNCTION public.trig_auto_link_parent_task()
RETURNS TRIGGER AS $$
DECLARE
    matched_entity_tag TEXT;
    parent_uuid UUID;
    task_category TEXT;
    parts TEXT[];
    meta_part TEXT;
    cat_match TEXT[];
BEGIN
    -- 1. Extract entity tag (e.g. 'VER2266') using regex
    -- Looks for capitalized letters (2 to 4) followed optionally by space, then numbers (1 to 4)
    -- E.g. 'VER2266', 'W 1234', 'ABC1234'
    matched_entity_tag := (regexp_match(NEW.title, '\b([A-Z]{2,4})\s*(\d{1,4}[A-Z]?)\b'))[1] || (regexp_match(NEW.title, '\b([A-Z]{2,4})\s*(\d{1,4}[A-Z]?)\b'))[2];
    
    -- Strip spaces and convert to uppercase
    IF matched_entity_tag IS NOT NULL THEN
        matched_entity_tag := upper(replace(matched_entity_tag, ' ', ''));
        NEW.entity_tag := matched_entity_tag;
    ELSE
        -- Fallback check for general alphanumeric codes
        matched_entity_tag := (regexp_match(NEW.title, '([A-Z]{2,4})\s*(\d{2,4})'))[1] || (regexp_match(NEW.title, '([A-Z]{2,4})\s*(\d{2,4})'))[2];
        IF matched_entity_tag IS NOT NULL THEN
            matched_entity_tag := upper(replace(matched_entity_tag, ' ', ''));
            NEW.entity_tag := matched_entity_tag;
        END IF;
    END IF;

    -- 2. Extract Category (Business Folder) from note
    IF NEW.note IS NOT NULL AND NEW.note LIKE '%=== METADATA ===%' THEN
        parts := string_to_array(NEW.note, '=== METADATA ===');
        meta_part := parts[array_length(parts, 1)];
        cat_match := regexp_match(meta_part, 'category:\s*(.+)');
        IF cat_match IS NOT NULL THEN
            task_category := trim(cat_match[1]);
        END IF;
    END IF;

    -- If no category found in note, check title brackets
    IF task_category IS NULL THEN
        cat_match := regexp_match(NEW.title, '^\[([^\]]+)\]');
        IF cat_match IS NOT NULL THEN
            task_category := trim(cat_match[1]);
        END IF;
    END IF;

    -- 3. If entity_tag and category are valid, find the oldest active task in the same category
    IF NEW.entity_tag IS NOT NULL THEN
        -- Find the oldest non-completed task in the same category/folder with identical entity_tag
        -- The older task is the one with the earliest commencement_date or created_at
        SELECT t.id INTO parent_uuid
        FROM public.tasks t
        WHERE t.id <> NEW.id
          AND t.entity_tag = NEW.entity_tag
          -- Compare categories. Since we don't have a direct category column, we can do substring match on note or title
          AND (
            (t.note LIKE '%category: ' || task_category || '%')
            OR (t.title LIKE '[' || task_category || ']%')
          )
        ORDER BY COALESCE(t.commencement_date, t.created_at) ASC
        LIMIT 1;

        IF parent_uuid IS NOT NULL THEN
            NEW.parent_task_id := parent_uuid;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
DROP TRIGGER IF EXISTS trigger_auto_link_parent_task ON public.tasks;
CREATE TRIGGER trigger_auto_link_parent_task
    BEFORE INSERT OR UPDATE OF title, note ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.trig_auto_link_parent_task();
