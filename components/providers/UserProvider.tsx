'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { NavFeatures } from '@/lib/navigation';

interface UserInfo {
  name: string;
  email: string;
  role: string;
  isAdmin: boolean;
  isCustomerOwner: boolean;
  features: NavFeatures;
  /**
   * The customer an admin is currently scoped to, or null for everyone else
   * and for an admin who has not chosen one.
   *
   * Carried here rather than in a provider of its own: /api/user/me already
   * resolves it, so a separate context would mean a second request for a value
   * that is part of the same answer to "who am I acting as right now".
   */
  selectedCustomer: { id: string; name: string } | null;
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
            features: data.features || {},
            selectedCustomer: data.selectedCustomer || null,
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
