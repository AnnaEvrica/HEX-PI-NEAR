import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Edit2, Check } from 'lucide-react';

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
      className={`group flex items-center gap-1 px-2 py-2 rounded-sm transition-colors ${
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
          className="flex-1 px-2 py-1 text-xs bg-black/20 border border-foreground/30 rounded text-foreground focus:outline-none focus:border-foreground"
        />
      ) : (
        <>
          <button
            onClick={onSelect}
            className="flex-1 text-left text-sm truncate flex items-center gap-2"
          >
            <MessageCircle className="w-3 h-3 shrink-0" />
            {conversation.title}
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