import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
const AuthContext = createContext();
export const AuthProvider = ({ children }) => {
  const [user,setUser]=useState(null), [isLoadingAuth,setLoading]=useState(true), [authChecked,setChecked]=useState(false);
  const checkUserAuth=useCallback(async()=>{setLoading(true);try{setUser(await base44.auth.me());}catch{setUser(null);}finally{setLoading(false);setChecked(true);}},[]);
  useEffect(()=>{checkUserAuth();},[checkUserAuth]);
  const logout=async()=>{await base44.auth.logout();setUser(null);window.location.href='/';};
  return <AuthContext.Provider value={{user,isAuthenticated:!!user,isLoadingAuth,authChecked,checkUserAuth,logout,navigateToLogin:()=>{window.location.href='/login';}}}>{children}</AuthContext.Provider>;
};
export const useAuth=()=>useContext(AuthContext);
