import axios from 'axios';
import { User, Room, File } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  register: async (username: string, email: string, password: string) => {
    const { data } = await api.post('/auth/register', { username, email, password });
    return data;
  },

  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },

  verify: async (): Promise<{ user: User }> => {
    const { data } = await api.get('/auth/verify');
    return data;
  },
};

// Rooms API
export const roomsAPI = {
  create: async (name: string, isPublic: boolean = false): Promise<Room> => {
    const { data } = await api.post('/rooms', { name, isPublic });
    return data;
  },

  getMyRooms: async (): Promise<{ rooms: Room[] }> => {
    const { data } = await api.get('/rooms/my-rooms');
    return data;
  },

  joinByCode: async (inviteCode: string): Promise<{ room: Room }> => {
    const { data } = await api.post(`/rooms/join/${inviteCode}`);
    return data;
  },

  getRoom: async (roomId: string): Promise<{ room: Room }> => {
    const { data } = await api.get(`/rooms/${roomId}`);
    return data;
  },

  deleteRoom: async (roomId: string) => {
    const { data } = await api.delete(`/rooms/${roomId}`);
    return data;
  },
};

// Files API
export const filesAPI = {
  getRoomFiles: async (roomId: string): Promise<{ files: File[] }> => {
    const { data } = await api.get(`/files/room/${roomId}`);
    return data;
  },

  getFile: async (fileId: string): Promise<{ file: File }> => {
    const { data } = await api.get(`/files/${fileId}`);
    return data;
  },

  createFile: async (roomId: string, name: string, language: string = 'javascript'): Promise<{ file: File }> => {
    const { data } = await api.post('/files', { roomId, name, language });
    return data;
  },

  updateFile: async (fileId: string, content: string) => {
    const { data } = await api.put(`/files/${fileId}`, { content });
    return data;
  },

  deleteFile: async (fileId: string) => {
    const { data } = await api.delete(`/files/${fileId}`);
    return data;
  },

  getVersions: async (fileId: string) => {
    const { data } = await api.get(`/files/${fileId}/versions`);
    return data;
  },
};

export default api;