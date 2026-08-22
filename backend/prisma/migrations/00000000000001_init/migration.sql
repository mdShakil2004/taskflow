-- TaskFlow initial schema.
-- CASCADE/RESTRICT rationale is documented inline and in docs/database.md.

CREATE TYPE "OrgRole" AS ENUM ('org_admin', 'member');
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'in_progress', 'review', 'done');
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE "OutboxStatus" AS ENUM ('pending', 'dispatched', 'failed');

CREATE TABLE "users" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "replaced_by_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
-- Supports "find all active sessions for a user" (logout-all-devices).
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

CREATE TABLE "organizations" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "org_members" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "org_members_pkey" PRIMARY KEY ("id")
);
-- Supports the core "is user X a member of org Y" lookup on every request.
CREATE UNIQUE INDEX "org_members_organization_id_user_id_key" ON "org_members"("organization_id", "user_id");
CREATE INDEX "org_members_user_id_idx" ON "org_members"("user_id");

CREATE TABLE "projects" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);
-- Supports "list projects for my org" (the primary project listing query).
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");

CREATE TABLE "tasks" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'todo',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);
-- Supports the task-list-by-project query (every task list request is scoped to a project).
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");
-- Supports filtering by status/priority within a project (dashboard + filters).
CREATE INDEX "tasks_project_id_status_idx" ON "tasks"("project_id", "status");
CREATE INDEX "tasks_project_id_priority_idx" ON "tasks"("project_id", "priority");
-- Supports the due-date-range filter.
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");

CREATE TABLE "task_assignments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);
-- Enforces "a user can only be assigned to a given task once" at the DB level.
CREATE UNIQUE INDEX "task_assignments_task_id_user_id_key" ON "task_assignments"("task_id", "user_id");
-- Supports "what tasks is this user assigned to" queries.
CREATE INDEX "task_assignments_user_id_idx" ON "task_assignments"("user_id");

CREATE TABLE "comments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "task_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);
-- Supports "list comments for a task" (the only comment listing query).
CREATE INDEX "comments_task_id_idx" ON "comments"("task_id");

CREATE TABLE "notification_outbox" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "task_id" TEXT NOT NULL,
    "assignee_id" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMP(3),
    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);
-- Supports the recovery sweep's "find pending rows older than N seconds" query.
CREATE INDEX "notification_outbox_status_created_at_idx" ON "notification_outbox"("status", "created_at");

-- Foreign keys -----------------------------------------------------------

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Membership rows are meaningless without their org or user; cascade both ways.
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- An org-less project is meaningless; deleting an org cascades to its projects.
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A task cannot exist without its project.
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Assignment rows die with their task, but RESTRICT on user deletion to
-- preserve assignment history (deactivate users instead of hard-deleting).
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Comments die with their task, but RESTRICT on author deletion to preserve
-- the comment's authorship/audit trail.
ALTER TABLE "comments" ADD CONSTRAINT "comments_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
