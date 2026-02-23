import express from 'express';
import cors from 'cors';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Global variables
let llama = null;
let model = null;
let context = null;

// Qwen 2.5 7B Instruct (GGUF Quantized)
const MODEL_NAME = "qwen2.5-7b-instruct-q4_k_m.gguf";
// Using the official Qwen GGUF repo
const MODEL_URL = "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf";
const MODEL_DIR = path.join(__dirname, 'models');
const MODEL_PATH = path.join(MODEL_DIR, MODEL_NAME);

// Helper to download model with progress
async function downloadModel() {
    if (!fs.existsSync(MODEL_DIR)) {
        fs.mkdirSync(MODEL_DIR, { recursive: true });
    }

    if (fs.existsSync(MODEL_PATH)) {
        const stats = fs.statSync(MODEL_PATH);
        if (stats.size > 1024 * 1024) {
            console.log('Model already exists locally.');
            return;
        }
        console.log('Model file found but looks incomplete. Re-downloading...');
    }

    console.log(`Downloading model from ${MODEL_URL}...`);
    console.log('This is a large file (~4.6GB). Please ensure you have a stable internet connection.');

    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`Failed to fetch model: ${response.statusText}`);
    if (!response.body) throw new Error('ReadableStream not supported in this environment');

    const fileStream = fs.createWriteStream(MODEL_PATH);
    const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
    let downloadedBytes = 0;

    const reader = response.body.getReader();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            downloadedBytes += value.length;
            fileStream.write(value);

            // Log progress every ~50MB or so
            if (totalBytes > 0) {
                 const currentMB = (downloadedBytes / 1024 / 1024).toFixed(0);
                 const totalMB = (totalBytes / 1024 / 1024).toFixed(0);
                 const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);

                 // Only log occasionally
                 if (downloadedBytes % (50 * 1024 * 1024) < value.length) {
                    process.stdout.write(`Downloading: ${progress}% (${currentMB}/${totalMB} MB) \r`);
                 }
            } else {
                 if (downloadedBytes % (50 * 1024 * 1024) < value.length) {
                    process.stdout.write(`Downloading: ${(downloadedBytes / 1024 / 1024).toFixed(0)} MB \r`);
                 }
            }
        }
        console.log('\nDownload complete.');
    } catch (err) {
        console.error('\nDownload failed:', err);
        fileStream.destroy();
        try {
            if (fs.existsSync(MODEL_PATH)) fs.unlinkSync(MODEL_PATH); // Delete partial file
        } catch (e) {
            console.error('Failed to cleanup partial file:', e);
        }
        throw err;
    } finally {
        if (!fileStream.destroyed) fileStream.end();
    }
}

async function initLlama() {
    try {
        await downloadModel();

        console.log('Initializing Llama context...');
        llama = await getLlama();

        console.log('Loading model (this might take a few seconds)...');
        model = await llama.loadModel({
            modelPath: MODEL_PATH,
             // Auto-detect GPU layers for acceleration
             gpuLayers: 'auto'
        });

        console.log('Creating context...');
        context = await model.createContext({
            // Context size: 8192 is reasonable for Qwen2.5
            contextSize: 8192
        });

        console.log('Qwen2.5-7B-Instruct loaded successfully!');
    } catch (err) {
        console.error('Failed to initialize Llama:', err);
    }
}

initLlama();

app.post('/api/chat', async (req, res) => {
    if (!context) {
        return res.status(503).json({ error: 'Model is loading or downloading. Please check server logs.' });
    }

    const { message, history } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    let session = null;

    try {
        // Format history for the session constructor
        // node-llama-cpp expects history as an array of { type: 'user'|'model'|'system', text: string, response?: string[] }
        let formattedHistory = [];
        if (history && Array.isArray(history)) {
             formattedHistory = history.map(msg => {
                 if (msg.sender === 'ユーザー') return { type: 'user', text: msg.message };
                 if (msg.sender === '葵日南') return { type: 'model', text: msg.message, response: [msg.message] };
                 return null;
             }).filter(Boolean);
        }

        // Create a new session for this request sequence
        session = new LlamaChatSession({
            contextSequence: context.getSequence(),
            systemPrompt: "You are Aoi (葵日南), a helpful and friendly AI assistant who speaks Japanese naturally.",
        });

        // Initialize history
        if (formattedHistory.length > 0) {
            session.setChatHistory(formattedHistory);
        }

        console.log(`Generating response for input length: ${message.length}`);

        const response = await session.prompt(message, {
            maxTokens: 512,
            temperature: 0.7,
            topK: 40,
            topP: 0.9,
        });

        console.log('Response generated successfully.');
        res.json({ response: response });

    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({ error: 'Failed to generate response: ' + error.message });
    } finally {
        // Dispose the session to free up the context sequence
        if (session) {
            session.dispose();
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
