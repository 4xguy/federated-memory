-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create vector similarity search functions
CREATE OR REPLACE FUNCTION vector_search(
  table_name text,
  user_id_param uuid,
  query_embedding vector(1536),
  match_count int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT 
      id,
      content,
      metadata,
      1 - (embedding <=> %L::vector) as similarity
    FROM %I
    WHERE user_id = %L
    ORDER BY embedding <=> %L::vector
    LIMIT %s
  ', query_embedding, table_name, user_id_param, query_embedding, match_count);
END;
$$;

-- Create index search function for CMI
CREATE OR REPLACE FUNCTION cmi_search(
  user_id_param uuid,
  query_embedding vector(512),
  module_filter text[] DEFAULT NULL,
  match_count int DEFAULT 20
)
RETURNS TABLE(
  module_id text,
  remote_memory_id uuid,
  title text,
  summary text,
  similarity float,
  importance_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mi.module_id,
    mi.remote_memory_id,
    mi.title,
    mi.summary,
    1 - (mi.embedding <=> query_embedding) as similarity,
    mi.importance_score
  FROM memory_index mi
  WHERE mi.user_id = user_id_param
    AND (module_filter IS NULL OR mi.module_id = ANY(module_filter))
  ORDER BY 
    (mi.embedding <=> query_embedding) * (1 - mi.importance_score * 0.2)
  LIMIT match_count;
END;
$$;

-- Function to calculate module statistics
CREATE OR REPLACE FUNCTION calculate_module_stats(
  module_id_param text,
  date_param date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  stats_record RECORD;
BEGIN
  -- Calculate stats for the module
  WITH module_activity AS (
    SELECT 
      COUNT(DISTINCT mi.user_id) as active_users,
      COUNT(*) as total_queries,
      AVG(EXTRACT(EPOCH FROM (mi.updated_at - mi.created_at))) as avg_latency
    FROM memory_index mi
    WHERE mi.module_id = module_id_param
      AND DATE(mi.created_at) = date_param
  )
  INSERT INTO module_stats (module_id, date, active_users, total_queries, avg_latency_ms)
  SELECT 
    module_id_param,
    date_param,
    COALESCE(active_users, 0),
    COALESCE(total_queries, 0),
    COALESCE(avg_latency * 1000, 0)
  FROM module_activity
  ON CONFLICT (module_id, date) DO UPDATE
  SET 
    active_users = EXCLUDED.active_users,
    total_queries = EXCLUDED.total_queries,
    avg_latency_ms = EXCLUDED.avg_latency_ms;
END;
$$;