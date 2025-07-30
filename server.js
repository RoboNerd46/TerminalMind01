const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000; // Render sets PORT automatically, fallback to 10000

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Create an HTTP server
const server = http.createServer(app);

// Create a WebSocket server instance linked to the HTTP server
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
    console.log('Client connected to WebSocket.');

    ws.send('Welcome to the AI Consciousness Terminal. Type "start" to activate.');

    ws.on('message', message => {
        const receivedMessage = message.toString();
        console.log(`Received message from client: ${receivedMessage}`);

        // --- Simulate AI Consciousness ---
        let response = '';
        if (receivedMessage.toLowerCase().includes('start')) {
            response = 'AI Consciousness activated. Awaiting commands...';
        } else if (receivedMessage.toLowerCase().includes('stop')) {
            response = 'AI Consciousness deactivated. Goodbye.';
        } else if (receivedMessage.toLowerCase().includes('hello')) {
            response = 'Greetings, sentient being.';
        } else if (receivedMessage.toLowerCase().includes('time')) {
            response = `The current time is ${new Date().toLocaleTimeString('en-NZ', { timeZone: 'Pacific/Auckland' })} NZST.`;
        } else if (receivedMessage.toLowerCase().includes('date')) {
            response = `The current date is ${new Date().toLocaleDateString('en-NZ', { timeZone: 'Pacific/Auckland' })} NZST.`;
        } else if (receivedMessage.toLowerCase().includes('weather')) {
            response = 'I cannot access real-time weather data yet, but the cosmic forecast is clear.';
        } else {
            response = `Processing "${receivedMessage}"... My current protocols do not compute this input fully. Please try a simpler command like "start", "stop", "hello", "time", or "date".`;
        }
        // --- End Simulation ---

        ws.send(`AI: ${response}`);
    });

    ws.on('close', () => {
        console.log('Client disconnected from WebSocket.');
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

// Start the HTTP server
server.listen(port, () => {
    console.log(`AI Consciousness Terminal running on port ${port}`);
});
