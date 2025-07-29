const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('.'));

// Main route - serve the AI terminal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Keep-alive endpoint (matches the script's built-in functionality)
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
        service: 'AI Consciousness Terminal'
    });
});

// API proxy for LLM7.io (in case of CORS issues)
app.get('/api/status', (req, res) => {
    res.json({
        ai_service: 'LLM7.io',
        status: 'connected',
        terminal: '286-era Green Phosphor Simulation'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🧠 AI Consciousness Terminal running on port ${PORT}`);
    console.log(`🔄 Keep-alive endpoint: /keep-alive`);
    console.log(`📊 Health check: /health`);
});
