import ConversationItem from '@/components/chat/ConversationItem';

// Sidebar history as a rundown of days — conversations grouped under Today /
// Yesterday / the actual date, each one stamped with the time it happened.
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function ConversationDayList({ conversations, currentConversationId, onSelect, onRename, onDelete }) {
  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
  );

  const groups = [];
  sorted.forEach((conv) => {
    const label = dayLabel(conv.updated_at || conv.created_at || new Date().toISOString());
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(conv);
    else groups.push({ label, items: [conv] });
  });

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1.5">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary/70">{group.label}</p>
          {group.items.map((conv) => (
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
      ))}
    </div>
  );
}