import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

let onUnauthorized: (() => void) | null = null;
let refreshPromise: Promise<void> | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

// Sandbox Token extraction
let memorySandboxToken: string | null = null;
const urlParams = new URLSearchParams(window.location.search);
const tokenParam = urlParams.get("sandbox_token");
if (tokenParam) {
  memorySandboxToken = tokenParam;
  // Clean up URL so it doesn't linger
  urlParams.delete("sandbox_token");
  const search = urlParams.toString();
  window.history.replaceState({}, document.title, `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`);
}

// Intercept requests to add sandbox token dynamically if present
api.interceptors.request.use((config) => {
  if (memorySandboxToken) {
    config.headers["Authorization"] = `Bearer ${memorySandboxToken}`;
  }
  return config;
});

// Endpoints whose own 401s must never trigger a refresh/redirect cycle
// (they are responsible for authentication).
function isAuthEndpoint(url: string): boolean {
  return url.includes("/auth/login") || url.includes("/auth/refresh");
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url: string = original?.url ?? "";
    if (status === 401 && original && !original._retry && !isAuthEndpoint(url)) {
      if (memorySandboxToken) {
        memorySandboxToken = null;
        onUnauthorized?.();
        return Promise.reject(error);
      }
      original._retry = true;
      try {
        refreshPromise ??= api.post("/auth/refresh").then(() => {}).finally(() => {
          refreshPromise = null;
        });
        await refreshPromise;
        return api(original);
      } catch {
        if (!url.includes("/auth/me")) onUnauthorized?.();
      }
    } else if (status === 401 && original?._retry && !isAuthEndpoint(url)) {
      if (!url.includes("/auth/me")) onUnauthorized?.();
    } else if (status === 401 && isAuthEndpoint(url) && memorySandboxToken) {
        memorySandboxToken = null;
    }
    return Promise.reject(error);
  }
);

// Batches
export const getBatches = (page = 1, pageSize = 50) =>
  api.get(`/admin/batches`, { params: { page, page_size: pageSize } }).then((r) => r.data);

export const createBatch = (data: { batch_code: string; name: string; description?: string }) =>
  api.post(`/admin/batches`, data).then((r) => r.data);


export const updateBatch = (id: string, data: { name?: string; description?: string }) =>
  api.patch(`/admin/batches/${id}`, data).then((r) => r.data);

export const deleteBatch = (id: string) => api.delete(`/admin/batches/${id}`).then((r) => r.data);

export const assignBatchStudents = (batchId: string, rollNumbers: string[]) =>
  api.post(`/admin/batches/${batchId}/assign`, { roll_numbers: rollNumbers }).then((r) => r.data);

export const uploadBatchStudents = (batchId: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(`/admin/batches/${batchId}/upload`, formData).then((r) => r.data);
};

export const getBatchStudents = (batchId: string, page = 1, pageSize = 50) =>
  api.get(`/admin/batches/${batchId}/students`, { params: { page, page_size: pageSize } }).then((r) => r.data);

export const removeBatchStudent = (batchId: string, studentId: string) =>
  api.delete(`/admin/batches/${batchId}/students/${studentId}`).then((r) => r.data);

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const messages = detail.map((item: { loc?: unknown[]; msg?: string }) => {
        const field = item.loc?.filter((part) => part !== "body" && part !== "query").join(".");
        return item.msg ? `${field ? `${field} — ` : ""}${item.msg}` : "";
      }).filter(Boolean);
      if (messages.length) return messages.join(". ");
    }
    return "We couldn't complete your request right now. Please try again.";
  }
  return "Something went wrong. Please try again.";
}
