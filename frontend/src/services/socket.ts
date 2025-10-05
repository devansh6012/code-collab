import { io, Socket } from 'socket.io-client';
import { Operation, UserPresence, ChatMessage, File } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });

    // Setup event forwarding
    this.setupEventForwarding();
  }

  private setupEventForwarding() {
    if (!this.socket) return;

    const events = [
      'room-users',
      'room-files',
      'user-joined',
      'user-left',
      'code-update',
      'cursor-update',
      'chat-message',
      'chat-history',
      'file-created',
      'file-deleted',
    ];

    events.forEach(event => {
      this.socket?.on(event, (data: any) => {
        this.emit(event, data);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  // Event emitter pattern for local listeners
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }

  // Socket.io emit methods
  joinRoom(roomId: string, userId: string, username: string) {
    this.socket?.emit('join-room', { roomId, userId, username });
  }

  leaveRoom(roomId: string) {
    this.socket?.emit('leave-room', { roomId });
  }

  sendCodeChange(fileId: string, operation: Operation) {
    this.socket?.emit('code-change', { fileId, operation });
  }

  sendCursorPosition(fileId: string, line: number, column: number) {
    this.socket?.emit('cursor-position', { fileId, line, column });
  }

  sendChatMessage(message: string, codeSnippet?: string) {
    this.socket?.emit('chat-message', { message, codeSnippet });
  }

  getChatHistory() {
    this.socket?.emit('get-chat-history');
  }

  createFile(roomId: string, fileName: string, language: string) {
    this.socket?.emit('create-file', { roomId, fileName, language });
  }

  deleteFile(fileId: string) {
    this.socket?.emit('delete-file', { fileId });
  }
}

export const socketService = new SocketService();
export default socketService;