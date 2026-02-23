import { useState, useEffect, useRef } from 'react';
import { CreateMLCEngine } from "@mlc-ai/web-llm";

export function useWebLLM() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const engine = useRef(null);

  useEffect(() => {
    let originalRequestAdapter = null;

    async function init() {
        try {
            setIsLoading(true);
            setProgress('Checking GPU availability...');

            if (!navigator.gpu) {
                throw new Error("WebGPU is not supported in this browser. Please use a compatible browser like Chrome, Edge, or Brave.");
            }

            // Store original and monkey-patch with fallback strategy
            originalRequestAdapter = navigator.gpu.requestAdapter;
            navigator.gpu.requestAdapter = async function(options) {
                console.log("Requesting GPU adapter with fallback strategy...", options);

                // 1. Try High Performance (Dedicated GPU)
                try {
                    const adapter = await originalRequestAdapter.call(navigator.gpu, { ...options, powerPreference: 'high-performance' });
                    if (adapter) {
                        console.log("Successfully acquired high-performance GPU adapter", adapter);
                        return adapter;
                    }
                } catch (e) {
                    console.warn("High-performance GPU request failed:", e);
                }

                // 2. Try Low Power (Integrated GPU)
                console.log("Falling back to low-power GPU adapter request...");
                try {
                    const adapter = await originalRequestAdapter.call(navigator.gpu, { ...options, powerPreference: 'low-power' });
                    if (adapter) {
                        console.log("Successfully acquired low-power GPU adapter", adapter);
                        return adapter;
                    }
                } catch (e) {
                    console.warn("Low-power GPU request failed:", e);
                }

                // 3. Try Default (No options)
                console.log("Falling back to default GPU adapter request...");
                try {
                    const adapter = await originalRequestAdapter.call(navigator.gpu);
                    if (adapter) {
                        console.log("Successfully acquired default GPU adapter", adapter);
                        return adapter;
                    }
                } catch (e) {
                     console.warn("Default GPU request failed:", e);
                }

                return null;
            };

            setProgress('Initializing AI Engine (downloading model)...');
            // Using a tiny model suitable for browser
            // q4f32_1 is generally safer but still needs decent GPU
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
            // More helpful error message for "Unable to find a compatible GPU"
            let msg = error.message;
            if (msg.includes("Unable to find a compatible GPU")) {
                msg = "Unable to find a compatible GPU. Please ensure your browser supports WebGPU and check graphics drivers.";
            }
            setProgress('Error initializing AI: ' + msg);
            setIsLoading(false);
        } finally {
            // Restore original function
            if (navigator.gpu && originalRequestAdapter) {
                navigator.gpu.requestAdapter = originalRequestAdapter;
            }
        }
    }

    init();
  }, []);

  async function generateResponse(text, chatHistory = []) {
    if (!engine.current) {
        return "AI is still initializing or failed to load. Please check the status message.";
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
