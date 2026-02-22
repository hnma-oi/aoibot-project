import { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';

export function ChatMessages({ chatMessages }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  return (
    <div className="flex-grow overflow-y-auto no-scrollbar p-4 md:p-6 space-y-2">
      {chatMessages.map((msg) => (
        <ChatMessage
          key={msg.uuid}
          sender={msg.sender}
          message={msg.message}
          isLoading={msg.isLoading}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
