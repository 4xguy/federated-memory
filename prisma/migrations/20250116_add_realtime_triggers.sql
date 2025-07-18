-- Create function to notify on memory changes
CREATE OR REPLACE FUNCTION notify_memory_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM pg_notify('memory_changes', json_build_object(
            'userId', OLD."userId",
            'type', 'memory_deleted',
            'data', json_build_object(
                'id', OLD.id,
                'moduleId', 'project-management'
            ),
            'timestamp', NOW()
        )::text);
        RETURN OLD;
    ELSE
        PERFORM pg_notify('memory_changes', json_build_object(
            'userId', NEW."userId",
            'type', CASE 
                WHEN TG_OP = 'INSERT' THEN 'memory_created'
                ELSE 'memory_updated'
            END,
            'data', json_build_object(
                'id', NEW.id,
                'content', NEW.content,
                'metadata', NEW.metadata,
                'createdAt', NEW."createdAt",
                'updatedAt', NEW."updatedAt"
            ),
            'timestamp', NOW()
        )::text);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for project management memories
CREATE OR REPLACE TRIGGER project_management_memories_notify
    AFTER INSERT OR UPDATE OR DELETE ON project_management_memories
    FOR EACH ROW EXECUTE FUNCTION notify_memory_change();

-- Create function to notify on project-specific changes
CREATE OR REPLACE FUNCTION notify_project_change()
RETURNS TRIGGER AS $$
DECLARE
    change_type TEXT;
    project_data JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN
        change_type := 'project_deleted';
        project_data := OLD.metadata;
        PERFORM pg_notify('project_changes', json_build_object(
            'userId', OLD."userId",
            'type', change_type,
            'data', project_data,
            'timestamp', NOW()
        )::text);
        RETURN OLD;
    ELSE
        -- Only notify for project-type memories
        IF NEW.metadata->>'type' = 'project' THEN
            change_type := CASE 
                WHEN TG_OP = 'INSERT' THEN 'project_created'
                ELSE 'project_updated'
            END;
            
            project_data := NEW.metadata || json_build_object(
                'id', NEW.id,
                'content', NEW.content,
                'createdAt', NEW."createdAt",
                'updatedAt', NEW."updatedAt"
            );
            
            PERFORM pg_notify('project_changes', json_build_object(
                'userId', NEW."userId",
                'type', change_type,
                'data', project_data,
                'timestamp', NOW()
            )::text);
        END IF;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for project-specific changes
CREATE OR REPLACE TRIGGER project_changes_notify
    AFTER INSERT OR UPDATE OR DELETE ON project_management_memories
    FOR EACH ROW EXECUTE FUNCTION notify_project_change();

-- Create function to notify on task-specific changes
CREATE OR REPLACE FUNCTION notify_task_change()
RETURNS TRIGGER AS $$
DECLARE
    change_type TEXT;
    task_data JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN
        change_type := 'task_deleted';
        task_data := OLD.metadata;
        PERFORM pg_notify('task_changes', json_build_object(
            'userId', OLD."userId",
            'type', change_type,
            'data', task_data,
            'timestamp', NOW()
        )::text);
        RETURN OLD;
    ELSE
        -- Only notify for task-type memories
        IF NEW.metadata->>'type' = 'task' THEN
            change_type := CASE 
                WHEN TG_OP = 'INSERT' THEN 'task_created'
                ELSE 'task_updated'
            END;
            
            task_data := NEW.metadata || json_build_object(
                'id', NEW.id,
                'content', NEW.content,
                'createdAt', NEW."createdAt",
                'updatedAt', NEW."updatedAt"
            );
            
            PERFORM pg_notify('task_changes', json_build_object(
                'userId', NEW."userId",
                'type', change_type,
                'data', task_data,
                'timestamp', NOW()
            )::text);
        END IF;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for task-specific changes
CREATE OR REPLACE TRIGGER task_changes_notify
    AFTER INSERT OR UPDATE OR DELETE ON project_management_memories
    FOR EACH ROW EXECUTE FUNCTION notify_task_change();

-- Create indexes for better performance on metadata queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_management_memories_metadata_type 
    ON project_management_memories USING GIN ((metadata->>'type'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_management_memories_metadata_status 
    ON project_management_memories USING GIN ((metadata->>'status'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_management_memories_metadata_project_id 
    ON project_management_memories USING GIN ((metadata->>'projectId'));

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres;
GRANT EXECUTE ON FUNCTION notify_memory_change() TO postgres;
GRANT EXECUTE ON FUNCTION notify_project_change() TO postgres;
GRANT EXECUTE ON FUNCTION notify_task_change() TO postgres;