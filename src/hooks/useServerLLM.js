import { useState } from 'react';

export function useServerLLM() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  async function generateResponse(text, chatHistory = []) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          history: chatHistory.map(msg => ({
            sender: msg.sender,
            message: msg.message,
            isLoading: msg.isLoading
          }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response from server');
      }

      const data = await response.json();
      setIsLoading(false);
      return data.response;
    } catch (err) {
      console.error("Server LLM Error:", err);
      setError(err.message);
      setIsLoading(false);
      return "Sorry, I encountered an error connecting to the local AI server. Please make sure `npm run server` is running.";
    }
  }

  return { generateResponse, isLoading, error };
}
