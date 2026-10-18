import ConversationItem from '@/components/chat/ConversationItem';

// Flat conversation list — no day grouping, just like ChatGPT's Recents.
export default function ConversationDayList({ conversations, currentConversationId, onSelect, onRename, onDelete }) {
  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
  );

  return (
    <div className="space-y-0.5">
      {sorted.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isSelected={currentConversationId === conv.id}
          onSelect={() => onSelect(conv.id)}
          onRename={(newTitle) => onRename(conv.id, newTitle)}
          onDelete={() => onDelete(conv.id)}
        />
      ))}
    </div>
  );
}