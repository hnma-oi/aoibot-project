import express from 'express';
import cors from 'cors';
import { pipeline } from '@xenova/transformers';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Global variable to hold the model pipeline
let generator = null;

// Initialize the model
async function initModel() {
  console.log('Loading TinyLlama-1.1B-Chat-v1.0 (quantized)... This runs on your laptop!');
  try {
    // Using a pipeline abstraction from Transformers.js
    // This runs on CPU by default but works reliably in Node environments.
    generator = await pipeline('text-generation', 'Xenova/TinyLlama-1.1B-Chat-v1.0');
    console.log('Model loaded successfully!');
  } catch (err) {
    console.error('Failed to load model:', err);
  }
}

// Start loading
initModel();

app.post('/api/chat', async (req, res) => {
  if (!generator) {
    return res.status(503).json({ error: 'Model is still loading. Please try again in a moment.' });
  }

  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Construct the prompt format for TinyLlama Chat
    // <|system|>
    // {system_message}</s>
    // <|user|>
    // {user_message}</s>
    // <|assistant|>

    // TinyLlama chat format requires specific tokens
    let prompt = "<|system|>\nYou are Aoi (葵日南), a helpful and friendly AI assistant who speaks Japanese naturally.</s>\n";

    if (history && Array.isArray(history)) {
        history.forEach(msg => {
            // Basic role mapping
            if (msg.sender === 'ユーザー') {
                prompt += `<|user|>\n${msg.message}</s>\n`;
            } else if (msg.sender === '葵日南' && !msg.isLoading) {
                prompt += `<|assistant|>\n${msg.message}</s>\n`;
            }
        });
    }

    // Add current user message
    prompt += `<|user|>\n${message}</s>\n<|assistant|>\n`;

    console.log('Generating response for:', message.substring(0, 50) + '...');

    const outputs = await generator(prompt, {
      max_new_tokens: 128,
      temperature: 0.7,
      do_sample: true,
      top_k: 50,
      return_full_text: false // TinyLlama pipeline option to return only new text? Not always reliable, so we handle manually if needed.
    });

    // Extract the generated text
    // The pipeline usually returns an array of objects: [{ generated_text: "..." }]
    let generatedText = outputs[0].generated_text;

    // Clean up any trailing tags if present
    generatedText = generatedText.replace('</s>', '').trim();

    console.log('Response:', generatedText.substring(0, 50) + '...');
    res.json({ response: generatedText });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
