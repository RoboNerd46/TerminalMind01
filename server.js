const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// YouTube Live Stream Configuration
const YOUTUBE_RTMP_URL = 'rtmp://a.rtmp.youtube.com/live2';
const STREAM_KEY = 'vq29-cq8y-y5e9-ypx7-8e0j'; // Your stream key

let ffmpegProcess = null;
let isStreaming = false;

// Serve static files
app.use(express.static('.'));
app.use(express.json());

// Main route - serve the AI terminal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Keep-alive endpoint
app.get('/keep-alive', (req, res) => {
    res.status(200).send('Still alive!');
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'active',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        service: 'AI Consciousness Terminal',
        streaming: isStreaming
    });
});

// Start YouTube streaming endpoint
app.post('/api/start-stream', (req, res) => {
    if (isStreaming) {
        return res.json({ success: false, message: 'Stream already running' });
    }

    try {
        // FFmpeg command to stream to YouTube
        const ffmpegArgs = [
            '-f', 'rawvideo',
            '-pix_fmt', 'rgba',
            '-s', '854x480',  // Match your canvas size
            '-r', '24',       // Frame rate
            '-i', '-',        // Input from stdin
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-f', 'flv',
            `${YOUTUBE_RTMP_URL}/${STREAM_KEY}`
        ];

        ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
        isStreaming = true;

        ffmpegProcess.stderr.on('data', (data) => {
            console.log(`FFmpeg: ${data}`);
        });

        ffmpegProcess.on('close', (code) => {
            console.log(`FFmpeg process exited with code ${code}`);
            isStreaming = false;
            ffmpegProcess = null;
        });

        ffmpegProcess.on('error', (error) => {
            console.error('FFmpeg error:', error);
            isStreaming = false;
            ffmpegProcess = null;
        });

        res.json({ success: true, message: 'YouTube stream started' });
    } catch (error) {
        console.error('Failed to start stream:', error);
        res.json({ success: false, message: error.message });
    }
});

// Stop YouTube streaming endpoint
app.post('/api/stop-stream', (req, res) => {
    if (!isStreaming || !ffmpegProcess) {
        return res.json({ success: false, message: 'No stream running' });
    }

    try {
        ffmpegProcess.kill('SIGTERM');
        isStreaming = false;
        res.json({ success: true, message: 'YouTube stream stopped' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// WebSocket for receiving canvas frames
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'frame' && isStreaming && ffmpegProcess) {
                // Convert base64 frame to buffer and send to FFmpeg
                const frameBuffer = Buffer.from(data.frame, 'base64');
                
                if (ffmpegProcess.stdin.writable) {
                    ffmpegProcess.stdin.write(frameBuffer);
                }
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

// Stream status endpoint
app.get('/api/stream-status', (req, res) => {
    res.json({
        streaming: isStreaming,
        youtube_url: isStreaming ? `${YOUTUBE_RTMP_URL}/${STREAM_KEY}` : null
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🧠 AI Consciousness Terminal running on port ${PORT}`);
    console.log(`🔄 Keep-alive endpoint: /keep-alive`);
    console.log(`📊 Health check: /health`);
    console.log(`📺 YouTube streaming ready`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGTERM');
    }
    server.close();
});
