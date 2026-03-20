import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'ADMIN' | 'WAITER' | 'COOK';

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole, pin?: string) => boolean;
  isAuthorized: (allowedRoles: UserRole[]) => boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

const PINS: Record<UserRole, string> = {
  ADMIN: '1234', // In a real app, these would be in a database
  WAITER: '0000',
  COOK: '1111',
};

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setInternalRole] = useState<UserRole>(() => {
    return (localStorage.getItem('user_role') as UserRole) || 'ADMIN';
  });

  const setRole = (newRole: UserRole, pin?: string): boolean => {
    if (pin === PINS[newRole]) {
      setInternalRole(newRole);
      localStorage.setItem('user_role', newRole);
      return true;
    }
    return false;
  };

  const isAuthorized = (allowedRoles: UserRole[]) => {
    return allowedRoles.includes(role);
  };

  return (
    <RoleContext.Provider value={{ role, setRole, isAuthorized }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};
