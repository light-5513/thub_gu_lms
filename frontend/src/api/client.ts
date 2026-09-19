import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

// Endpoints whose own 401s must never trigger a refresh/redirect cycle
// (they are the *cause* of authentication, or merely probe session state).
function isAuthEndpoint(url: string): boolean {
  return url.includes("/auth/login") || url.includes("/auth/refresh") || url.includes("/auth/me");
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url: string = original?.url ?? "";

    // Access token expired mid-session: try one silent refresh, then replay.
    if (status === 401 && original && !original._retry && !isAuthEndpoint(url)) {
      original._retry = true;
      try {
        await api.post("/auth/refresh");
        return api(original);
      } catch {
        onUnauthorized?.();
      }
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

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    return "We couldn't complete your request right now. Please try again.";
  }
  return "Something went wrong. Please try again.";
}
