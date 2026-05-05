import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
  withCredentials: true,
});

// Interceptor to attach token
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("cs_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auth
export const register = (data) => api.post("/auth/register", data);
export const login = (data) => api.post("/auth/login", data);
export const logout = () => api.post("/auth/logout");
export const getMe = () => api.get("/auth/me");

// Sessions
export const createSession = (data) => api.post("/sessions", data);
export const getSessions = () => api.get("/sessions");
export const getSession = (id) => api.get(`/sessions/${id}`);
export const joinSession = (invite_code) => api.post("/sessions/join", { invite_code });
export const endSession = (id) => api.patch(`/sessions/${id}/end`);
export const saveNotes = (id, notes) => api.post(`/sessions/${id}/notes`, { notes });
export const getNotes = (id) => api.get(`/sessions/${id}/notes`);
export const getSessionEvents = (id) => api.get(`/sessions/${id}/events`);

// Execute
export const executeCode = (data) => api.post("/execute/run", data);

// AI
export const reviewCode = (data) => api.post("/ai/review", data);

export default api;
