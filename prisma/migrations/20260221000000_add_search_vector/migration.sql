-- Add plain_text column for storing extracted text (used by ts_headline)
ALTER TABLE blocks ADD COLUMN plain_text TEXT NOT NULL DEFAULT '';

-- Add search_vector column for full-text search
ALTER TABLE blocks ADD COLUMN search_vector tsvector;

-- Create GIN index for fast full-text search lookups
CREATE INDEX idx_blocks_search_vector ON blocks USING GIN (search_vector);

-- Create a function that updates search_vector from plain_text
CREATE OR REPLACE FUNCTION blocks_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.plain_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires on INSERT or UPDATE of plain_text
CREATE TRIGGER trigger_blocks_search_vector_update
  BEFORE INSERT OR UPDATE OF plain_text ON blocks
  FOR EACH ROW
  EXECUTE FUNCTION blocks_search_vector_update();

-- Composite index for tenant-scoped search
CREATE INDEX idx_blocks_tenant_search ON blocks (tenant_id)
  WHERE search_vector IS NOT NULL;
