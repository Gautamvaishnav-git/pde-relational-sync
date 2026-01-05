-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    created_by TEXT NOT NULL,
    current_version_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Versions Table
CREATE TABLE IF NOT EXISTS versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id),
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Circular Foreign Key (documents.current_version_id -> versions.id)
-- Using ALTER TABLE to avoid ordering issues during creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_current_version'
    ) THEN
        ALTER TABLE documents
        ADD CONSTRAINT fk_current_version
        FOREIGN KEY (current_version_id)
        REFERENCES versions(id);
    END IF;
END $$;

-- Search Index
CREATE INDEX IF NOT EXISTS documents_title_search_idx
ON documents
USING GIN (to_tsvector('english', title));
