import { useState } from 'react';
import { Chatbot } from 'supersimpledev'; 

export function ChatInput({ chatMessages, setChatMessages }) {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  function saveInputText(event) {
    setInputText(event.target.value);
  }

  async function sendMessage() {
    if (isLoading || inputText.trim() === "") return;

    setIsLoading(true);
    const currentText = inputText;
    setInputText(''); // Optimistic clear

    // 1. Add User Message
    const newChatMessages = [
      ...chatMessages,
      {
        sender: 'ユーザー',
        message: currentText,
        uuid: crypto.randomUUID()
      }
    ];

    // 2. Add Loading Message (Temporary)
    setChatMessages([
      ...newChatMessages,
      {
        sender: '葵日南',
        message: "thinking...",
        uuid: crypto.randomUUID(),
        isLoading: true
      }
    ]);

    // 3. Get Response
    // Note: Ensure Chatbot is correctly imported from your npm package
    const aoiResponse = await Chatbot.getResponseAsync(currentText);

    // 4. Update with Real Message
    setChatMessages([
      ...newChatMessages,
      {
        sender: '葵日南',
        message: aoiResponse,
        uuid: crypto.randomUUID()
      }
    ]);
    setIsLoading(false);
  }

  function handleKey(event) {
    if (event.key === 'Enter') sendMessage();
    if (event.key === 'Escape') setInputText('');
  }

  return (
    <div className="p-4 bg-white/5 backdrop-blur-md border-t border-white/10 flex items-center gap-3">
      <input
        className="flex-grow bg-black/20 text-white placeholder-old-rose-200/50 rounded-full px-5 py-3 outline-none focus:ring-2 focus:ring-old-rose-400/50 transition-all shadow-inner border border-white/5"
        placeholder="葵にメッセージを入力..."
        onChange={saveInputText}
        value={inputText}
        onKeyDown={handleKey}
        disabled={isLoading}
      />
      <button
        onClick={sendMessage}
        disabled={isLoading}
        className={`
            px-6 py-3 rounded-full font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95
            ${isLoading
            ? "bg-gray-600 text-gray-400 cursor-not-allowed"
            : "bg-gradient-to-r from-old-rose-500 to-night-bordeaux-500 text-white hover:shadow-old-rose-500/40"
          }
        `}
      >
        {isLoading ? '...' : '送信'}
      </button>
    </div>
  );
}