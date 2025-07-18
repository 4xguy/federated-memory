-- Add efficient category counting for federated-memory system
-- This migration adds database functions to efficiently count memories by category

-- Create index for efficient JSONB queries on category field
CREATE INDEX IF NOT EXISTS idx_memory_index_category 
ON memory_index USING GIN ((metadata->'category'));

-- Also index the categories array field
CREATE INDEX IF NOT EXISTS idx_memory_index_categories 
ON memory_index USING GIN ((metadata->'categories'));

-- Function to get category counts for a user
CREATE OR REPLACE FUNCTION get_user_category_counts(user_id_param TEXT)
RETURNS TABLE(
  category_name TEXT,
  memory_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH category_list AS (
    -- Get categories from single category field
    SELECT DISTINCT metadata->>'category' as cat
    FROM memory_index
    WHERE "userId" = user_id_param
      AND metadata->>'category' IS NOT NULL
    
    UNION
    
    -- Get categories from categories array
    SELECT DISTINCT jsonb_array_elements_text(metadata->'categories') as cat
    FROM memory_index
    WHERE "userId" = user_id_param
      AND jsonb_typeof(metadata->'categories') = 'array'
  )
  SELECT 
    cat as category_name,
    COUNT(*)::BIGINT as memory_count
  FROM category_list cl
  JOIN memory_index mi ON (
    mi."userId" = user_id_param AND (
      mi.metadata->>'category' = cl.cat OR
      (jsonb_typeof(mi.metadata->'categories') = 'array' AND 
       mi.metadata->'categories' ? cl.cat)
    )
  )
  GROUP BY cat
  ORDER BY memory_count DESC, cat;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get count for a specific category
CREATE OR REPLACE FUNCTION get_category_count(
  user_id_param TEXT,
  category_param TEXT
)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::BIGINT
    FROM memory_index
    WHERE "userId" = user_id_param
      AND (
        metadata->>'category' = category_param OR
        (jsonb_typeof(metadata->'categories') = 'array' AND 
         metadata->'categories' ? category_param)
      )
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get all categories with metadata from registry
CREATE OR REPLACE FUNCTION get_category_registry_with_counts(user_id_param TEXT)
RETURNS TABLE(
  category_name TEXT,
  description TEXT,
  icon TEXT,
  parent_category TEXT,
  memory_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH registry_data AS (
    -- Find the category registry memory
    SELECT metadata->'categories' as categories
    FROM memory_index
    WHERE "userId" = user_id_param
      AND metadata->>'type' = 'list'
      AND metadata->>'name' = 'category_registry'
    LIMIT 1
  ),
  category_details AS (
    -- Extract category details from registry
    SELECT 
      cat->>'name' as name,
      cat->>'description' as description,
      cat->>'icon' as icon,
      cat->>'parentCategory' as parent
    FROM registry_data,
    LATERAL jsonb_array_elements(categories) as cat
  )
  SELECT 
    cd.name,
    cd.description,
    cd.icon,
    cd.parent,
    COALESCE(get_category_count(user_id_param, cd.name), 0) as memory_count
  FROM category_details cd
  ORDER BY memory_count DESC, cd.name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment explaining usage
COMMENT ON FUNCTION get_user_category_counts IS 
'Returns all categories used by a user with their memory counts. Checks both metadata.category and metadata.categories[] fields.';

COMMENT ON FUNCTION get_category_count IS 
'Returns the count of memories for a specific category and user.';

COMMENT ON FUNCTION get_category_registry_with_counts IS 
'Returns categories from the user registry with their metadata and current memory counts.';