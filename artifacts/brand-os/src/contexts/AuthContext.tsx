import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getToken, getUser, getWorkspace, saveAuth, clearAuth, apiFetch, type AuthUser, type AuthWorkspace } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  workspace: AuthWorkspace | null;
  workspaces: AuthWorkspace[];
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  switchWorkspace: (workspace: AuthWorkspace) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getUser);
  const [workspace, setWorkspace] = useState<AuthWorkspace | null>(getWorkspace);
  const [workspaces, setWorkspaces] = useState<AuthWorkspace[]>([]);
  const [token, setToken] = useState<string | null>(getToken);
  const [isLoading, setIsLoading] = useState(!!getToken());

  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const fetchMe = useCallback(async () => {
    try {
      const res = await apiFetch(`${baseUrl}/api/auth/me`);
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setWorkspaces(data.workspaces ?? []);
        if (!workspace && data.workspaces?.length) {
          setWorkspace(data.workspaces[0]);
          saveAuth(getToken()!, data.user, data.workspaces[0]);
        }
      } else {
        clearAuth();
        setUser(null);
        setWorkspace(null);
        setToken(null);
      }
    } catch {
      clearAuth();
      setUser(null);
      setWorkspace(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, workspace]);

  useEffect(() => {
    if (getToken()) {
      fetchMe();
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Login failed");
    }
    const data = await res.json();
    saveAuth(data.token, data.user, data.workspace);
    setToken(data.token);
    setUser(data.user);
    setWorkspace(data.workspace);
    setWorkspaces(data.workspace ? [data.workspace] : []);
    await fetchMe();
  };

  const register = async (email: string, name: string, password: string) => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Registration failed");
    }
    const data = await res.json();
    saveAuth(data.token, data.user, data.workspace);
    setToken(data.token);
    setUser(data.user);
    setWorkspace(data.workspace);
    setWorkspaces(data.workspace ? [data.workspace] : []);
  };

  const logout = () => {
    clearAuth();
    setToken(null);
    setUser(null);
    setWorkspace(null);
    setWorkspaces([]);
  };

  const switchWorkspace = (ws: AuthWorkspace) => {
    setWorkspace(ws);
    if (user && token) {
      saveAuth(token, user, ws);
    }
  };

  return (
    <AuthContext.Provider value={{ user, workspace, workspaces, token, isLoading, login, register, logout, switchWorkspace }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
