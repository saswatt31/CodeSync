"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { getMe, logout as logoutApi } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Try to get token from localStorage (set on login)
    const savedToken = localStorage.getItem("cs_token");
    if (savedToken) {
      setToken(savedToken);
      connectSocket(savedToken);
    }

    getMe()
      .then(({ data }) => setUser(data.user))
      .catch(() => {
        setUser(null);
        localStorage.removeItem("cs_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem("cs_token", authToken);
    connectSocket(authToken);
  };

  const logout = async () => {
    await logoutApi().catch(() => {});
    setUser(null);
    setToken(null);
    localStorage.removeItem("cs_token");
    disconnectSocket();
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
