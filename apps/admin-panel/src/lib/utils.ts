import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE =
  import.meta.env.VITE_API_URL || "/api";

async function fetchApi(path: string, options?: RequestInit) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Request failed");
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    fetchApi("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  domains: {
    list: () => fetchApi("/domains"),
    get: (id: string) => fetchApi(`/domains/${id}`),
    create: (name: string) =>
      fetchApi("/domains", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    delete: (id: string) =>
      fetchApi(`/domains/${id}`, { method: "DELETE" }),
    generateDkim: (id: string) =>
      fetchApi(`/domains/${id}/dkim/generate`, { method: "POST" }),
    dnsRecords: (id: string) => fetchApi(`/domains/${id}/dns`),
  },

  smtp: {
    list: () => fetchApi("/smtp-credentials"),
    create: (domainId: string) =>
      fetchApi(`/smtp-credentials/domain/${domainId}`, { method: "POST" }),
    rotate: (id: string) =>
      fetchApi(`/smtp-credentials/${id}/rotate`, { method: "POST" }),
    toggle: (id: string) =>
      fetchApi(`/smtp-credentials/${id}/toggle`, { method: "POST" }),
    delete: (id: string) =>
      fetchApi(`/smtp-credentials/${id}`, { method: "DELETE" }),
  },

  emails: {
    list: (page = 1) => fetchApi(`/emails?page=${page}`),
    get: (id: string) => fetchApi(`/emails/${id}`),
  },

  logs: {
    list: (page = 1) => fetchApi(`/logs?page=${page}`),
  },

  queue: {
    status: () => fetchApi("/queue/status"),
  },
};
