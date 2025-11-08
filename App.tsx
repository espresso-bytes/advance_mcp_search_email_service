import React, { useState, useEffect, useCallback } from 'react';
import { AuthComponent } from './components/Auth';
import { ChatView } from './components/Chat';
import { authService } from './services/authService';
import type { User } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      await refreshUser();
      setLoading(false);
    };

    checkSession();

    const { unsubscribe } = authService.onAuthStateChange((_event, user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, [refreshUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900 text-white">
        Loading...
      </div>
    );
  }

  return user ? <ChatView user={user} onUserUpdate={refreshUser} /> : <AuthComponent />;
};

export default App;
