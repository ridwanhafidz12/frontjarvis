/**
 * JARVIS API Client v2.1
 * Connects to the Python Flask backend.
 * 
 * Changes v2.1:
 *  - Session token support (separate from password)
 *  - New endpoints: processes, sysinfo, wifi, mouse, files/delete, files/rename
 *  - Retry logic for transient errors
 *  - Request timeout support
 *  - Network error detection
 */

const API_BASE_KEY   = "jarvis_api_url";
const TOKEN_KEY      = "jarvis_token";
const SESSION_TOKEN_KEY = "jarvis_session_token";

export function getApiBase(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(API_BASE_KEY) || "";
}

export function getToken(): string {
  if (typeof window === "undefined") return "";
  // Prefer session token, fallback to password token
  return (
    localStorage.getItem(SESSION_TOKEN_KEY) ||
    localStorage.getItem(TOKEN_KEY) ||
    ""
  );
}

export function getPasswordToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setCredentials(apiUrl: string, token: string, sessionToken?: string) {
  localStorage.setItem(API_BASE_KEY, apiUrl.replace(/\/$/, ""));
  localStorage.setItem(TOKEN_KEY, token);
  if (sessionToken) {
    localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
  }
}

export function clearCredentials() {
  localStorage.removeItem(API_BASE_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

// ── Core request ─────────────────────────────────────────────────────────────

interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
}

async function request(path: string, options: RequestOptions = {}): Promise<any> {
  const base  = getApiBase();
  const token = getToken();
  const { timeout = 30000, retries = 0, ...fetchOptions } = options;

  if (!base) throw new Error("API URL not configured");

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), timeout);

  const doFetch = async (attempt: number): Promise<any> => {
    try {
      const resp = await fetch(`${base}${path}`, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...fetchOptions.headers,
        },
      });

      clearTimeout(timeoutId);

      if (resp.status === 401) {
        // Token expired — clear session token and retry with password
        localStorage.removeItem(SESSION_TOKEN_KEY);
        throw new Error("Session expired. Please login again.");
      }

      if (resp.status === 429) {
        throw new Error("Too many requests. Please slow down.");
      }

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const ct = resp.headers.get("content-type");
      if (ct?.includes("application/json")) return resp.json();
      return resp.blob();
    } catch (e: any) {
      if (e.name === "AbortError") throw new Error("Request timed out");
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        return doFetch(attempt + 1);
      }
      throw e;
    }
  };

  return doFetch(0);
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(apiUrl: string, password: string) {
  const url = apiUrl.replace(/\/$/, "");
  const resp = await fetch(`${url}/api/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ password }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Invalid password or unreachable API" }));
    throw new Error(err.error || "Login failed");
  }
  const data = await resp.json();
  // Store session token if backend provides it
  if (data.token && data.token !== password) {
    localStorage.setItem(SESSION_TOKEN_KEY, data.token);
  }
  return data;
}

export async function logout() {
  try {
    await request("/api/logout", { method: "POST" });
  } catch {
    // Ignore errors on logout
  } finally {
    clearCredentials();
  }
}

export async function ping() {
  return request("/api/ping", { timeout: 5000, retries: 1 });
}

// ── System ──────────────────────────────────────────────────────────────────

export async function getStatus() {
  return request("/api/status", { timeout: 15000 });
}

export async function getSysInfo() {
  return request("/api/sysinfo", { timeout: 15000 });
}

export async function getLogs(lines = 100) {
  return request(`/api/logs?lines=${lines}`);
}

// ── Processes ────────────────────────────────────────────────────────────────

export async function getProcesses(sort = "cpu", limit = 50, search = "") {
  const params = new URLSearchParams({
    sort,
    limit: String(limit),
    ...(search ? { q: search } : {}),
  });
  return request(`/api/processes?${params}`);
}

export async function killProcess(pid: number) {
  return request("/api/process/kill", {
    method: "POST",
    body:   JSON.stringify({ pid }),
  });
}

// ── Control ──────────────────────────────────────────────────────────────────

export async function control(action: string, params: Record<string, any> = {}) {
  return request("/api/control", {
    method:  "POST",
    body:    JSON.stringify({ action, params }),
    timeout: 30000,
  });
}

export async function screenshot(monitor = 0) {
  return request(`/api/screenshot?monitor=${monitor}`);
}

export async function screenshotAll() {
  return request("/api/screenshot?all=true");
}

export async function webcam() {
  return request("/api/webcam", { timeout: 20000 });
}

export async function recordScreen(duration: number) {
  const base  = getApiBase();
  const token = getToken();
  const resp  = await fetch(`${base}/api/record`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ duration }),
  });
  if (!resp.ok) throw new Error("Recording failed");
  const blob = await resp.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `recording_${Date.now()}.mp4`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Mouse ───────────────────────────────────────────────────────────────────

export async function mouseAction(action: string, params: Record<string, any> = {}) {
  return request("/api/mouse", {
    method: "POST",
    body:   JSON.stringify({ action, ...params }),
  });
}

export async function getMousePosition() {
  return request("/api/mouse", {
    method: "POST",
    body:   JSON.stringify({ action: "position" }),
  });
}

// ── Network ─────────────────────────────────────────────────────────────────

export async function getWifiInfo() {
  return request("/api/wifi");
}

export async function getNetworkInterfaces() {
  return request("/api/network/interfaces");
}

// ── Files ───────────────────────────────────────────────────────────────────

export async function listFiles(path: string) {
  return request(`/api/files?path=${encodeURIComponent(path)}`);
}

export async function getDrives() {
  return request("/api/drives");
}

export function getDownloadUrl(path: string): string {
  const base  = getApiBase();
  const token = getToken();
  return `${base}/api/download?path=${encodeURIComponent(path)}&token=${token}`;
}

export async function uploadFile(file: File, dir?: string) {
  const base  = getApiBase();
  const token = getToken();
  const form  = new FormData();
  form.append("file", file);
  if (dir) form.append("dir", dir);
  const resp = await fetch(`${base}/api/upload`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}` },
    body:    form,
  });
  if (!resp.ok) throw new Error("Upload failed");
  return resp.json();
}

export async function deleteFile(path: string) {
  return request("/api/files/delete", {
    method: "POST",
    body:   JSON.stringify({ path }),
  });
}

export async function renameFile(path: string, newName: string) {
  return request("/api/files/rename", {
    method: "POST",
    body:   JSON.stringify({ path, new_name: newName }),
  });
}

export async function searchFiles(query: string, dir?: string, max = 50) {
  const params = new URLSearchParams({ q: query, max: String(max) });
  if (dir) params.set("dir", dir);
  return request(`/api/search?${params}`);
}

// ── AI ──────────────────────────────────────────────────────────────────────

export async function askAI(message: string, userId = 1) {
  return request("/api/ask", {
    method:  "POST",
    body:    JSON.stringify({ message, user_id: userId }),
    timeout: 60000,
  });
}

// ── Config ──────────────────────────────────────────────────────────────────

export async function getConfig() {
  return request("/api/config");
}

export async function updateConfig(data: Record<string, any>) {
  return request("/api/config", {
    method: "POST",
    body:   JSON.stringify(data),
  });
}

// ── Keylogger ────────────────────────────────────────────────────────────────

export async function keyloggerAction(action: string) {
  return request("/api/keylogger", {
    method: "POST",
    body:   JSON.stringify({ action }),
  });
}

export async function keyloggerStatus() {
  return request("/api/keylogger");
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export async function getMetrics() {
  return request("/api/metrics");
}

// ── URLs ─────────────────────────────────────────────────────────────────────

export function getCctvUrl(): string {
  const base  = getApiBase();
  const token = getToken();
  return `${base}/cctv?token=${token}`;
}

export function getStreamUrl(): string {
  const base  = getApiBase();
  const token = getToken();
  return `${base}/stream?token=${token}`;
}
