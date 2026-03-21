import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, Employee } from '../supabase';
import { Session } from '@supabase/supabase-js';

interface SupabaseContextType {
  session: Session | null;
  employee: Employee | null;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployee = async (email: string): Promise<Employee | null> => {
    await new Promise(resolve => setTimeout(resolve, 500));

    const { data, error: fetchError } = await supabase
      .from('employees')
      .select('*')
      .eq('email', email)
      .eq('activo', true)
      .single();

    if (fetchError || !data) {
      console.log('fetchEmployee error:', fetchError, 'email buscado:', email);
      return null;
    }

    return data as Employee;
  };

  const handleSession = async (sess: Session | null) => {
    setLoading(true);

    if (!sess) {
      setEmployee(null);
      setSession(null);
      setLoading(false);
      return;
    }

    const email = sess.user.email;

    if (!email) {
      await supabase.auth.signOut();
      setError('No se pudo obtener el email del usuario.');
      setLoading(false);
      return;
    }

    const emp = await fetchEmployee(email);

    if (!emp) {
      await supabase.auth.signOut();
      setSession(null);
      setEmployee(null);
      setError('No tienes acceso a esta aplicacion.');
      setLoading(false);
      return;
    }

    if (!emp.activo) {
      await supabase.auth.signOut();
      setSession(null);
      setEmployee(null);
      setError('Tu cuenta esta desactivada.');
      setLoading(false);
      return;
    }

    setSession(sess);
    setEmployee(emp);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      handleSession(sess);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (sess) {
        handleSession(sess);
      } else {
        setSession(null);
        setEmployee(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/raco'
      }
    });
    if (oauthError) setError(oauthError.message);
  };

  const loginWithEmail = async (email: string, password: string) => {
    setError(null);
    const { error: emailError } = await supabase.auth.signInWithPassword({ email, password });
    if (emailError) setError(emailError.message);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setEmployee(null);
    setSession(null);
    setError(null);
    sessionStorage.removeItem('pin_verified');
    sessionStorage.removeItem('employee_rol');
  };

  return (
    <SupabaseContext.Provider value={{ session, employee, loading, error, loginWithGoogle, loginWithEmail, logout }}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
