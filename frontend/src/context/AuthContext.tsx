import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi } from "../api/endpoints";
import type { OrgMembership, OrgRole, User } from "../api/types";
import { storage } from "../lib/storage";

interface AuthContextValue {
  user: User | null;
  organizations: OrgMembership[];
  currentOrganizationId: string | null;
  currentRole: OrgRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    fullName: string;
    organizationName?: string;
    organizationId?: string;
  }) => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
  switchOrganization: (organizationId: string) => void;
  refreshOrganizations: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => storage.getUser<User>());
  const [organizations, setOrganizations] = useState<OrgMembership[]>([]);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(
    storage.getOrganizationId()
  );
  const [isLoading, setIsLoading] = useState(true);

  const loadOrganizations = useCallback(async () => {
    const { data } = await authApi.myOrganizations();
    setOrganizations(data);
    // If nothing selected yet (or the previous selection no longer applies),
    // default to the first membership so the console is immediately usable.
    setCurrentOrganizationId((prev) => {
      const stillValid = prev && data.some((m) => m.organizationId === prev);
      const next = stillValid ? prev : data[0]?.organizationId ?? null;
      if (next) storage.setOrganizationId(next);
      return next;
    });
  }, []);

  useEffect(() => {
    (async () => {
      if (storage.getAccessToken()) {
        try {
          await loadOrganizations();
        } catch {
          storage.clear();
          setUser(null);
        }
      }
      setIsLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login({ email, password });
    storage.setSession(result);
    storage.setUser(result.user);
    setUser(result.user);
    await loadOrganizations();
  }, [loadOrganizations]);

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      fullName: string;
      organizationName?: string;
      organizationId?: string;
    }) => {
      const result = await authApi.register(input);
      storage.setSession(result);
      storage.setUser(result.user);
      setUser(result.user);
      if (result.organization) {
        storage.setOrganizationId(result.organization.id);
        setCurrentOrganizationId(result.organization.id);
      }
      await loadOrganizations();
    },
    [loadOrganizations]
  );

  const logout = useCallback(async (allDevices = false) => {
    const refreshToken = storage.getRefreshToken();
    if (refreshToken) {
      await authApi.logout({ refreshToken, allDevices }).catch(() => undefined);
    }
    storage.clear();
    setUser(null);
    setOrganizations([]);
    setCurrentOrganizationId(null);
  }, []);

  const switchOrganization = useCallback((organizationId: string) => {
    storage.setOrganizationId(organizationId);
    setCurrentOrganizationId(organizationId);
  }, []);

  const currentRole = organizations.find((o) => o.organizationId === currentOrganizationId)?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        currentOrganizationId,
        currentRole,
        isLoading,
        isAuthenticated: Boolean(user && storage.getAccessToken()),
        login,
        register,
        logout,
        switchOrganization,
        refreshOrganizations: loadOrganizations,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
