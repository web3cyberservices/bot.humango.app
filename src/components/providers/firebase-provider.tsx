
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, onAuthStateChanged, User } from 'firebase/auth';

// Placeholder config - in production these should be in .env
const firebaseConfig = {
  apiKey: "placeholder-api-key",
  authDomain: "bot-humango-app.firebaseapp.com",
  projectId: "bot-humango-app",
  storageBucket: "bot-humango-app.appspot.com",
  messagingSenderId: "placeholder-id",
  appId: "placeholder-app-id"
};

const FirebaseContext = createContext<{
  app: FirebaseApp | null;
  auth: Auth | null;
  user: User | null;
  loading: boolean;
}>({
  app: null,
  auth: null,
  user: null,
  loading: true,
});

export const useFirebase = () => useContext(FirebaseContext);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [app, setApp] = useState<FirebaseApp | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const firebaseAuth = getAuth(firebaseApp);
    
    setApp(firebaseApp);
    setAuth(firebaseAuth);

    const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <FirebaseContext.Provider value={{ app, auth, user, loading }}>
      {children}
    </FirebaseContext.Provider>
  );
}
