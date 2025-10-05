import { Server, Socket } from 'socket.io';
import redisClient from '../config/redis';
import { query } from '../config/database';
import { OperationalTransform } from '../services/ot';
import { Operation, UserPresence, ChatMessage, SocketData } from '../types';

// Colors for user cursors
const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
];

let colorIndex = 0;

export const setupCollaboration = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Join a room
    socket.on('join-room', async (data: { roomId: string; userId: string; username: string }) => {
      try {
        const { roomId, userId, username } = data;

        // Verify user has access to room
        const members = await query(
          'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
          [roomId, userId]
        );

        if (members.length === 0) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Join room
        socket.join(roomId);
        
        // Store socket data
        (socket.data as SocketData) = { roomId, userId, username };

        // Assign color
        const color = CURSOR_COLORS[colorIndex % CURSOR_COLORS.length];
        colorIndex++;

        // Store user presence in Redis
        const presenceKey = `presence:${roomId}:${userId}`;
        await redisClient.setEx(presenceKey, 3600, JSON.stringify({
          userId,
          username,
          color,
          socketId: socket.id
        }));

        // Get all users in room
        const presenceKeys = await redisClient.keys(`presence:${roomId}:*`);
        const users: UserPresence[] = [];
        
        for (const key of presenceKeys) {
          const data = await redisClient.get(key);
          if (data) {
            const user = JSON.parse(data);
            users.push({
              userId: user.userId,
              username: user.username,
              color: user.color
            });
          }
        }

        // Send current users to new user
        socket.emit('room-users', users);

        // Notify others
        socket.to(roomId).emit('user-joined', {
          userId,
          username,
          color
        });

        // Get room files
        const files = await query(
          'SELECT * FROM files WHERE room_id = ? ORDER BY created_at ASC',
          [roomId]
        );

        socket.emit('room-files', files);

        console.log(`User ${username} joined room ${roomId}`);
      } catch (error) {
        console.error('Join room error:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Handle code changes
    socket.on('code-change', async (data: { 
      fileId: string; 
      operation: Operation;
    }) => {
      try {
        const { fileId, operation } = data;
        const socketData = socket.data as SocketData;
        
        if (!socketData?.roomId) return;

        // Get pending operations for this file from Redis
        const pendingKey = `pending:${fileId}`;
        const pendingOps = await redisClient.lRange(pendingKey, 0, -1);
        
        // Transform operation against pending operations
        let transformedOp = operation;
        for (const opStr of pendingOps) {
          const pendingOp = JSON.parse(opStr);
          transformedOp = OperationalTransform.transform(transformedOp, pendingOp);
        }

        // Apply operation to get new content
        const files = await query(
          'SELECT content FROM files WHERE id = ?',
          [fileId]
        );

        if (files.length === 0) return;

        const currentContent = files[0].content || '';
        const newContent = OperationalTransform.apply(currentContent, transformedOp);

        // Update file in database
        await query(
          'UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newContent, fileId]
        );

        // Add to pending operations (keep last 100)
        await redisClient.rPush(pendingKey, JSON.stringify(transformedOp));
        await redisClient.lTrim(pendingKey, -100, -1);
        await redisClient.expire(pendingKey, 300); // 5 minutes

        // Broadcast to other users in room
        socket.to(socketData.roomId).emit('code-update', {
          fileId,
          operation: transformedOp,
          userId: socketData.userId
        });

      } catch (error) {
        console.error('Code change error:', error);
      }
    });

    // Handle cursor position changes
    socket.on('cursor-position', async (data: {
      fileId: string;
      line: number;
      column: number;
    }) => {
      try {
        const socketData = socket.data as SocketData;
        if (!socketData?.roomId) return;

        const presenceKey = `presence:${socketData.roomId}:${socketData.userId}`;
        const presenceData = await redisClient.get(presenceKey);
        
        if (!presenceData) return;

        const presence = JSON.parse(presenceData);
        presence.cursor = { line: data.line, column: data.column };
        
        await redisClient.setEx(presenceKey, 3600, JSON.stringify(presence));

        socket.to(socketData.roomId).emit('cursor-update', {
          userId: socketData.userId,
          cursor: { line: data.line, column: data.column }
        });
      } catch (error) {
        console.error('Cursor position error:', error);
      }
    });

    // Handle chat messages
    socket.on('chat-message', async (data: { message: string; codeSnippet?: string }) => {
      try {
        const socketData = socket.data as SocketData;
        if (!socketData?.roomId) return;

        const chatMessage: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          userId: socketData.userId,
          username: socketData.username,
          message: data.message,
          timestamp: Date.now(),
          codeSnippet: data.codeSnippet
        };

        // Broadcast to room
        io.to(socketData.roomId).emit('chat-message', chatMessage);

        // Store in Redis (keep last 100 messages)
        const chatKey = `chat:${socketData.roomId}`;
        await redisClient.rPush(chatKey, JSON.stringify(chatMessage));
        await redisClient.lTrim(chatKey, -100, -1);
        await redisClient.expire(chatKey, 86400); // 24 hours
      } catch (error) {
        console.error('Chat message error:', error);
      }
    });

    // Get chat history
    socket.on('get-chat-history', async () => {
      try {
        const socketData = socket.data as SocketData;
        if (!socketData?.roomId) return;

        const chatKey = `chat:${socketData.roomId}`;
        const messages = await redisClient.lRange(chatKey, -50, -1);
        
        const chatHistory = messages.map(msg => JSON.parse(msg));
        socket.emit('chat-history', chatHistory);
      } catch (error) {
        console.error('Get chat history error:', error);
      }
    });

    // Handle file creation
    socket.on('create-file', async (data: { roomId: string; fileName: string; language: string }) => {
      try {
        const socketData = socket.data as SocketData;
        if (!socketData?.roomId) return;

        const { v4: uuidv4 } = await import('uuid');
        const fileId = uuidv4();

        await query(
          'INSERT INTO files (id, room_id, name, content, language) VALUES (?, ?, ?, ?, ?)',
          [fileId, data.roomId, data.fileName, '', data.language]
        );

        const newFile = {
          id: fileId,
          room_id: data.roomId,
          name: data.fileName,
          content: '',
          language: data.language,
          created_at: new Date()
        };

        // Broadcast to all users in room
        io.to(socketData.roomId).emit('file-created', newFile);
      } catch (error) {
        console.error('Create file error:', error);
      }
    });

    // Handle file deletion
    socket.on('delete-file', async (data: { fileId: string }) => {
      try {
        const socketData = socket.data as SocketData;
        if (!socketData?.roomId) return;

        await query('DELETE FROM files WHERE id = ?', [data.fileId]);

        io.to(socketData.roomId).emit('file-deleted', { fileId: data.fileId });
      } catch (error) {
        console.error('Delete file error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      try {
        const socketData = socket.data as SocketData;
        
        if (socketData?.roomId && socketData?.userId) {
          // Remove from presence
          await redisClient.del(`presence:${socketData.roomId}:${socketData.userId}`);

          // Notify others
          socket.to(socketData.roomId).emit('user-left', {
            userId: socketData.userId,
            username: socketData.username
          });

          console.log(`User ${socketData.username} left room ${socketData.roomId}`);
        }
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    });
  });
};

export default setupCollaboration;