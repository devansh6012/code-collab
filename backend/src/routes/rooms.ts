import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Room, File } from '../types';

const router = express.Router();

// Generate random invite code
const generateInviteCode = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

// Create room
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, isPublic = false } = req.body;
    const userId = req.userId!;

    if (!name) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const roomId = uuidv4();
    const inviteCode = generateInviteCode();

    await query(
      'INSERT INTO rooms (id, name, owner_id, invite_code, is_public) VALUES (?, ?, ?, ?, ?)',
      [roomId, name, userId, inviteCode, isPublic]
    );

    // Add creator as member
    await query(
      'INSERT INTO room_members (room_id, user_id) VALUES (?, ?)',
      [roomId, userId]
    );

    // Create default file
    const fileId = uuidv4();
    await query(
      'INSERT INTO files (id, room_id, name, content, language) VALUES (?, ?, ?, ?, ?)',
      [fileId, roomId, 'index.js', '// Start coding here\n', 'javascript']
    );

    res.status(201).json({
      id: roomId,
      name,
      inviteCode,
      isPublic
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's rooms
router.get('/my-rooms', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const rooms = await query<Room[]>(
      `SELECT r.* FROM rooms r
       INNER JOIN room_members rm ON r.id = rm.room_id
       WHERE rm.user_id = ?
       ORDER BY r.created_at DESC`,
      [userId]
    );

    res.json({ rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join room by invite code
router.post('/join/:inviteCode', authenticate, async (req: AuthRequest, res) => {
  try {
    const { inviteCode } = req.params;
    const userId = req.userId!;

    const rooms = await query<Room[]>(
      'SELECT * FROM rooms WHERE invite_code = ?',
      [inviteCode]
    );

    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = rooms[0];

    // Check if already a member
    const existing = await query(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
      [room.id, userId]
    );

    if (existing.length === 0) {
      await query(
        'INSERT INTO room_members (room_id, user_id) VALUES (?, ?)',
        [room.id, userId]
      );
    }

    res.json({ room });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get room details
router.get('/:roomId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId!;

    // Check if user is member
    const members = await query(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const rooms = await query<Room[]>(
      'SELECT * FROM rooms WHERE id = ?',
      [roomId]
    );

    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ room: rooms[0] });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete room
router.delete('/:roomId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId!;

    const rooms = await query<Room[]>(
      'SELECT * FROM rooms WHERE id = ? AND owner_id = ?',
      [roomId, userId]
    );

    if (rooms.length === 0) {
      return res.status(403).json({ error: 'Only room owner can delete the room' });
    }

    await query('DELETE FROM rooms WHERE id = ?', [roomId]);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;