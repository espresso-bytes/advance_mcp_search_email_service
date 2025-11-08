
import { supabase } from './supabaseClient';
import type { User } from '../types';

const authService = {
  async signUp(name: string, email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
        },
      },
    });
    if (error) throw error;
  },

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  onAuthStateChange(callback: (event: string, user: User | null) => void) {
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', session.user.id)
            .single();
          
          if (!profile) {
            // If user exists in session but not in profiles table, they've been deleted.
            // Inform the app that there is no user, and actively sign out to clear session.
            callback(event, null);
            await supabase.auth.signOut();
            return;
          }

          const user: User = {
            id: session.user.id,
            email: session.user.email,
            name: profile.name,
          };
          callback(event, user);
        } else {
          callback(event, null);
        }
      }
    );
    return { unsubscribe: () => subscription.unsubscribe() };
  },

  async getCurrentUser(): Promise<User | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', session.user.id)
            .single();

        if (!profile) {
            
            await supabase.auth.signOut();
            return null;
        }

        return {
            id: session.user.id,
            email: session.user.email,
            name: profile.name,
        };
    }
    return null;
  },

  async updateUser(updates: { name?: string; password?: string }): Promise<void> {
    if (updates.password) {
      const { error } = await supabase.auth.updateUser({ password: updates.password });
      if (error) throw error;
    }

    if (updates.name) {
      const user = await this.getCurrentUser();
      if (!user) throw new Error("User not found");
      
      const { error } = await supabase
        .from('profiles')
        .update({ name: updates.name })
        .eq('id', user.id);
      
      if (error) throw error;
    }
  },

  async deleteUserAccount(): Promise<void> {
    const { error } = await supabase.functions.invoke('delete-user-account', {
        method: 'POST',
    });

    if (error) {
        console.error("Error deleting user account:", error);
        throw new Error(`Failed to delete account: ${error.message}`);
    }
  },
};

export { authService };