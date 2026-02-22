import { useState, useEffect, useRef } from 'react';
import { CreateMLCEngine } from "@mlc-ai/web-llm";

export function useWebLLM() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const engine = useRef(null);

  useEffect(() => {
    async function init() {
        try {
            setIsLoading(true);
            setProgress('Initializing AI Engine (downloading model)...');
            // Using a tiny model suitable for browser
            const selectedModel = "Llama-3.2-1B-Instruct-q4f32_1";

            engine.current = await CreateMLCEngine(
                selectedModel,
                {
                  initProgressCallback: (report) => setProgress(report.text),
                  logLevel: "INFO"
                }
            );

            setProgress('');
            setIsLoading(false);
        } catch (error) {
            console.error("Failed to initialize WebLLM", error);
            setProgress('Error initializing AI: ' + error.message);
            setIsLoading(false);
        }
    }

    init();
  }, []);

  async function generateResponse(text, chatHistory = []) {
    if (!engine.current) {
        return "AI is still initializing. Please wait a moment.";
    }

    // We set loading state to indicate generation is happening
    setIsLoading(true);

    try {
      // Format history
      const messages = [
        { role: "system", content: "You are a helpful, friendly AI assistant named Aoi (葵日南). You speak Japanese naturally." },
      ];

      // Add history
      // Note: We filter out any temporary messages or loading states if they exist in history
      chatHistory.forEach(msg => {
        if (msg.isLoading) return; // Skip loading placeholders

        if (msg.sender === 'ユーザー') {
            messages.push({ role: "user", content: msg.message });
        } else {
            messages.push({ role: "assistant", content: msg.message });
        }
      });

      // Add current message
      messages.push({ role: "user", content: text });

      const reply = await engine.current.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 512,
      });

      setIsLoading(false);
      return reply.choices[0].message.content;
    } catch (err) {
      console.error("LLM Generation Error:", err);
      setIsLoading(false);
      return "Sorry, I encountered an error generating the response.";
    }
  }

  return { generateResponse, isLoading, progress };
}
