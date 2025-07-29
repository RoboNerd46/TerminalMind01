<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Stream of Consciousness - 286 Terminal</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: #000;
            color: #00ff41;
            font-family: 'Courier New', monospace;
            overflow: hidden;
        }

        .container {
            position: relative;
            width: 100vw;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .controls {
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: rgba(0, 0, 0, 0.8);
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
        }

        .controls button {
            background: #001100;
            color: #00ff41;
            border: 1px solid #00ff41;
            padding: 5px 10px;
            margin: 2px;
            cursor: pointer;
            font-family: inherit;
            border-radius: 3px;
        }

        .controls button:hover {
            background: #002200;
        }

        canvas {
            display: block;
            flex-grow: 1;
        }
    </style>
</head>
<body>
    <div class="container">
        <canvas id="terminalCanvas"></canvas>
        <div class="controls">
            <button onclick="toggleFullscreen()">Fullscreen</button>
            <button onclick="startStream()">Start Stream</button>
            <button onclick="stopStream()">Stop Stream</button>
            <button onclick="downloadLog()">Download Log</button>
        </div>
    </div>

    <script>
        const canvas = document.getElementById('terminalCanvas');
        const ctx = canvas.getContext('2d');

        const CONFIG = {
            charLimit: 5000,
            lineHeight: 18, // Adjusted dynamically
            fontSize: 14,
            fadeSpeed: 0.02, // Speed of text fading
            scrollSpeed: 1, // Speed of content scrolling
            updateInterval: 50, // Milliseconds between updates
            wsReconnectInterval: 3000, // Milliseconds to wait before WebSocket reconnect
            heartbeatInterval: 2000, // Milliseconds for WebSocket heartbeat
            fps: 24 // Target frames per second for streaming
        };

        let currentContent = '';
        let displayContent = '';
        let lines = [];
        let charWidth = 0; // Will be calculated
        let ws = null;
        let isStreaming = false;
        let streamInterval = null;
        let heartbeatTimer = null;

        const systemLog = [];
        const qaHistory = [];
        let currentCycle = 1;
        let currentFrame = 0;

        function logMessage(message) {
            const timestamp = new Date().toLocaleTimeString();
            systemLog.push(`[${timestamp}] ${message}`);
            // Keep log short for display, but full for download
            while (systemLog.length > 20) {
                systemLog.shift();
            }
            drawTerminal(); // Redraw to show new log message
        }

        function addQA(question, answer) {
            qaHistory.push(`Q: ${question}\nA: ${answer}`);
            drawTerminal();
        }

        // --- Core Terminal Logic (omitted for brevity, assume it generates `currentContent`) ---
        // You'd have your existing AI consciousness generation and drawing logic here.
        // For testing, ensure `currentContent` has some text that would be drawn.
        
        // Placeholder for AI content generation - replace with your actual LLM7.io integration
        function generateAIContent() {
            // This is a placeholder. Your actual AI logic would fetch real content.
            // For testing, we just generate some moving text.
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/`~';
            let newText = '';
            for (let i = 0; i < 20; i++) { // Generate 20 random characters
                newText += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            currentContent += newText + ' '; // Add some space for readability
            if (currentContent.length > CONFIG.charLimit) {
                currentContent = currentContent.substring(currentContent.length - CONFIG.charLimit);
            }
            displayContent = currentContent; // Simple display, no complex scroll
        }

        function drawTerminal() {
            if (!ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.font = `${CONFIG.fontSize}px monospace`;
            ctx.fillStyle = '#00ff41';

            // Draw header
            ctx.fillText(`AI Consciousness Terminal - Cycle: ${currentCycle}`, 10, 20);

            // Calculate content lines based on displayContent and canvas width
            lines = [];
            let currentLine = '';
            const maxCharsPerLine = Math.floor((canvas.width - 20) / charWidth); // 20px padding
            const words = displayContent.split(' ');

            for (const word of words) {
                if ((currentLine + word).length * charWidth + 20 < canvas.width) {
                    currentLine += word + ' ';
                } else {
                    lines.push(currentLine.trim());
                    currentLine = word + ' ';
                }
            }
            if (currentLine.trim() !== '') {
                lines.push(currentLine.trim());
            }

            // Ensure we don't draw beyond canvas height, drawing from bottom up
            const startY = canvas.height - 10 - (lines.length * CONFIG.lineHeight);
            for (let i = 0; i < lines.length; i++) {
                const y = startY + i * CONFIG.lineHeight;
                if (y > 30) { // Don't draw over header
                    ctx.fillText(lines[i], 10, y);
                }
            }
            
            // Draw System Log
            ctx.fillText(`=== SYSTEM LOG ===`, 10, canvas.height - 10 - (systemLog.length + qaHistory.length + 3) * CONFIG.lineHeight);
            systemLog.forEach((log, index) => {
                ctx.fillText(log, 10, canvas.height - 10 - (systemLog.length - 1 - index + qaHistory.length + 1) * CONFIG.lineHeight);
            });

            // Draw Q&A History
            if (qaHistory.length > 0) {
                ctx.fillText(`=== Q&A HISTORY ===`, 10, canvas.height - 10 - (qaHistory.length + 1) * CONFIG.lineHeight);
                qaHistory.forEach((qa, index) => {
                    ctx.fillText(qa, 10, canvas.height - 10 - (qaHistory.length - 1 - index) * CONFIG.lineHeight);
                });
            }
        }


        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            updateFontMetrics();
            drawTerminal();
        }

        // Initialize character width based on font
        function calculateCharWidth() {
            ctx.font = `${CONFIG.fontSize}px monospace`;
            charWidth = ctx.measureText('M').width;
        }

        // Call this after font changes
        function updateFontMetrics() {
            calculateCharWidth();
            CONFIG.lineHeight = CONFIG.fontSize + 4;
        }

        // --- WebSocket Logic ---
        function connectWebSocket() {
            // Use window.location.host to ensure correct host for Render deployment
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.host}`;
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                logMessage('🌐 WebSocket connected');
                startHeartbeat(); // Start sending heartbeats
            };

            ws.onmessage = (event) => {
                // Not expecting messages from server, but good practice to have
                // console.log('WebSocket message from server:', event.data);
            };

            ws.onclose = (event) => {
                logMessage(`🌐 WebSocket disconnected: Code ${event.code}, Reason: ${event.reason || 'N/A'}`);
                stopHeartbeat(); // Stop heartbeats
                // Attempt to reconnect if disconnection is not intentional
                if (isStreaming) { // Only try to reconnect if we were actively streaming
                    logMessage('🌐 Attempting to reconnect WebSocket...');
                    setTimeout(connectWebSocket, CONFIG.wsReconnectInterval);
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                logMessage('🌐 WebSocket error occurred');
            };
        }

        function startHeartbeat() {
            stopHeartbeat(); // Ensure no duplicate timers
            heartbeatTimer = setInterval(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'heartbeat' }));
                    // console.log('Client: Sent heartbeat'); // Only for detailed debugging
                }
            }, CONFIG.heartbeatInterval);
        }

        function stopHeartbeat() {
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
        }

        function sendFrame() {
            if (ws && ws.readyState === WebSocket.OPEN && isStreaming) {
                // Ensure canvas has content before trying to send
                if (canvas.width > 0 && canvas.height > 0) {
                    try {
                        const frame = canvas.toDataURL('image/png').split(',')[1];
                        ws.send(JSON.stringify({ type: 'frame', frame: frame }));
                        currentFrame++;
                        // console.log('Client: Sent frame to WebSocket. Frame count:', currentFrame); // ADDED LOG
                    } catch (error) {
                        console.error('Client: Error capturing or sending frame:', error); // ADDED LOG
                        logMessage('Error sending frame to server');
                    }
                } else {
                    console.warn('Client: Canvas dimensions are zero, cannot capture frame.'); // ADDED LOG
                }
            } else {
                // console.warn('Client: WebSocket not open or not streaming, cannot send frame.'); // Too verbose
            }
        }

        // --- Streaming Control ---
        async function startStream() {
            if (isStreaming) {
                logMessage('Stream already active.');
                return;
            }

            try {
                // Connect WebSocket first
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    logMessage('Connecting WebSocket before starting stream...');
                    connectWebSocket();
                    // Give it a moment to connect
                    await new Promise(resolve => setTimeout(resolve, 500));
                    if (!ws || ws.readyState !== WebSocket.OPEN) {
                        logMessage('Failed to connect WebSocket. Cannot start stream.');
                        return;
                    }
                }

                // Call server to start FFmpeg process
                const response = await fetch('/api/start-stream', { method: 'POST' });
                const data = await response.json();

                if (data.success) {
                    isStreaming = true;
                    logMessage('🟢 Stream started! Sending frames...');
                    if (streamInterval) clearInterval(streamInterval); // Clear any old interval
                    streamInterval = setInterval(sendFrame, 1000 / CONFIG.fps); // Send frames at target FPS
                } else {
                    logMessage(`🔴 Failed to start stream: ${data.message}`);
                }
            } catch (error) {
                console.error('Error starting stream:', error);
                logMessage(`🔴 Network error starting stream: ${error.message}`);
            }
        }

        async function stopStream() {
            if (!isStreaming) {
                logMessage('Stream is not active.');
                return;
            }

            try {
                const response = await fetch('/api/stop-stream', { method: 'POST' });
                const data = await response.json();

                if (data.success) {
                    isStreaming = false;
                    if (streamInterval) clearInterval(streamInterval);
                    streamInterval = null;
                    logMessage('🛑 Stream stopped.');
                } else {
                    logMessage(`⚠️ Failed to stop stream: ${data.message}`);
                }
            } catch (error) {
                console.error('Error stopping stream:', error);
                logMessage(`⚠️ Network error stopping stream: ${error.message}`);
            } finally {
                // Always stop client-side frame sending even if API fails
                if (streamInterval) clearInterval(streamInterval);
                streamInterval = null;
                isStreaming = false;
            }
        }

        // --- Utility Functions ---
        function downloadLog() {
            const logText = systemLog.join('\n');
            const qaText = qaHistory.join('\n');
            const fullLog = `AI Consciousness Terminal Log\n\n` +
                            `Generated: ${new Date().toISOString()}\n\n` +
                            `Cycle: ${currentCycle}\n` +
                            `Frames: ${currentFrame}\n\n` +
                            `=== SYSTEM LOG ===\n${logText}\n\n` +
                            `=== Q&A HISTORY ===\n${qaText}`;
            
            const blob = new Blob([fullLog], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-consciousness-${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            logMessage('📄 Consciousness log downloaded');
        }

        function toggleFullscreen() {
            if (document.fullscreenElement) {
                document.exitFullscreen();
                logMessage('🖥️ Exited fullscreen mode');
            } else {
                document.documentElement.requestFullscreen();
                logMessage('🖥️ Entered fullscreen mode');
            }
        }

        // --- Initialization ---
        window.addEventListener('resize', resizeCanvas);
        
        // Initial setup
        resizeCanvas();
        connectWebSocket(); // Connect WebSocket on page load

        // Start content generation and drawing loop
        setInterval(() => {
            generateAIContent(); // Update AI content
            drawTerminal();       // Redraw the terminal
        }, CONFIG.updateInterval);

        // Simulate initial AI content for display
        logMessage('Initializing AI consciousness...');
        logMessage('Establishing neural pathways...');
        logMessage('System ready.');
        generateAIContent(); // Initial content
        drawTerminal();
    </script>
</body>
</html>
