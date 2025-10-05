export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Room {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  is_public: boolean;
  created_at: string;
}

export interface File {
  id: string;
  room_id: string;
  name: string;
  content: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface UserPresence {
  userId: string;
  username: string;
  color: string;
  cursor?: {
    line: number;
    column: number;
  };
}

export interface Operation {
  type: 'insert' | 'delete';
  position: number;
  text?: string;
  length?: number;
  userId: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
  codeSnippet?: string;
}