-- Add replayed_from column for webhook replay tracking
-- null = original webhook, non-null = replay (references the original log)
ALTER TABLE webhook_logs
ADD COLUMN replayed_from uuid REFERENCES webhook_logs(id) ON DELETE SET NULL;
