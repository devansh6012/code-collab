export interface User {
  id: string;
  username: string;
  email: string;
  password_hash?: string;
  created_at: Date;
}

export interface Room {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  is_public: boolean;
  created_at: Date;
}

export interface File {
  id: string;
  room_id: string;
  name: string;
  content: string;
  language: string;
  created_at: Date;
  updated_at: Date;
}

export interface FileVersion {
  id: string;
  file_id: string;
  content: string;
  user_id: string;
  created_at: Date;
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

export interface SocketData {
  userId: string;
  username: string;
  roomId: string;
}