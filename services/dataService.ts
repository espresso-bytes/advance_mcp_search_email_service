
import { supabase } from './supabaseClient';
import type { Conversation, Message } from '../types';

export const dataService = {

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