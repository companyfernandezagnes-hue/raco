import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase, EmployeeRol } from '../supabase';
import { useSupabase } from './SupabaseContext';

const MAX_INTENTOS = 3;
const SESSION_KEY_VERIFIED = 'pin_verified';
const SESSION_KEY_ROL = 'employee_rol';

interface PinContextType {
  pinVerificado: boolean;
  rol: EmployeeRol | null;
  intentosRestantes: number;
  pinError: string | null;
  verificarPin: (pin: string) => Promise<boolean>;
  resetPin: () => void;
}

const PinContext = createContext<PinContextType | undefined>(undefined);

export const PinProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { employee, logout } = useSupabase();

  const [pinVerificado, setPinVerificado] = useState<boolean>(() => {
    return sessionStorage.getItem(SESSION_KEY_VERIFIED) === 'true';
  });

  const [rol, setRol] = useState<EmployeeRol | null>(() => {
    return (sessionStorage.getItem(SESSION_KEY_ROL) as EmployeeRol) || null;
  });

  const [intentos, setIntentos] = useState(0);
  const [pinError, setPinError] = useState<string | null>(null);

  const verificarPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!employee) return false;

    const { data, error } = await supabase.rpc('verify_employee_pin', {
      p_email: employee.email,
      p_pin: pin
    });

    if (error || !data) {
      const nuevosIntentos = intentos + 1;
      setIntentos(nuevosIntentos);

      if (nuevosIntentos >= MAX_INTENTOS) {
        setPinError('Demasiados intentos fallidos. Cerrando sesion...');
        setTimeout(() => logout(), 1500);
      } else {
        setPinError(`PIN incorrecto. Te quedan ${MAX_INTENTOS - nuevosIntentos} intento(s).`);
      }
      return false;
    }

    // PIN correcto
    setPinVerificado(true);
    setRol(employee.rol);
    setPinError(null);
    setIntentos(0);
    sessionStorage.setItem(SESSION_KEY_VERIFIED, 'true');
    sessionStorage.setItem(SESSION_KEY_ROL, employee.rol);
    return true;
  }, [employee, intentos, logout]);

  const resetPin = useCallback(() => {
    setPinVerificado(false);
    setRol(null);
    setIntentos(0);
    setPinError(null);
    sessionStorage.removeItem(SESSION_KEY_VERIFIED);
    sessionStorage.removeItem(SESSION_KEY_ROL);
  }, []);

  return (
    <PinContext.Provider value={{
      pinVerificado,
      rol,
      intentosRestantes: MAX_INTENTOS - intentos,
      pinError,
      verificarPin,
      resetPin
    }}>
      {children}
    </PinContext.Provider>
  );
};

export const usePin = () => {
  const context = useContext(PinContext);
  if (context === undefined) {
    throw new Error('usePin must be used within a PinProvider');
  }
  return context;
};
