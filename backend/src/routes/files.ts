import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { File, FileVersion } from '../types';

const router = express.Router();

// Get all files in a room
router.get('/room/:roomId', authenticate, async (req: AuthRequest, res) => {
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

    const files = await query<File[]>(
      'SELECT * FROM files WHERE room_id = ? ORDER BY created_at ASC',
      [roomId]
    );

    res.json({ files });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single file
router.get('/:fileId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId!;

    const files = await query<File[]>(
      'SELECT * FROM files WHERE id = ?',
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];

    // Check if user has access to the room
    const members = await query(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
      [file.room_id, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ file });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new file
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomId, name, language = 'javascript' } = req.body;
    const userId = req.userId!;

    if (!roomId || !name) {
      return res.status(400).json({ error: 'Room ID and file name are required' });
    }

    // Check if user is member
    const members = await query(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const fileId = uuidv4();
    await query(
      'INSERT INTO files (id, room_id, name, content, language) VALUES (?, ?, ?, ?, ?)',
      [fileId, roomId, name, '', language]
    );

    const files = await query<File[]>(
      'SELECT * FROM files WHERE id = ?',
      [fileId]
    );

    res.status(201).json({ file: files[0] });
  } catch (error) {
    console.error('Create file error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update file (save version)
router.put('/:fileId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { fileId } = req.params;
    const { content } = req.body;
    const userId = req.userId!;

    const files = await query<File[]>(
      'SELECT * FROM files WHERE id = ?',
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];

    // Check if user has access
    const members = await query(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
      [file.room_id, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Save version
    const versionId = uuidv4();
    await query(
      'INSERT INTO file_versions (id, file_id, content, user_id) VALUES (?, ?, ?, ?)',
      [versionId, fileId, file.content, userId]
    );

    // Update file
    await query(
      'UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [content, fileId]
    );

    res.json({ message: 'File updated successfully' });
  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete file
router.delete('/:fileId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId!;

    const files = await query<File[]>(
      'SELECT f.*, r.owner_id FROM files f JOIN rooms r ON f.room_id = r.id WHERE f.id = ?',
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0] as File & { owner_id: string };

    // Only room owner can delete files
    if (file.owner_id !== userId) {
      return res.status(403).json({ error: 'Only room owner can delete files' });
    }

    await query('DELETE FROM files WHERE id = ?', [fileId]);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get file version history
router.get('/:fileId/versions', authenticate, async (req: AuthRequest, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId!;

    const files = await query<File[]>(
      'SELECT * FROM files WHERE id = ?',
      [fileId]
    );

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];

    // Check access
    const members = await query(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
      [file.room_id, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const versions = await query<FileVersion[]>(
      `SELECT fv.*, u.username 
       FROM file_versions fv
       LEFT JOIN users u ON fv.user_id = u.id
       WHERE fv.file_id = ?
       ORDER BY fv.created_at DESC
       LIMIT 50`,
      [fileId]
    );

    res.json({ versions });
  } catch (error) {
    console.error('Get versions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;