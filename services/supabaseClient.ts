import { createClient } from '@supabase/supabase-js';

// IMPORTANT:
// To connect to your Supabase backend, you need to provide the project URL and anon key.
// These should be stored securely as environment variables.
//
// 1. Create a new project on https://supabase.com/
// 2. Go to your project's Settings > API.
// 3. Find your Project URL and anon public key.
// 4. These variables (SUPABASE_URL, SUPABASE_ANON_KEY) must be provided in the
//    execution environment for this application to work.

const supabaseUrl = 'https://nqihlujvyvviclijqzko.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xaWhsdWp2eXZ2aWNsaWpxemtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTUyNjcsImV4cCI6MjA3NzM5MTI2N30.DW8lwWHzceULmHnE6Fs2prpM3I9_QxfSGyt_0zAKaR8';

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL or anon key is missing from environment variables.");
}

// FIX: Reverted to the default localStorage for more persistent and stable sessions.
// The previous use of sessionStorage may have contributed to issues with session
// handling for authenticated database operations.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
});
