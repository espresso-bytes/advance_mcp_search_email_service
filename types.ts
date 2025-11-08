export interface User {
  id: string;
  email?: string;
  name: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai';
  text: string;
  sources?: { uri: string; title: string }[];
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  messages: Message[];
  created_at: string;
  file_name?: string | null;
  is_web_search_enabled?: boolean;
}
