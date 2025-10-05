import { useState, useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { socketService } from '../services/socket';
import { filesAPI } from '../services/api';
import { User, Room, File, UserPresence, Operation, ChatMessage } from '../types';
import FileExplorer from './FileExplorer';
import UserPresenceList from './UserPresenceList';
import Chat from './Chat';

interface EditorProps {
  user: User;
  room: Room;
  onLeaveRoom: () => void;
}

export default function Editor({ user, room, onLeaveRoom }: EditorProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [code, setCode] = useState('');
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(true);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const isRemoteChangeRef = useRef(false);

  useEffect(() => {
    // Clear previous room data
    setUsers([]);
    setChatMessages([]);
    setFiles([]);
    setActiveFile(null);
    setCode('');
    
    // Join room via socket
    socketService.joinRoom(room.id, user.id, user.username);

    // Setup socket listeners
    socketService.on('room-users', handleRoomUsers);
    socketService.on('room-files', handleRoomFiles);
    socketService.on('user-joined', handleUserJoined);
    socketService.on('user-left', handleUserLeft);
    socketService.on('code-update', handleCodeUpdate);
    socketService.on('cursor-update', handleCursorUpdate);
    socketService.on('chat-message', handleChatMessage);
    socketService.on('chat-history', handleChatHistory);
    socketService.on('file-created', handleFileCreated);
    socketService.on('file-deleted', handleFileDeleted);

    socketService.getChatHistory();

    return () => {
      // Leave room when component unmounts
      socketService.leaveRoom(room.id);
      
      // Clean up listeners
      socketService.off('room-users', handleRoomUsers);
      socketService.off('room-files', handleRoomFiles);
      socketService.off('user-joined', handleUserJoined);
      socketService.off('user-left', handleUserLeft);
      socketService.off('code-update', handleCodeUpdate);
      socketService.off('cursor-update', handleCursorUpdate);
      socketService.off('chat-message', handleChatMessage);
      socketService.off('chat-history', handleChatHistory);
      socketService.off('file-created', handleFileCreated);
      socketService.off('file-deleted', handleFileDeleted);
    };
  }, [room.id, user.id, user.username]);

  // Auto-save active file content periodically
  useEffect(() => {
    if (!activeFile || !code) return;

    const saveInterval = setInterval(async () => {
      try {
        // Only save if content has changed
        const currentFile = files.find(f => f.id === activeFile.id);
        if (currentFile && currentFile.content !== code) {
          await filesAPI.updateFile(activeFile.id, code);
          // Update local state
          setFiles(prev => 
            prev.map(f => f.id === activeFile.id ? { ...f, content: code } : f)
          );
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 5000); // Save every 5 seconds

    return () => clearInterval(saveInterval);
  }, [activeFile, code, files]);

  const handleRoomUsers = (userList: UserPresence[]) => {
    setUsers(userList);
  };

  const handleRoomFiles = (fileList: File[]) => {
    setFiles(fileList);
    if (fileList.length > 0 && !activeFile) {
      setActiveFile(fileList[0]);
      setCode(fileList[0].content);
    }
  };

  const handleUserJoined = (userData: UserPresence) => {
    setUsers((prev) => {
      // Check if user already exists (prevent duplicates)
      const exists = prev.some(u => u.userId === userData.userId);
      if (exists) {
        return prev; // Don't add duplicate
      }
      return [...prev, userData];
    });
  };

  const handleUserLeft = (userData: { userId: string }) => {
    setUsers((prev) => prev.filter((u) => u.userId !== userData.userId));
  };

  const handleCodeUpdate = (data: { fileId: string; operation: Operation }) => {
    if (activeFile?.id !== data.fileId) return;

    isRemoteChangeRef.current = true;
    
    // Apply operation to current code
    const newCode = applyOperation(code, data.operation);
    setCode(newCode);

    // Update file in state
    setFiles((prev) =>
      prev.map((f) => (f.id === data.fileId ? { ...f, content: newCode } : f))
    );

    if (activeFile) {
      setActiveFile({ ...activeFile, content: newCode });
    }

    setTimeout(() => {
      isRemoteChangeRef.current = false;
    }, 100);
  };

  const handleCursorUpdate = (data: { userId: string; cursor: { line: number; column: number } }) => {
    const userPresence = users.find((u) => u.userId === data.userId);
    if (!userPresence || !editorRef.current || !monacoRef.current) return;

    // Remove old decorations
    decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, [
      {
        range: new monacoRef.current.Range(
          data.cursor.line,
          data.cursor.column,
          data.cursor.line,
          data.cursor.column + 1
        ),
        options: {
          className: 'remote-cursor',
          glyphMarginClassName: 'remote-cursor-glyph',
          stickiness: 1,
          beforeContentClassName: 'remote-cursor-label',
          hoverMessage: { value: userPresence.username },
        },
      },
    ]);
  };

  const handleChatMessage = (message: ChatMessage) => {
    setChatMessages((prev) => [...prev, message]);
  };

  const handleChatHistory = (messages: ChatMessage[]) => {
    setChatMessages(messages);
  };

  const handleFileCreated = (file: File) => {
    setFiles((prev) => [...prev, file]);
  };

  const handleFileDeleted = (data: { fileId: string }) => {
    setFiles((prev) => prev.filter(f => f.id !== data.fileId));
    
    // If deleted file was active, switch to another file
    if (activeFile?.id === data.fileId) {
      const remainingFiles = files.filter(f => f.id !== data.fileId);
      if (remainingFiles.length > 0) {
        setActiveFile(remainingFiles[0]);
        setCode(remainingFiles[0].content);
      } else {
        setActiveFile(null);
        setCode('');
      }
    }
  };

  const applyOperation = (content: string, operation: Operation): string => {
    if (operation.type === 'insert') {
      const before = content.substring(0, operation.position);
      const after = content.substring(operation.position);
      return before + (operation.text || '') + after;
    } else if (operation.type === 'delete') {
      const before = content.substring(0, operation.position);
      const after = content.substring(operation.position + (operation.length || 0));
      return before + after;
    }
    return content;
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!value || !activeFile || isRemoteChangeRef.current) return;

    const newCode = value;
    const oldCode = code;

    // Calculate operation
    const operation = calculateOperation(oldCode, newCode);
    if (operation) {
      socketService.sendCodeChange(activeFile.id, operation);
    }

    setCode(newCode);
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFile.id ? { ...f, content: newCode } : f))
    );
  };

  const calculateOperation = (oldText: string, newText: string): Operation | null => {
    // Simple diff algorithm
    const oldLen = oldText.length;
    const newLen = newText.length;

    let i = 0;
    while (i < oldLen && i < newLen && oldText[i] === newText[i]) {
      i++;
    }

    if (newLen > oldLen) {
      // Insert
      return {
        type: 'insert',
        position: i,
        text: newText.substring(i, newLen - (oldLen - i)),
        userId: user.id,
        timestamp: Date.now(),
      };
    } else if (newLen < oldLen) {
      // Delete
      return {
        type: 'delete',
        position: i,
        length: oldLen - newLen,
        userId: user.id,
        timestamp: Date.now(),
      };
    }

    return null;
  };

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track cursor position
    editor.onDidChangeCursorPosition((e: any) => {
      if (activeFile) {
        socketService.sendCursorPosition(
          activeFile.id,
          e.position.lineNumber,
          e.position.column
        );
      }
    });
  };

  const handleFileSelect = (file: File) => {
    // Save current file content before switching
    if (activeFile && code !== activeFile.content) {
      const updatedFiles = files.map(f => 
        f.id === activeFile.id ? { ...f, content: code } : f
      );
      setFiles(updatedFiles);
    }
    
    // Switch to new file
    setActiveFile(file);
    setCode(file.content);
  };

  const handleSendMessage = (message: string) => {
    socketService.sendChatMessage(message);
  };

  const handleCreateFile = async (name: string, language: string) => {
    try {
      // Only create via socket - it will handle database creation and broadcast
      socketService.createFile(room.id, name, language);
    } catch (error) {
      console.error('Failed to create file:', error);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      // Only delete via socket - it will handle database deletion and broadcast
      socketService.deleteFile(fileId);
      
      // If deleting active file, switch to first remaining file
      if (activeFile?.id === fileId) {
        const remainingFiles = files.filter(f => f.id !== fileId);
        if (remainingFiles.length > 0) {
          setActiveFile(remainingFiles[0]);
          setCode(remainingFiles[0].content);
        } else {
          setActiveFile(null);
          setCode('');
        }
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={onLeaveRoom}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            ← Back
          </button>
          <div>
            <h2 className="text-xl font-bold">{room.name}</h2>
            <p className="text-sm text-gray-400">Invite code: {room.invite_code}</p>
          </div>
        </div>
        <UserPresenceList users={users} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer */}
        <FileExplorer
          files={files}
          activeFile={activeFile}
          onFileSelect={handleFileSelect}
          onCreateFile={handleCreateFile}
          onDeleteFile={handleDeleteFile}
        />

        {/* Editor */}
        <div className="flex-1 flex flex-col">
          {activeFile && (
            <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
              <span className="text-sm">{activeFile.name}</span>
            </div>
          )}
          <div className="flex-1">
            <MonacoEditor
              height="100%"
              language={activeFile?.language || 'javascript'}
              theme="vs-dark"
              value={code}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <Chat
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            onClose={() => setShowChat(false)}
          />
        )}
      </div>

      {/* Chat Toggle Button */}
      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg"
        >
          💬 Chat
        </button>
      )}
    </div>
  );
}