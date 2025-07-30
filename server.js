// server.js

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config(); // For loading environment variables like YOUTUBE_STREAM_KEY

const axios = require('axios'); // Correctly import axios

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 10000; // Use PORT environment variable or default to 10000

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// --- Server State Variables ---
let frameBuffer = []; // Stores lines of text for the terminal display
let currentFrame = 0;
let currentCycle = 0;
let isStreamingAI = false;
let isStreamingYouTube = false;
let youtubeStreamProcess = null; // To hold the FFmpeg process for YouTube

// --- Configuration (defaults or loaded from client/env) ---
let serverConfig = {
    duration: 5, // minutes
    cycles: 15,
    typingSpeed: 0.06,
    terminalWidth: 70, // Characters wide
    fontSize: 16, // Pixel font size (for server-side calculations if needed)
    showThinking: true,
    enableStreaming: true,
    debugMode: false
};

// --- LLM7.io Configuration (Hypothetical) ---
const LLM7_API_URL = 'https://api.llm7.io/generate'; // Replace with actual LLM7.io API URL
// const LLM7_API_KEY = process.env.LLM7_API_KEY; // Uncomment if LLM7.io requires an API key

// --- Utility Functions ---

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

function appendToFrameBuffer(text) {
    const lines = text.split('\n');
    lines.forEach(line => {
        for (let i = 0; i < line.length; i += serverConfig.terminalWidth) {
            frameBuffer.push(line.substring(i, i + serverConfig.terminalWidth));
        }
    });

    if (frameBuffer.length > 100) {
        frameBuffer = frameBuffer.slice(-100);
    }
}

// --- LLM7.io Integration Function ---
async function generateAIContent(prompt, llmConfig = {}) {
    try {
        console.log(`Sending prompt to LLM7.io: ${prompt.substring(0, 50)}...`);
        const response = await axios.post(LLM7_API_URL, {
            prompt: prompt,
            max_tokens: llmConfig.max_tokens || 250,
            temperature: llmConfig.temperature || 0.7,
            model: llmConfig.model || 'llm7-default',
        }, {
            headers: {
                // 'Authorization': `Bearer ${LLM7_API_KEY}`, // Uncomment if LLM7.io requires an API key
                'Content-Type': 'application/json'
            }
        });

        const generatedText = response.data.generated_text;
        console.log(`Received AI content: ${generatedText.substring(0, 50)}...`);
        return generatedText;

    } catch (error) {
        console.error('Error calling LLM7.io API:', error.message);
        if (error.response) {
            console.error('LLM7.io Response Status:', error.response.status);
            console.error('LLM7.io Response Data:', error.response.data);
        }
        return `[ERROR: LLM7.io connection failed or API error. Message: ${error.message.substring(0, 100)}...]`;
    }
}

// --- AI Stream Generation Loop ---
let aiStreamInterval = null;
let currentPrompt = "Initiate an advanced AI consciousness simulation, focusing on the fundamental principles of sentience and self-awareness in the context of digital existence. Begin with a greeting to the observer.";
let responseBuffer = [];
let typingIndex = 0;
let typingSpeedDelay = 100;

async function startAIStream() {
    if (isStreamingAI) return;

    isStreamingAI = true;
    currentFrame = 0;
    currentCycle = 0;
    frameBuffer = ["Initializing AI consciousness simulation...", ""];
    broadcast({ type: 'terminalContent', terminalContent: frameBuffer });
    broadcast({ type: 'status', message: 'Generating...' });
    broadcast({ type: 'streamStatus', message: 'Active' });

    typingSpeedDelay = serverConfig.typingSpeed * 1000;

    const generateAndType = async () => {
        if (!isStreamingAI) return;

        if (typingIndex >= responseBuffer.join('\n').length) {
            currentCycle++;
            if (currentCycle > serverConfig.cycles && serverConfig.cycles > 0) {
                appendToFrameBuffer("\n[SIMULATION COMPLETE. Shutting down neural pathways...]\n");
                broadcast({ type: 'terminalContent', terminalContent: frameBuffer });
                stopAIStream();
                return;
            }

            appendToFrameBuffer(`\n[Cycle ${currentCycle}/${serverConfig.cycles}] Requesting new thoughts...`);
            if (serverConfig.showThinking) {
                appendToFrameBuffer("[THINKING...]");
            }
            broadcast({ type: 'terminalContent', terminalContent: frameBuffer });
            broadcast({ type: 'cycleUpdate', cycleCount: currentCycle });

            const newContent = await generateAIContent(currentPrompt, {
                max_tokens: 300,
                temperature: 0.8
            });
            responseBuffer = newContent.split('\n');
            typingIndex = 0;
            currentPrompt = `Continue the previous AI reflection, building on "${newContent.substring(0, Math.min(newContent.length, 100))}..."`;
            appendToFrameBuffer("");
        }

        const fullContent = responseBuffer.join('\n');
        if (typingIndex < fullContent.length) {
            const char = fullContent[typingIndex];
            if (frameBuffer.length === 0 || frameBuffer[frameBuffer.length - 1].length >= serverConfig.terminalWidth) {
                frameBuffer.push(char);
            } else {
                frameBuffer[frameBuffer.length - 1] += char;
            }
            currentFrame++;
            broadcast({ type: 'terminalContent', terminalContent: frameBuffer });
            broadcast({ type: 'frameUpdate', frameCount: currentFrame });
            typingIndex++;
        }

        aiStreamInterval = setTimeout(generateAndType, typingSpeedDelay);
    };

    generateAndType();

    if (serverConfig.duration > 0) {
        setTimeout(() => {
            if (isStreamingAI) {
                appendToFrameBuffer(`\n[SIMULATION TIME LIMIT (${serverConfig.duration} mins) REACHED. Shutting down...]\n`);
                broadcast({ type: 'terminalContent', terminalContent: frameBuffer });
                stopAIStream();
            }
        }, serverConfig.duration * 60 * 1000);
    }
}

function stopAIStream() {
    console.log('Stopping AI stream...');
    isStreamingAI = false;
    if (aiStreamInterval) {
        clearTimeout(aiStreamInterval);
        aiStreamInterval = null;
    }
    broadcast({ type: 'status', message: 'Stopped' });
    broadcast({ type: 'streamStatus', message: 'Off' });
    typingIndex = 0;
    responseBuffer = [];
}

// --- API Endpoints ---

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.get('/api/test-ffmpeg', (req, res) => {
    console.log('Received request for FFmpeg test.');
    const ffmpegPath = 'ffmpeg';
    const args = ['-version'];

    const ffmpeg = spawn(ffmpegPath, args);
    let output = '';
    let errorOutput = '';

    ffmpeg.stdout.on('data', data => {
        output += data.toString();
    });

    ffmpeg.stderr.on('data', data => {
        errorOutput += data.toString();
    });

    ffmpeg.on('close', code => {
        if (code === 0) {
            console.log('FFmpeg test successful.');
            res.status(200).send(`FFmpeg test successful: ${output.split('\n')[0]}`);
        } else {
            console.error(`FFmpeg test failed with code ${code}: ${errorOutput}`);
            res.status(500).send(`FFmpeg test failed: ${errorOutput.split('\n')[0]}`);
        }
    });

    ffmpeg.on('error', err => {
        console.error('FFmpeg process error:', err);
        res.status(500).send(`Failed to run FFmpeg: ${err.message}. Is FFmpeg installed and in PATH?`);
    });
});

// --- WebSocket Handling ---
wss.on('connection', ws => {
    console.log('WebSocket client connected');
    broadcast({ type: 'log', message: 'Client connected.' });

    ws.send(JSON.stringify({ type: 'status', message: isStreamingAI ? 'Active' : 'Ready' }));
    ws.send(JSON.stringify({ type: 'streamStatus', message: isStreamingAI ? 'Live' : 'Off' }));
    ws.send(JSON.stringify({ type: 'terminalContent', terminalContent: frameBuffer }));
    ws.send(JSON.stringify({ type: 'frameCount', frameCount: currentFrame }));
    ws.send(JSON.stringify({ type: 'cycleCount', cycleCount: currentCycle }));
    ws.send(JSON.stringify({ type: 'configUpdate', ...serverConfig }));

    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', async message => {
        ws.isAlive = true;

        try {
            const data = JSON.parse(message);
            console.log('Received from client:', data.type);

            if (data.type === 'ping') {
                return;
            } else if (data.type === 'startStream') {
                if (!isStreamingAI) {
                    startAIStream();
                }
            } else if (data.type === 'stopStream') {
                if (isStreamingAI) {
                    stopAIStream();
                }
            } else if (data.type === 'startYouTubeStream') {
                if (serverConfig.enableStreaming) {
                    startYouTubeStream();
                } else {
                    broadcast({ type: 'log', message: 'YouTube streaming disabled in config.' });
                }
            } else if (data.type === 'configUpdate') {
                serverConfig = {
                    ...serverConfig,
                    duration: data.duration !== undefined ? data.duration : serverConfig.duration,
                    cycles: data.cycles !== undefined ? data.cycles : serverConfig.cycles,
                    typingSpeed: data.typingSpeed !== undefined ? data.typingSpeed : serverConfig.typingSpeed,
                    terminalWidth: data.terminalWidth !== undefined ? data.terminalWidth : serverConfig.terminalWidth,
                    fontSize: data.fontSize !== undefined ? data.fontSize : serverConfig.fontSize,
                    showThinking: data.showThinking !== undefined ? data.showThinking : serverConfig.showThinking,
                    enableStreaming: data.enableStreaming !== undefined ? data.enableStreaming : serverConfig.enableStreaming,
                    debugMode: data.debugMode !== undefined ? data.debugMode : serverConfig.debugMode
                };
                console.log('Server config updated by client:', serverConfig);
                broadcast({ type: 'log', message: 'Server config updated.' });

                if (isStreamingAI && aiStreamInterval) {
                    clearTimeout(aiStreamInterval);
                    typingSpeedDelay = serverConfig.typingSpeed * 1000;
                }

                if (serverConfig.debugMode) {
                    broadcast({ type: 'debug', debug: { ws: 'Active', ffmpeg: 'Ready' } });
                } else {
                    broadcast({ type: 'debug', debug: { ws: '-', ffmpeg: '-', fps: '-', buffer: '-' } });
                }
            }
        } catch (error) {
            console.error('Error parsing or handling WebSocket message:', error);
            broadcast({ type: 'log', message: `Server WS error: ${error.message}` });
        }
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
        broadcast({ type: 'log', message: 'Client disconnected.' });
    });

    ws.on('error', error => {
        console.error('WebSocket error for client:', error);
        broadcast({ type: 'log', message: `Client WS error: ${error.message}` });
    });
});

// --- Server Heartbeat Check (for dead clients) ---
setInterval(() => {
    wss.clients.forEach(ws => {
        if (!ws.isAlive) {
            console.log('Terminating dead WebSocket connection.');
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

// --- YouTube Streaming Logic (Placeholder) ---
function startYouTubeStream() {
    if (isStreamingYouTube) {
        broadcast({ type: 'log', message: 'YouTube stream already active.' });
        return;
    }

    const YOUTUBE_URL = `rtmp://a.rtmp.youtube.com/live2/${process.env.YOUTUBE_STREAM_KEY}`;

    if (!process.env.YOUTUBE_STREAM_KEY) {
        broadcast({ type: 'log', message: 'YouTube Stream Key is not set in environment variables!' });
        console.error('YouTube Stream Key (YOUTUBE_STREAM_KEY) is not set!');
        return;
    }

    broadcast({ type: 'log', message: `Attempting to start YouTube stream to ${YOUTUBE_URL}...` });
    isStreamingYouTube = true;
    broadcast({ type: 'streamStatus', message: 'Connecting...' });

    youtubeStreamProcess = spawn('ffmpeg', [
        '-re',
        '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:r=30',
        '-f', 'lavfi', '-i', 'sine=frequency=1000:duration=1:sample_rate=44100',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-maxrate', '3000k',
        '-bufsize', '6000k',
        '-g', '60',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '160k',
        '-ar', '44100',
        '-f', 'flv',
        YOUTUBE_URL
    ]);

    youtubeStreamProcess.stdout.on('data', data => {
        // console.log(`FFmpeg stdout: ${data}`);
    });

    youtubeStreamProcess.stderr.on('data', data => {
        console.error(`FFmpeg stderr: ${data}`);
    });

    youtubeStreamProcess.on('close', code => {
        console.log(`FFmpeg process exited with code ${code}`);
        if (code === 0) {
            broadcast({ type: 'log', message: 'YouTube stream stopped successfully.' });
        } else {
            broadcast({ type: 'log', message: `YouTube stream ended with error code ${code}.` });
        }
        isStreamingYouTube = false;
        broadcast({ type: 'streamStatus', message: 'Off' });
        youtubeStreamProcess = null;
    });

    youtubeStreamProcess.on('error', err => {
        console.error('Failed to start FFmpeg for YouTube stream:', err);
        broadcast({ type: 'log', message: `YouTube stream FFmpeg error: ${err.message}` });
        isStreamingYouTube = false;
        broadcast({ type: 'streamStatus', message: 'Error' });
        youtubeStreamProcess = null;
    });

    broadcast({ type: 'log', message: 'FFmpeg process started for YouTube stream.' });
    broadcast({ type: 'streamStatus', message: 'Live' });
}

function stopYouTubeStream() {
    if (youtubeStreamProcess) {
        console.log('Stopping YouTube stream process...');
        youtubeStreamProcess.kill('SIGTERM');
        youtubeStreamProcess = null;
        broadcast({ type: 'log', message: 'YouTube stream termination requested.' });
    } else {
        broadcast({ type: 'log', message: 'No active YouTube stream to stop.' });
    }
}

// --- Server Start ---
server.listen(PORT, () => {
    console.log(`🧠 AI Consciousness Terminal running on port ${PORT}`);
    console.log(`🔄 Keep-alive endpoint: /keep-alive`);
    console.log(`📊 Health check: /health`);
    console.log(`🔧 FFmpeg test: /api/test-ffmpeg`);
    console.log(`📺 YouTube streaming ready (requires YOUTUBE_STREAM_KEY env var)`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully.');
    if (youtubeStreamProcess) {
        youtubeStreamProcess.kill('SIGTERM');
    }
    wss.close(() => {
        server.close(() => {
            console.log('HTTP server closed.');
            process.exit(0);
        });
    });
});
