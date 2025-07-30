require('dotenv').config();
const express = require(‘express’);
const path = require(‘path’);
const { spawn } = require(‘child_process’);
const WebSocket = require(‘ws’);

const app = express();
const PORT = process.env.PORT || 3000;

// YouTube Live Stream Configuration
const YOUTUBE_RTMP_URL = ‘rtmp://a.rtmp.youtube.com/live2’;
const STREAM_KEY = process.env.YOUTUBE_STREAM_KEY || ‘your-stream-key-here’;

let ffmpegProcess = null;
let isStreaming = false;
let frameBuffer = [];
let lastFrameReceived = 0;

// Serve static files
app.use(express.static(’.’));
app.use(express.json());

// Main route - serve the AI terminal
app.get(’/’, (req, res) => {
res.sendFile(path.join(__dirname, ‘index.html’));
});

// Keep-alive endpoint
app.get(’/keep-alive’, (req, res) => {
res.status(200).send(‘Still alive!’);
});

// Health check endpoint
app.get(’/health’, (req, res) => {
res.json({
status: ‘active’,
timestamp: new Date().toISOString(),
uptime: process.uptime(),
memory: process.memoryUsage(),
service: ‘AI Consciousness Terminal’,
streaming: isStreaming,
frameBufferSize: frameBuffer.length,
lastFrameReceived: lastFrameReceived
});
});

// Start YouTube streaming endpoint
app.post(’/api/start-stream’, (req, res) => {
if (isStreaming) {
return res.json({ success: false, message: ‘Stream already running’ });
}

```
if (!STREAM_KEY || STREAM_KEY === 'your-stream-key-here') {
    return res.json({ 
        success: false, 
        message: 'YouTube stream key not configured. Set YOUTUBE_STREAM_KEY environment variable.' 
    });
}

try {
    // FFmpeg command to stream JPEG frames to YouTube
    const ffmpegArgs = [
        '-f', 'image2pipe',        // Accept images from pipe
        '-vcodec', 'mjpeg',        // Input codec is JPEG
        '-r', '24',                // Input frame rate
        '-i', '-',                 // Input from stdin
        '-vf', 'scale=1280:720',   // Scale to 720p for better YouTube compatibility
        '-c:v', 'libx264',         // Output video codec
        '-preset', 'veryfast',     // Fast encoding preset
        '-tune', 'zerolatency',    // Low latency tuning
        '-crf', '23',              // Quality setting
        '-maxrate', '2500k',       // Maximum bitrate
        '-bufsize', '5000k',       // Buffer size
        '-pix_fmt', 'yuv420p',     // Pixel format for compatibility
        '-g', '48',                // Keyframe interval (2 seconds at 24fps)
        '-f', 'flv',               // Output format for RTMP
        `${YOUTUBE_RTMP_URL}/${STREAM_KEY}`
    ];

    console.log('Starting FFmpeg with args:', ffmpegArgs.join(' '));
    ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    isStreaming = true;
    frameBuffer = [];
    lastFrameReceived = Date.now();

    // Handle FFmpeg output
    ffmpegProcess.stdout.on('data', (data) => {
        console.log(`FFmpeg stdout: ${data}`);
    });

    ffmpegProcess.stderr.on('data', (data) => {
        const message = data.toString();
        console.log(`FFmpeg: ${message}`);
        
        // Log important FFmpeg messages
        if (message.includes('Stream mapping:') || 
            message.includes('Press [q] to stop') ||
            message.includes('frame=') ||
            message.includes('error') ||
            message.includes('failed')) {
            console.log(`[FFMPEG] ${message.trim()}`);
        }
    });

    ffmpegProcess.on('close', (code) => {
        console.log(`FFmpeg process exited with code ${code}`);
        isStreaming = false;
        ffmpegProcess = null;
        frameBuffer = [];
    });

    ffmpegProcess.on('error', (error) => {
        console.error('FFmpeg spawn error:', error);
        isStreaming = false;
        ffmpegProcess = null;
        frameBuffer = [];
    });

    // Check if FFmpeg started successfully
    setTimeout(() => {
        if (ffmpegProcess && !ffmpegProcess.killed) {
            console.log('FFmpeg process started successfully');
        }
    }, 1000);

    res.json({ 
        success: true, 
        message: 'YouTube stream started',
        streamUrl: `${YOUTUBE_RTMP_URL}/${STREAM_KEY.substring(0, 8)}...`
    });
} catch (error) {
    console.error('Failed to start stream:', error);
    isStreaming = false;
    ffmpegProcess = null;
    res.json({ success: false, message: error.message });
}
```

});

// Stop YouTube streaming endpoint
app.post(’/api/stop-stream’, (req, res) => {
if (!isStreaming || !ffmpegProcess) {
return res.json({ success: false, message: ‘No stream running’ });
}

```
try {
    console.log('Stopping FFmpeg process...');
    
    // Close stdin first to signal end of input
    if (ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
        ffmpegProcess.stdin.end();
    }
    
    // Then send SIGTERM
    setTimeout(() => {
        if (ffmpegProcess && !ffmpegProcess.killed) {
            ffmpegProcess.kill('SIGTERM');
        }
    }, 1000);
    
    // Force kill if still running after 5 seconds
    setTimeout(() => {
        if (ffmpegProcess && !ffmpegProcess.killed) {
            console.log('Force killing FFmpeg process');
            ffmpegProcess.kill('SIGKILL');
        }
    }, 5000);
    
    isStreaming = false;
    frameBuffer = [];
    res.json({ success: true, message: 'YouTube stream stopped' });
} catch (error) {
    console.error('Error stopping stream:', error);
    res.json({ success: false, message: error.message });
}
```

});

// WebSocket for receiving canvas frames
const server = require(‘http’).createServer(app);
const wss = new WebSocket.Server({ server });

wss.on(‘connection’, (ws) => {
console.log(‘WebSocket client connected’);
let clientFrameCount = 0;

```
// Add a timeout to detect if client stops sending frames/heartbeats
let frameTimeout;

const resetFrameTimeout = () => {
    clearTimeout(frameTimeout);
    frameTimeout = setTimeout(() => {
        console.warn('Server: No frames/heartbeats received from client for 10 seconds.');
    }, 10000); // 10 seconds
};

resetFrameTimeout();

ws.on('message', (message) => {
    resetFrameTimeout();
    try {
        const data = JSON.parse(message);

        if (data.type === 'frame') {
            clientFrameCount++;
            lastFrameReceived = Date.now();
            
            if (isStreaming && ffmpegProcess && ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
                try {
                    // Convert base64 JPEG to buffer
                    const frameBuffer = Buffer.from(data.frame, 'base64');
                    
                    // Write frame to FFmpeg stdin
                    const written = ffmpegProcess.stdin.write(frameBuffer);
                    
                    if (!written) {
                        console.warn('FFmpeg stdin buffer is full, frame may be dropped');
                    }
                    
                    // Log progress every 5 seconds (120 frames at 24fps)
                    if (clientFrameCount % 120 === 0) {
                        console.log(`Processed ${clientFrameCount} frames from client`);
                    }
                    
                } catch (writeError) {
                    console.error('Error writing frame to FFmpeg:', writeError);
                }
            } else {
                if (isStreaming) {
                    console.warn('FFmpeg process not ready for frame data');
                }
            }
        } else if (data.type === 'heartbeat') {
            // Send heartbeat response
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'heartbeat_response',
                    timestamp: Date.now(),
                    streaming: isStreaming,
                    framesReceived: clientFrameCount
                }));
            }
        }
    } catch (error) {
        console.error('WebSocket message parsing error:', error);
    }
});

ws.on('close', (code, reason) => {
    clearTimeout(frameTimeout);
    console.log(`WebSocket client disconnected: ${code} ${reason}`);
    console.log(`Client sent ${clientFrameCount} frames during session`);
    
    // Don't automatically stop FFmpeg on disconnect - let user control it
    // This allows for reconnection without stopping the stream
});

ws.on('error', (error) => {
    console.error('WebSocket server error:', error);
});

// Send initial connection response
if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
        type: 'connection_established',
        streaming: isStreaming,
        timestamp: Date.now()
    }));
}
```

});

// Stream status endpoint
app.get(’/api/stream-status’, (req, res) => {
res.json({
streaming: isStreaming,
ffmpegRunning: ffmpegProcess && !ffmpegProcess.killed,
frameBufferSize: frameBuffer.length,
lastFrameReceived: lastFrameReceived,
timeSinceLastFrame: Date.now() - lastFrameReceived
});
});

// Test endpoint to verify FFmpeg installation
app.get(’/api/test-ffmpeg’, (req, res) => {
const testProcess = spawn(‘ffmpeg’, [’-version’]);
let output = ‘’;

```
testProcess.stdout.on('data', (data) => {
    output += data.toString();
});

testProcess.stderr.on('data', (data) => {
    output += data.toString();
});

testProcess.on('close', (code) => {
    res.json({
        success: code === 0,
        code: code,
        output: output.substring(0, 500) // Limit output length
    });
});

testProcess.on('error', (error) => {
    res.json({
        success: false,
        error: error.message
    });
});
```

});

server.listen(PORT, ‘0.0.0.0’, () => {
console.log(`🧠 AI Consciousness Terminal running on port ${PORT}`);
console.log(`🔄 Keep-alive endpoint: /keep-alive`);
console.log(`📊 Health check: /health`);
console.log(`🔧 FFmpeg test: /api/test-ffmpeg`);
console.log(`📺 YouTube streaming ready${STREAM_KEY === 'your-stream-key-here' ? ' (set YOUTUBE_STREAM_KEY env var)' : ''}`);

```
if (!process.env.YOUTUBE_STREAM_KEY) {
    console.warn('⚠️  Warning: YOUTUBE_STREAM_KEY environment variable not set');
}
```

});

// Graceful shutdown
process.on(‘SIGTERM’, () => {
console.log(‘SIGTERM received. Shutting down gracefully.’);
if (ffmpegProcess && !ffmpegProcess.killed) {
console.log(‘Stopping FFmpeg…’);
if (ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
ffmpegProcess.stdin.end();
}
ffmpegProcess.kill(‘SIGTERM’);
}
server.close(() => {
console.log(‘HTTP server closed.’);
process.exit(0);
});
});

process.on(‘SIGINT’, () => {
console.log(‘SIGINT received. Shutting down gracefully.’);
if (ffmpegProcess && !ffmpegProcess.killed) {
console.log(‘Stopping FFmpeg…’);
if (ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
ffmpegProcess.stdin.end();
}
ffmpegProcess.kill(‘SIGINT’);
}
server.close(() => {
console.log(‘HTTP server closed.’);
process.exit(0);
});
});
