'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface UserInfo {
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isCustomerOwner: boolean;
}

interface UserContextValue {
  user: UserInfo | null;
  loading: boolean;
}

const UserContext = createContext<UserContextValue>({ user: null, loading: true });

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setUser({
            name: data.name || '',
            email: data.email || '',
            role: data.role || '',
            isAdmin: data.isAdmin || false,
            isCustomerOwner: data.isCustomerOwner || false,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <UserContext value={{ user, loading }}>
      {children}
    </UserContext>
  );
}

export function useUser() {
  return useContext(UserContext);
}
