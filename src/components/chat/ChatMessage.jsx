import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, Volume2, VolumeX } from 'lucide-react';

// Memoized so typing in the input doesn't re-render every message.
// ReactMarkdown is expensive; without this, each keystroke re-renders
// the entire conversation list.
const ChatMessage = React.memo(({ message, copiedId, speakingId, onCopy, onSpeak }) => {
  return (
    <div
      className={`flex group ${
        message.role === 'user' ? 'justify-end' : 'justify-start'
      }`}
    >
      <div className={`max-w-[85%] md:max-w-2xl ${message.role === 'user' ? 'mr-2' : 'ml-2'}`}>
        {message.file_urls && message.file_urls.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {message.file_urls.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt="uploaded"
                className="max-w-xs rounded-lg border border-border"
              />
            ))}
          </div>
        )}
        <div className="bg-muted/60 text-foreground border border-foreground/20 px-3 py-2 text-[13px] md:text-sm">
          <ReactMarkdown
            className="prose prose-sm dark:prose-invert max-w-none text-foreground [&>*]:my-0 [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>li]:my-0"
            components={{
              p: ({ node, ...props }) => <p {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc list-inside" {...props} />,
              ol: ({ node, ...props }) => <ol className="list-decimal list-inside" {...props} />,
              li: ({ node, ...props }) => <li {...props} />,
              a: ({ node, ...props }) => (
                <a
                  {...props}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:opacity-80 break-all text-accent"
                />
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        <div className={`flex gap-0.5 mt-1 px-1 opacity-60 hover:opacity-100 transition-opacity ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <button
            onClick={() => onCopy(message)}
            className="p-1 rounded-md hover:bg-muted text-secondary hover:text-foreground transition-colors flex items-center justify-center"
            style={{ minWidth: '24px', minHeight: '24px' }}
            title="Copy message"
          >
            {copiedId === message.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {message.role === 'assistant' && (
            <button
              onClick={() => onSpeak(message)}
              className={`p-1 rounded-md hover:bg-muted transition-colors flex items-center justify-center ${speakingId === message.id ? 'text-accent' : 'text-secondary hover:text-foreground'}`}
              style={{ minWidth: '24px', minHeight: '24px' }}
              title={speakingId === message.id ? 'Stop speaking' : 'Read aloud'}
            >
              {speakingId === message.id ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;