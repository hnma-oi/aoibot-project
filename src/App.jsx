import { useState, } from 'react';
import { ChatInput } from './components/ChatInput';
import { ChatMessages } from './components/ChatMessages';
import './App.css'; // or './index.css'

function App() {
  const [chatMessages, setChatMessages] = useState([
    { sender: "ユーザー", message: "葵日南って誰？", uuid: crypto.randomUUID() },
    { sender: "葵日南", message: "こんにちは！私は葵日南チャットボットです。ご質問やお話したいことがあれば、何でも聞いてくださいね！😊", uuid: crypto.randomUUID() },
    { sender: "ユーザー", message: "葵の趣味は何ですか？", uuid: crypto.randomUUID() },
    { sender: "葵日南", message: "私の趣味はゲーム！特にアタファミが大好きです。あなたはどんなゲームが好きですか？🎮", uuid: crypto.randomUUID() }
  ]);

  return (
    // Note: We added h-screen and w-screen to the outer container to match the HTML body styles
    <div className="bg-gradient-to-br from-old-rose-950 via-night-bordeaux-950 to-rich-mahogany-950 h-screen w-screen overflow-hidden font-serif text-old-rose-50 flex items-center justify-center p-0 md:p-6">
      
      {/* Background Blobs */}
      <div className="absolute top-10 left-10 w-64 h-64 bg-old-rose-500/20 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-night-bordeaux-600/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>

      {/* Main Glass Card */}
      <div className="
        relative z-10 w-full max-w-2xl h-full md:h-[90vh] 
        bg-black/20 backdrop-blur-xl border border-white/10 
        shadow-2xl md:rounded-3xl flex flex-col overflow-hidden
      ">

        {/* Header */}
        <header className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
          </div>
          <h1 className="text-lg font-serif font-bold text-old-rose-100 tracking-widest drop-shadow-sm">
            葵日南 <span className="text-xs opacity-50 ml-1">AI CHAT</span>
          </h1>
          <div className="w-10"></div>
        </header>

        {/* Messages */}
        <ChatMessages chatMessages={chatMessages} />

        {/* Input */}
        <ChatInput
          chatMessages={chatMessages}
          setChatMessages={setChatMessages}
        />
      </div>
    </div>
  );
}

export default App;