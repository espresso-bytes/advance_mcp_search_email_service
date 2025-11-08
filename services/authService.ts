
import { supabase } from './supabaseClient';
import type { User } from '../types';

/*
  ======================================================================================
  === SUPABASE DATABASE SCHEMA FOR AUTHENTICATION & USER PROFILES ===
  ======================================================================================
  
  Follow this guide to set up the necessary tables and policies in your Supabase project.

  --- 1. PROFILES TABLE ---
  This table stores public user data that is linked to the authenticated user.

  SQL to create the table:
  ```sql
  CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL
  );
  ```
  This creates a `profiles` table in the `public` schema with a one-to-one relationship
  to the `users` table in the `auth` schema.

  --- 2. NEW USER TRIGGER ---
  This function and trigger automatically create a new profile when a user signs up.

  SQL to create the function and trigger:
  ```sql
  -- Function to create a profile for a new user
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER AS $$
  BEGIN
    INSERT INTO public.profiles (id, name)
    VALUES (new.id, new.raw_user_meta_data->>'name');
    RETURN new;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- Trigger to call the function after a new user is created in auth.users
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  ```

  --- 3. ROW LEVEL SECURITY (RLS) POLICIES ---
  These policies are crucial for securing your data.

  SQL to enable RLS and create policies for the `profiles` table:
  ```sql
  -- Enable RLS on the profiles table
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

  -- Policy: Allow users to view their own profile.
  CREATE POLICY "Users can view their own profile."
  ON public.profiles FOR SELECT
  USING ( auth.uid() = id );

  -- Policy: Allow users to update their own profile.
  CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );
  ```
*/

/*
  ======================================================================================
  === DELETING A USER ACCOUNT (REQUIRES SUPABASE EDGE FUNCTION) ===
  ======================================================================================
  
  Supabase protects your `auth.users` table and does not allow users to be deleted
  from the client-side for security reasons. To implement this feature, you must create
  a Supabase Edge Function.

  --- 1. Create the Edge Function ---
  In your Supabase project (either locally via CLI or in the web dashboard), create a 
  new function with the name `delete-user-account`.

  --- 2. Add the Function Code ---
  The code for the function should look like this. It creates a Supabase admin client
  to perform the privileged delete operation.

  File: `supabase/functions/delete-user-account/index.ts`
  ```typescript
  import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

  serve(async (req) => {
    try {
      // Create a Supabase client with the Auth context of the logged-in user.
      const userSupabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      )
      
      // Get the user's details to verify who is making the request.
      const { data: { user }, error: userError } = await userSupabaseClient.auth.getUser()
      if (userError) throw userError

      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Create a Supabase admin client to perform the deletion.
      // This requires the SUPABASE_SERVICE_ROLE_KEY to be set as an environment variable for the function.
      const adminSupabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      const { error: deleteError } = await adminSupabaseClient.auth.admin.deleteUser(user.id)
      if (deleteError) throw deleteError

      return new Response(JSON.stringify({ message: 'User deleted successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  })
  ```
  --- 3. Deploy the Function ---
  Deploy this function to your Supabase project. The frontend code below will then
  be able to call it successfully.
*/


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
    // FIX: Corrected typo from onAuthStateChanged to onAuthStateChange.
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
            // If the user has a session but no profile, they may have been deleted.
            // Sign them out to ensure data consistency.
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