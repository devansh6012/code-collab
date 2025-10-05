import { UserPresence } from '../types';

interface UserPresenceListProps {
  users: UserPresence[];
}

export default function UserPresenceList({ users }: UserPresenceListProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-400">Active Users:</span>
      <div className="flex -space-x-2">
        {users.map((user) => (
          <div
            key={user.userId}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium border-2 border-gray-800"
            style={{ backgroundColor: user.color }}
            title={user.username}
          >
            {user.username.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      <span className="text-sm text-gray-400">({users.length})</span>
    </div>
  );
}