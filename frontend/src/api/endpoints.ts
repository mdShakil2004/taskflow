import { apiRequest } from "./client";
import type {
  Comment,
  DashboardCounts,
  JobStatusResponse,
  Member,
  OrgMembership,
  Organization,
  Paginated,
  Project,
  Task,
  TaskAssignment,
  TaskPriority,
  TaskStatus,
  User,
} from "./types";

// ---- Auth --------------------------------------------------------------

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  organization?: { id: string; name: string; role: string };
}

export const authApi = {
  register: (input: {
    email: string;
    password: string;
    fullName: string;
    organizationName?: string;
    organizationId?: string;
  }) =>
    apiRequest<AuthResult>("/auth/register", {
      method: "POST",
      body: input,
      skipAuthHeader: true,
      skipOrgHeader: true,
    }),

  login: (input: { email: string; password: string }) =>
    apiRequest<AuthResult>("/auth/login", {
      method: "POST",
      body: input,
      skipAuthHeader: true,
      skipOrgHeader: true,
    }),

  logout: (input: { refreshToken: string; allDevices?: boolean }) =>
    apiRequest<void>("/auth/logout", { method: "POST", body: input, skipOrgHeader: true }),

  myOrganizations: () =>
    apiRequest<{ data: OrgMembership[] }>("/auth/me/organizations", { skipOrgHeader: true }),
};

// ---- Organizations / Members --------------------------------------------

export const organizationApi = {
  current: () => apiRequest<Organization>("/api/v1/organizations/me"),
};

export const memberApi = {
  list: () => apiRequest<{ data: Member[] }>("/api/v1/members"),
  add: (input: { email: string; role: "org_admin" | "member" }) =>
    apiRequest<Member>("/api/v1/members", { method: "POST", body: input }),
  updateRole: (userId: string, role: "org_admin" | "member") =>
    apiRequest<Member>(`/api/v1/members/${userId}`, { method: "PATCH", body: { role } }),
  remove: (userId: string) => apiRequest<void>(`/api/v1/members/${userId}`, { method: "DELETE" }),
};

// ---- Projects ------------------------------------------------------------

export const projectApi = {
  list: (page = 1, limit = 20) =>
    apiRequest<Paginated<Project>>(`/api/v1/projects?page=${page}&limit=${limit}`),
  get: (id: string) => apiRequest<Project>(`/api/v1/projects/${id}`),
  create: (input: { name: string; description?: string }) =>
    apiRequest<Project>("/api/v1/projects", { method: "POST", body: input }),
  update: (id: string, input: { name?: string; description?: string }) =>
    apiRequest<Project>(`/api/v1/projects/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) => apiRequest<void>(`/api/v1/projects/${id}`, { method: "DELETE" }),
  dashboard: (id: string) => apiRequest<DashboardCounts>(`/api/v1/projects/${id}/dashboard`),
};

// ---- Tasks -----------------------------------------------------------------

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  dueFrom?: string;
  dueTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") usp.set(k, String(v));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export const taskApi = {
  list: (projectId: string, filters: TaskFilters = {}) =>
    apiRequest<Paginated<Task>>(`/api/v1/projects/${projectId}/tasks${buildQuery({ ...filters })}`),
  get: (taskId: string) => apiRequest<Task>(`/api/v1/tasks/${taskId}`),
  create: (
    projectId: string,
    input: { title: string; description?: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string }
  ) => apiRequest<Task>(`/api/v1/projects/${projectId}/tasks`, { method: "POST", body: input }),
  update: (
    taskId: string,
    input: Partial<{
      title: string;
      description: string;
      status: TaskStatus;
      priority: TaskPriority;
      dueDate: string | null;
    }>
  ) => apiRequest<Task>(`/api/v1/tasks/${taskId}`, { method: "PATCH", body: input }),
  remove: (taskId: string) => apiRequest<void>(`/api/v1/tasks/${taskId}`, { method: "DELETE" }),
  bulkUpdateStatus: (taskIds: string[], status: TaskStatus) =>
    apiRequest<{ updated: number }>("/api/v1/tasks/bulk-status", {
      method: "PATCH",
      body: { taskIds, status },
    }),
};

// ---- Assignments -----------------------------------------------------------

export const assignmentApi = {
  assign: (taskId: string, userId: string) =>
    apiRequest<{ assignment: TaskAssignment; jobId: string | null }>(
      `/api/v1/tasks/${taskId}/assignments`,
      { method: "POST", body: { userId } }
    ),
  unassign: (taskId: string, userId: string) =>
    apiRequest<void>(`/api/v1/tasks/${taskId}/assignments/${userId}`, { method: "DELETE" }),
};

// ---- Comments ----------------------------------------------------------------

export const commentApi = {
  list: (taskId: string) => apiRequest<{ data: Comment[] }>(`/api/v1/tasks/${taskId}/comments`),
  create: (taskId: string, body: string) =>
    apiRequest<Comment>(`/api/v1/tasks/${taskId}/comments`, { method: "POST", body: { body } }),
};

// ---- Jobs -------------------------------------------------------------------

export const jobApi = {
  getStatus: (jobId: string) => apiRequest<JobStatusResponse>(`/jobs/${jobId}`),
};
