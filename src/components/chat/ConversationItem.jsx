import { useState, useRef, useEffect } from 'react';
import { X, Edit2, MessageSquare } from 'lucide-react';

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

  return (
    <div
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors min-w-0 overflow-hidden ${
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
          className="flex-1 min-w-0 w-full px-2 py-0.5 text-[11px] bg-background text-foreground border border-border rounded-lg focus:outline-none focus:border-accent"
        />
      ) : (
        <>
          <MessageSquare className="w-3 h-3 shrink-0 opacity-50" />
          <button
            onClick={onSelect}
            className="flex-1 min-w-0 text-left"
          >
            <span className="text-[11px] leading-tight truncate block">{conversation.title}</span>
          </button>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="p-1 rounded hover:bg-black/20"
              title="Rename conversation"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 rounded hover:bg-black/20"
              title="Delete conversation"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}