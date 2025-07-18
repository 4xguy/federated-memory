-- Fix JSONB concatenation in triggers
-- The || operator requires both operands to be JSONB, not JSON

-- Drop existing triggers
DROP TRIGGER IF EXISTS project_changes_notify ON project_management_memories;
DROP TRIGGER IF EXISTS task_changes_notify ON project_management_memories;

-- Create fixed function to notify on project-specific changes
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
            
            -- Fix: Use jsonb_build_object and ensure both operands are JSONB
            project_data := NEW.metadata || jsonb_build_object(
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

-- Create fixed function to notify on task-specific changes
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
            
            -- Fix: Use jsonb_build_object and ensure both operands are JSONB
            task_data := NEW.metadata || jsonb_build_object(
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

-- Recreate triggers with fixed functions
CREATE TRIGGER project_changes_notify
    AFTER INSERT OR UPDATE OR DELETE ON project_management_memories
    FOR EACH ROW EXECUTE FUNCTION notify_project_change();

CREATE TRIGGER task_changes_notify
    AFTER INSERT OR UPDATE OR DELETE ON project_management_memories
    FOR EACH ROW EXECUTE FUNCTION notify_task_change();