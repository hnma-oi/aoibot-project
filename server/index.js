import express from 'express';
import cors from 'cors';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

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

// Split file names
const SPLIT_FILE_1 = "qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf";
const SPLIT_FILE_2 = "qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf";
const SPLIT_PATH_1 = path.join(MODEL_DIR, SPLIT_FILE_1);
const SPLIT_PATH_2 = path.join(MODEL_DIR, SPLIT_FILE_2);

// Helper to check and merge split files
async function checkAndMergeSplitFiles() {
    if (fs.existsSync(MODEL_PATH)) {
        return; // Already exists, no need to merge
    }

    if (fs.existsSync(SPLIT_PATH_1) && fs.existsSync(SPLIT_PATH_2)) {
        console.log('Found split model files. Merging them into single GGUF...');
        console.log(`Merging ${SPLIT_FILE_1} + ${SPLIT_FILE_2} -> ${MODEL_NAME}`);

        try {
            // Check if we can use llama-gguf-split tool via node-llama-cpp (not directly exposed usually)
            // But GGUF split files are often just concatenated binary blobs if simple split.
            // However, the official tool is safer.
            // Let's try simple concatenation first as a fallback if the library doesn't auto-handle it.
            // Actually, recent llama.cpp supports loading split files directly by pointing to the first one.
            // Let's try that first in initLlama.
            // But the user specifically asked to merge them. So let's merge them for simplicity.

            const writeStream = fs.createWriteStream(MODEL_PATH);

            // Append file 1
            console.log(`Appending ${SPLIT_FILE_1}...`);
            const readStream1 = fs.createReadStream(SPLIT_PATH_1);
            await pipeline(readStream1, writeStream, { end: false });

            // Append file 2
            console.log(`Appending ${SPLIT_FILE_2}...`);
            const readStream2 = fs.createReadStream(SPLIT_PATH_2);
            await pipeline(readStream2, writeStream); // This will close writeStream

            console.log('Merge complete. Created ' + MODEL_NAME);

            // Verify size roughly
            const size1 = fs.statSync(SPLIT_PATH_1).size;
            const size2 = fs.statSync(SPLIT_PATH_2).size;
            const sizeMerged = fs.statSync(MODEL_PATH).size;

            if (sizeMerged === size1 + size2) {
                console.log('Size verification passed.');
            } else {
                console.warn(`Size mismatch after merge! Expected ${size1 + size2}, got ${sizeMerged}`);
            }

        } catch (err) {
            console.error('Failed to merge split files:', err);
            // Clean up partial file
            if (fs.existsSync(MODEL_PATH)) fs.unlinkSync(MODEL_PATH);
            throw err;
        }
    }
}

// Helper to download model with progress
async function downloadModel() {
    if (!fs.existsSync(MODEL_DIR)) {
        fs.mkdirSync(MODEL_DIR, { recursive: true });
    }

    // Check for split files first
    await checkAndMergeSplitFiles();

    console.log(`Checking model status at ${MODEL_PATH}...`);

    // Check if we need to download
    let shouldDownload = true;
    let expectedSize = 0;

    try {
        // Head request to get size
        const headResponse = await fetch(MODEL_URL, { method: 'HEAD' });
        if (headResponse.ok) {
            const contentLength = headResponse.headers.get('content-length');
            if (contentLength) {
                expectedSize = parseInt(contentLength, 10);
                console.log(`Expected model size: ${(expectedSize / 1024 / 1024).toFixed(2)} MB`);
            }
        } else {
            console.warn(`Could not get expected size from HEAD request: ${headResponse.status} ${headResponse.statusText}`);
        }
    } catch (e) {
        console.warn('Failed to get model size via HEAD request:', e.message);
    }

    if (fs.existsSync(MODEL_PATH)) {
        const stats = fs.statSync(MODEL_PATH);
        console.log(`Local file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        if (expectedSize > 0 && stats.size === expectedSize) {
            console.log('Model already exists and size matches.');
            shouldDownload = false;
        } else if (stats.size > 100 * 1024 * 1024 && expectedSize === 0) {
            // If we couldn't get size but local file is substantial (>100MB), assume it's good for now
            console.log('Model exists and looks substantial. Skipping re-download (size verification skipped).');
            shouldDownload = false;
        } else {
            console.log('Model exists but size mismatch or incomplete. Re-downloading...');
        }
    }

    if (!shouldDownload) return;

    console.log(`Downloading model from ${MODEL_URL}...`);
    console.log('This is a large file (~4.6GB). Please ensure you have a stable internet connection.');

    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`Failed to fetch model: ${response.statusText}`);
    if (!response.body) throw new Error('ReadableStream not supported in this environment');

    const totalBytes = parseInt(response.headers.get('content-length') || expectedSize.toString(), 10);
    let downloadedBytes = 0;

    const fileStream = fs.createWriteStream(MODEL_PATH);

    try {
        // Use Readable.fromWeb to convert web stream to node stream for iteration
        // @ts-ignore
        const nodeReadable = Readable.fromWeb(response.body);

        for await (const chunk of nodeReadable) {
            downloadedBytes += chunk.length;

            // Check for backpressure
            const canWrite = fileStream.write(chunk);
            if (!canWrite) {
                await new Promise(resolve => fileStream.once('drain', resolve));
            }

             // Log progress
             if (totalBytes > 0) {
                 const currentMB = (downloadedBytes / 1024 / 1024).toFixed(0);
                 const totalMB = (totalBytes / 1024 / 1024).toFixed(0);
                 const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);

                 // Update every ~20MB
                 if (downloadedBytes % (20 * 1024 * 1024) < chunk.length) {
                    process.stdout.write(`Downloading: ${progress}% (${currentMB}/${totalMB} MB) \r`);
                 }
            } else {
                 // Unknown size
                 if (downloadedBytes % (20 * 1024 * 1024) < chunk.length) {
                    process.stdout.write(`Downloading: ${(downloadedBytes / 1024 / 1024).toFixed(0)} MB \r`);
                 }
            }
        }

        console.log('\nDownload complete.');
    } catch (err) {
        console.error('\nDownload failed:', err);
        fileStream.destroy(); // Close stream
        try {
            if (fs.existsSync(MODEL_PATH)) fs.unlinkSync(MODEL_PATH); // Delete partial file
        } catch (e) { console.error('Cleanup failed:', e); }
        throw err;
    } finally {
        fileStream.end();
        // Wait for finish
        await new Promise((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });
    }
}

async function initLlama() {
    try {
        await downloadModel();

        console.log('Initializing Llama (this loads the llama.cpp library)...');
        // This might download binaries if missing
        llama = await getLlama();

        console.log('Library initialized.');

        // Determine final model path (merged or split)
        // If merge succeeded, we use MODEL_PATH.
        // If merge wasn't needed because we have split files but no merged file (and merge failed?), we might try loading split directly.
        // But for now, assume merge or download succeeded.

        let targetPath = MODEL_PATH;

        // Fallback: If merged file missing but split file 1 exists, try loading that directly
        if (!fs.existsSync(MODEL_PATH) && fs.existsSync(SPLIT_PATH_1)) {
            console.log('Merged file missing, attempting to load from first split file...');
            targetPath = SPLIT_PATH_1;
        }

        console.log(`Loading model from ${targetPath}...`);

        if (!fs.existsSync(targetPath)) {
            throw new Error(`Model file missing at ${targetPath}`);
        }

        model = await llama.loadModel({
            modelPath: targetPath,
            gpuLayers: 'auto'
        });

        console.log('Model loaded.');
        console.log('Creating context...');

        context = await model.createContext({
            contextSize: 8192
        });

        console.log('Qwen2.5-7B-Instruct context created successfully!');
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
        // Format history
        let formattedHistory = [];
        if (history && Array.isArray(history)) {
             formattedHistory = history.map(msg => {
                 if (msg.sender === 'ユーザー') return { type: 'user', text: msg.message };
                 if (msg.sender === '葵日南') return { type: 'model', text: msg.message, response: [msg.message] };
                 return null;
             }).filter(Boolean);
        }

        // Create session
        session = new LlamaChatSession({
            contextSequence: context.getSequence(),
            systemPrompt: "You are Aoi (葵日南), a helpful and friendly AI assistant who speaks Japanese naturally.",
        });

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
        if (session) {
            session.dispose();
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
