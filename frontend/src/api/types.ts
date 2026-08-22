export type OrgRole = "org_admin" | "member";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type JobStatus = "pending" | "active" | "completed" | "failed";

export interface User {
  id: string;
  email: string;
  fullName: string;
}

export interface OrgMembership {
  organizationId: string;
  organizationName: string;
  role: OrgRole;
}

export interface Organization {
  id: string;
  name: string;
  role?: OrgRole;
}

export interface Member {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
  user: { id: string; email: string; fullName: string };
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  userId: string;
  assignedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignments?: TaskAssignment[];
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: { id: string; fullName: string; email: string };
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardCounts {
  todo: number;
  in_progress: number;
  review: number;
  done: number;
}

export interface JobStatusResponse {
  jobId: string;
  status: JobStatus;
  metadata: {
    attemptsMade?: number;
    failedReason?: string;
    finishedOn?: number | null;
    processedOn?: number | null;
    data?: unknown;
  };
}

export interface ApiErrorBody {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
