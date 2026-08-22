-- Full-text search on task title + description, using a generated tsvector
-- column (kept automatically in sync by Postgres) and a GIN index, per the
-- assignment's "use PostgreSQL indexes appropriate for the search strategy".
ALTER TABLE "tasks"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B')
  ) STORED;

CREATE INDEX "tasks_search_vector_idx" ON "tasks" USING GIN ("search_vector");
