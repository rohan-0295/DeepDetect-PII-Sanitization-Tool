/**
 * DeepDetect — File Upload
 * Drag-and-drop for JSON/CSV with clean B2B styling
 */
import React, { useRef, useState, useCallback } from 'react';
import { Upload, FileJson, FileText, X, AlertTriangle } from 'lucide-react';
import { formatBytes } from '../utils/SanitizationHelpers';

const MAX_SIZE = 5 * 1024 * 1024;

export default function FileUpload({ onFileReady, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');

  const processFile = useCallback((f) => {
    setError('');
    if (f.size > MAX_SIZE) {
      setError(`File too large — max ${formatBytes(MAX_SIZE)}`);
      return;
    }
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['json', 'csv', 'txt'].includes(ext)) {
      setError('Unsupported format. Upload .json, .csv, or .txt');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setFile({ name: f.name, size: f.size, type: ext, content });
      setPreview(content.slice(0, 400) + (content.length > 400 ? '\n…' : ''));
      onFileReady?.({ name: f.name, size: f.size, type: ext, content });
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(f);
  }, [onFileReady]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, [processFile]);

  const clearFile = () => {
    setFile(null); setPreview(''); setError('');
    if (inputRef.current) inputRef.current.value = '';
    onFileReady?.(null);
  };

  const FileIcon = file?.type === 'json' ? FileJson : FileText;

  return (
    <div className="space-y-3">
      {!file ? (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => !disabled && inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
            dragging
              ? 'border-blue-500 bg-blue-950/20'
              : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/40 hover:bg-zinc-900/70'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input ref={inputRef} type="file" accept=".json,.csv,.txt"
            className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
            disabled={disabled} />
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
            dragging ? 'bg-blue-500/20' : 'bg-zinc-800'
          }`}>
            <Upload size={20} className={dragging ? 'text-blue-400' : 'text-zinc-500'} strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-300">
              {dragging ? 'Drop to upload' : 'Drop file here or click to browse'}
            </p>
            <p className="text-xs text-zinc-600 mt-1">JSON · CSV · TXT — max {formatBytes(MAX_SIZE)}</p>
          </div>
        </div>
      ) : (
        <div className="border border-zinc-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800/60 border-b border-zinc-700">
            <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800/60 flex items-center justify-center">
              <FileIcon size={14} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{file.name}</p>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">{file.type.toUpperCase()} · {formatBytes(file.size)}</p>
            </div>
            <button onClick={clearFile} className="p-1 text-zinc-600 hover:text-red-400 transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="p-4">
            <p className="text-xs font-medium text-zinc-500 mb-2">Preview</p>
            <pre className="text-xs font-mono text-zinc-400 bg-zinc-950 rounded-lg p-3 overflow-x-auto max-h-32 whitespace-pre-wrap break-all leading-relaxed">
              {preview}
            </pre>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-950/40 border border-red-800/50">
          <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
