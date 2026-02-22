import AoiProfileImage from '../assets/aoi.jpg';
import UserProfileImage from '../assets/user.jpg';

export function ChatMessage({ message, sender, isLoading }) {
  const isAoi = sender === "葵日南";

  return (
    <div className={`flex w-full mb-6 ${isAoi ? "justify-start" : "justify-end"}`}>

      {/* Aoi Avatar */}
      {isAoi && (
        <div className="flex-shrink-0 mr-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-old-rose-400/50 shadow-lg relative bg-black/40">
            <img 
              src={AoiProfileImage}
              alt="Aoi" 
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.classList.add('flex', 'items-center', 'justify-center'); e.target.parentNode.innerHTML = '🌸' }} 
            />
          </div>
        </div>
      )}

      {/* Message Bubble */}
      <div className={`
        max-w-[75%] px-5 py-3 text-sm md:text-base shadow-lg backdrop-blur-sm
        ${isAoi
          ? "bg-white/10 border border-white/10 text-white rounded-2xl rounded-tl-none"
          : "bg-gradient-to-br from-old-rose-600 to-night-bordeaux-600 text-white border border-white/10 rounded-2xl rounded-tr-none"
        }
    `}>
        <div className="text-xs opacity-50 mb-1 font-sans font-bold tracking-wider">
          {sender}
        </div>
        <div className="leading-relaxed">
          {isLoading ? (
            <span className="animate-pulse">考え中... 🖊️</span>
          ) : message}
        </div>
      </div>

      {/* User Avatar */}
      {!isAoi && (
        <div className="flex-shrink-0 ml-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-night-bordeaux-400/50 shadow-lg bg-black/40">
            <img 
              src={UserProfileImage}
              alt="User" 
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.classList.add('flex', 'items-center', 'justify-center'); e.target.parentNode.innerHTML = '👤' }} 
            />
          </div>
        </div>
      )}
    </div>
  )
}