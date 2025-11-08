
import { supabase } from './supabaseClient';
import type { Conversation, Message } from '../types';

/*
  ======================================================================================
  === SUPABASE DATABASE SCHEMA FOR CONVERSATIONS & MESSAGES ===
  ======================================================================================

  Follow this guide to set up the necessary tables and policies in your Supabase project.

  --- DEBUGGING NOTE ---
  If you are seeing "403 Forbidden" errors in the browser console when trying to send
  a message, it almost always means that the Row Level Security (RLS) policies below
  have not been enabled or are incorrect. Please double-check that RLS is enabled for
  both the `conversations` and `messages` tables and that the policies have been
  created exactly as described below in your Supabase SQL editor.

  --- 1. CONVERSATIONS TABLE ---
  This table stores metadata for each chat session.

  SQL to create the table:
  ```sql
  CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    file_name TEXT,
    is_web_search_enabled BOOLEAN DEFAULT FALSE
  );
  ```

  --- 2. MESSAGES TABLE ---
  This table stores individual messages for each conversation.

  SQL to create the table:
  ```sql
  CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL, -- Should be 'user' or 'ai'
    text TEXT NOT NULL,
    sources JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
  The `sources` column uses JSONB to efficiently store structured data.

  --- 3. ROW LEVEL SECURITY (RLS) POLICIES ---
  Enable RLS and apply these policies to secure user data.

  SQL for RLS on `conversations`:
  ```sql
  ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage their own conversations."
  ON public.conversations FOR ALL
  USING ( auth.uid() = user_id );
  ```

  SQL for RLS on `messages`:
  ```sql
  ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage messages in their conversations."
  ON public.messages FOR ALL
  USING (
    auth.uid() = (
      SELECT user_id FROM public.conversations WHERE id = conversation_id
    )
  );
  ```
*/

export const dataService = {
  /**
   * Fetches all conversations for a user, without their messages.
   * Messages are loaded on-demand to improve initial load performance.
   */
  async getConversations(userId: string): Promise<Conversation[]> {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
    // Return conversations with an empty messages array.
    return (conversations || []).map(c => ({...c, messages: []}));
  },

  /**
   * Fetches all messages for a single conversation.
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error(`Error fetching messages for conversation ${conversationId}:`, error);
        return [];
    }
    return messages || [];
  },


  async createConversation(data: { user_id: string; title: string }): Promise<Conversation | null> {
    const { data: newConversation, error } = await supabase
      .from('conversations')
      .insert(data)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
    
    if (!newConversation) {
        console.error('Failed to create conversation: No data was returned from the database.');
        return null;
    }

    return {...newConversation, messages: []};
  },

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | null> {
    const { data: updatedConversation, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating conversation:', error);
      return null;
    }
    return updatedConversation;
  },
  
  async deleteConversation(id: string): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  },

  async addMessage(data: Omit<Message, 'id' | 'created_at'>): Promise<Message | null> {
    const { data: newMessage, error } = await supabase
        .from('messages')
        .insert(data)
        .select()
        .single();
    
    if (error) {
        console.error('Error adding message:', error);
        return null;
    }
    return newMessage;
  }
};