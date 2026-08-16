import { useState, useRef, useEffect } from 'react';
import { X, Edit2 } from 'lucide-react';

export default function ConversationItem({ conversation, isSelected, onSelect, onRename, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Keep the edit field in sync with the persisted title when not editing,
  // so an external title change doesn't leave a stale value in the input.
  useEffect(() => {
    if (!isEditing) setEditTitle(conversation.title);
  }, [conversation.title, isEditing]);

  const handleSaveRename = () => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      onRename(editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setEditTitle(conversation.title);
      setIsEditing(false);
    }
  };

  const stamp = new Date(conversation.updated_at || conversation.created_at || Date.now())
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <div
      className={`group flex items-center gap-1 px-2 py-1.5 rounded-xl transition-colors ${
        isSelected
          ? 'bg-primary text-primary-foreground'
          : 'text-secondary hover:bg-muted'
      }`}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSaveRename}
          onKeyDown={handleKeyDown}
          className="flex-1 px-2 py-1 text-xs bg-background text-foreground border border-border rounded-xl focus:outline-none focus:border-accent"
        />
      ) : (
        <>
          <button
            onClick={onSelect}
            className="flex-1 min-w-0 text-left flex flex-col"
          >
            <span className="text-[11px] leading-tight truncate">{conversation.title}</span>
            <span className={`text-[9px] tabular-nums ${isSelected ? 'text-primary-foreground/60' : 'text-secondary/60'}`}>{stamp}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/20 transition-opacity"
            title="Rename conversation"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/20 transition-opacity"
            title="Delete conversation"
          >
            <X className="w-3 h-3" />
          </button>
        </>
      )}
    </div>
  );
}