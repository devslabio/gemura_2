import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";

/** POST /auth/login and /auth/register can return 401 for invalid credentials — do not clear session + hard-redirect like an expired JWT. */
function isCredentialSubmissionRequest(config?: InternalAxiosRequestConfig): boolean {
  const method = (config?.method ?? 'get').toLowerCase();
  if (method !== 'post') return false;
  const raw = typeof config?.url === 'string' ? config.url.split('?')[0].replace(/\/$/, '') : '';
  return raw.endsWith('/auth/login') || raw.endsWith('/auth/register');
}

// Same Nest backend and DB as Gemura Web; only the Next app host differs.
// Nest uses global prefix `api`, so the browser must call `/api/...` on the API host.
// If NEXT_PUBLIC_API_URL is unset, default to same-origin `/api` (see next.config.ts dev rewrites).
function normalizeApiBaseUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "/api";
  const base = s.replace(/\/+$/, "");
  if (base === "/api" || base.endsWith("/api")) return base;
  if (/^https?:\/\//i.test(base)) return `${base}/api`;
  return base;
}

const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL || "/api");

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      // Hard upper bound so a hung/unreachable API surfaces as an error
      // instead of leaving the UI stuck on a skeleton loader.
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (typeof window !== "undefined") {
          const token = localStorage.getItem("gemura-auth-token");
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Handle unauthorized
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          if (typeof window !== "undefined") {
            if (isCredentialSubmissionRequest(error.config)) {
              return Promise.reject(error);
            }
            localStorage.removeItem("gemura-auth-token");
            localStorage.removeItem("gemura-auth-storage");
            window.location.href = "/auth/login";
          }
        }
        return Promise.reject(error);
      },
    );
  }

  async get<T>(url: string, config?: any): Promise<T> {
    const response = await this.client.get(url, config);
    return response.data;
  }

  async getBlob(url: string, config?: { params?: Record<string, unknown> }): Promise<Blob> {
    const response = await this.client.get(url, { ...config, responseType: 'blob' });
    return response.data as Blob;
  }

  async post<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.put(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: any): Promise<T> {
    const response = await this.client.delete(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();

