import { useState, useEffect } from 'react';
import { authAPI, roomsAPI } from './services/api';
import { socketService } from './services/socket';
import { User, Room } from './types';
import Auth from './components/Auth';
import RoomList from './components/RoomList';
import Editor from './components/Editor';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      socketService.connect();
    }

    return () => {
      if (!user) {
        socketService.disconnect();
      }
    };
  }, [user]);

  const verifyToken = async () => {
    try {
      const { user } = await authAPI.verify();
      setUser(user);
    } catch (error) {
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData: User, token: string) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setCurrentRoom(null);
    socketService.disconnect();
  };

  const handleJoinRoom = (room: Room) => {
    setCurrentRoom(room);
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  if (!currentRoom) {
    return (
      <RoomList
        user={user}
        onJoinRoom={handleJoinRoom}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Editor
      user={user}
      room={currentRoom}
      onLeaveRoom={handleLeaveRoom}
    />
  );
}

export default App;