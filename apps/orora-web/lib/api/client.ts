import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

/** True when the UI is opened on a loopback host (including IPv6 literal [::1]). */
function isBrowserLocalDevHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

// When running on localhost, use local backend unless NEXT_PUBLIC_API_URL is set.
// Use 127.0.0.1 (not "localhost") so the browser hits IPv4; Nest often binds 0.0.0.0 only,
// while "localhost" may resolve to ::1 and fail with a network error.
// Production / deployed app uses NEXT_PUBLIC_API_URL or remote default.
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (isBrowserLocalDevHost(host)) {
      return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3004/api';
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://159.198.65.38:3007/api';
}

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://159.198.65.38:3007/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: DEFAULT_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - resolve base URL (localhost → local backend) and add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (typeof window !== 'undefined') {
          config.baseURL = getApiBaseUrl();
          const token = localStorage.getItem('orora-auth-token');
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
          const isLoginRequest = error.config?.url?.includes('/auth/login');
          if (!isLoginRequest) {
            // Unauthorized on a protected request - clear auth and redirect to login
            localStorage.removeItem('orora-auth-token');
            localStorage.removeItem('orora-auth-storage');
            window.location.href = '/auth/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  get instance(): AxiosInstance {
    return this.client;
  }

  // Helper methods
  async get<T>(url: string, config?: any): Promise<T> {
    const response = await this.client.get(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.put(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.patch(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: any): Promise<T> {
    const response = await this.client.delete(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
