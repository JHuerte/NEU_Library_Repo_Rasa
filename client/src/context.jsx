import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);
const MetaContext = createContext(null);
const ToastContext = createContext(() => {});

export function AppProviders({ children }) {
  const [user, setUser] = useState(undefined);
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [toast, setToast] = useState(null);

  const refreshMeta = useCallback(() => api('/meta').then(setMeta).catch(setMetaError), []);
  useEffect(() => {
    api('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null));
    refreshMeta();
  }, [refreshMeta]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const auth = {
    user,
    loading: user === undefined,
    async login(email, password) {
      const d = await api('/auth/login', { method: 'POST', body: { email, password } });
      setUser(d.user);
      return d.user;
    },
    async register(fields) {
      const d = await api('/auth/register', { method: 'POST', body: fields });
      setUser(d.user);
      return d.user;
    },
    async logout() {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
    },
  };

  if (metaError) {
    return (
      <div className="wrap" style={{ paddingBlock: 40 }}>
        <div className="alert error">The repository server is not responding. Make sure the API is running (npm run dev) and reload this page.</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <MetaContext.Provider value={{ ...(meta ?? {}), ready: Boolean(meta), refreshMeta }}>
        <ToastContext.Provider value={setToast}>
          {children}
          {toast && <div className="toast" role="status">{toast}</div>}
        </ToastContext.Provider>
      </MetaContext.Provider>
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export const useMeta = () => useContext(MetaContext);
export const useToast = () => useContext(ToastContext);

export const isStaff = (user) => ['librarian', 'admin'].includes(user?.role);
