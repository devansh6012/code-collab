import { useState } from 'react';
import { File } from '../types';

interface FileExplorerProps {
  files: File[];
  activeFile: File | null;
  onFileSelect: (file: File) => void;
  onCreateFile: (name: string, language: string) => void;
  onDeleteFile: (fileId: string) => void;
}

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', ext: '.js' },
  { value: 'typescript', label: 'TypeScript', ext: '.ts' },
  { value: 'python', label: 'Python', ext: '.py' },
  { value: 'java', label: 'Java', ext: '.java' },
  { value: 'cpp', label: 'C++', ext: '.cpp' },
  { value: 'html', label: 'HTML', ext: '.html' },
  { value: 'css', label: 'CSS', ext: '.css' },
  { value: 'json', label: 'JSON', ext: '.json' },
];

export default function FileExplorer({
  files,
  activeFile,
  onFileSelect,
  onCreateFile,
  onDeleteFile,
}: FileExplorerProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fileName, setFileName] = useState('');
  const [language, setLanguage] = useState('javascript');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName) return;

    const langExt = LANGUAGES.find((l) => l.value === language)?.ext || '.txt';
    const fullName = fileName.includes('.') ? fileName : fileName + langExt;

    onCreateFile(fullName, language);
    setFileName('');
    setShowCreateModal(false);
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
        return '📜';
      case 'ts':
        return '📘';
      case 'py':
        return '🐍';
      case 'java':
        return '☕';
      case 'cpp':
      case 'c':
        return '⚙️';
      case 'html':
        return '🌐';
      case 'css':
        return '🎨';
      case 'json':
        return '📋';
      default:
        return '📄';
    }
  };

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex justify-between items-center">
        <h3 className="font-semibold text-sm">FILES</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="text-blue-400 hover:text-blue-300 text-xl leading-none"
          title="New File"
        >
          +
        </button>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {files.map((file) => (
          <div
            key={file.id}
            className={`group flex items-center justify-between px-4 py-2 hover:bg-gray-700 transition-colors ${
              activeFile?.id === file.id ? 'bg-gray-700 border-l-2 border-blue-500' : ''
            }`}
          >
            <button
              onClick={() => onFileSelect(file)}
              className="flex items-center gap-2 flex-1 text-left"
            >
              <span>{getFileIcon(file.name)}</span>
              <span className="text-sm truncate">{file.name}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Delete ${file.name}?`)) {
                  onDeleteFile(file.id);
                }
              }}
              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 px-2 py-1 transition-opacity"
              title="Delete file"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Create File Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Create New File</h2>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  File Name
                </label>
                <input
                  type="text"
                  required
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="example.js"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}