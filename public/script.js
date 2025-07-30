document.addEventListener('DOMContentLoaded', () => {
    const outputDiv = document.getElementById('output');
    const commandInput = document.getElementById('command-input');
    let socket;

    // Function to append messages to the terminal output
    function appendMessage(message, className = '') {
        const p = document.createElement('p');
        p.textContent = message;
        if (className) {
            p.classList.add(className);
        }
        outputDiv.appendChild(p);
        outputDiv.scrollTop = outputDiv.scrollHeight; // Scroll to bottom
    }

    // Function to connect to the WebSocket
    function connectWebSocket() {
        // Use wss:// for secure connections on Render (HTTPS), ws:// for local HTTP
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname;
        // Render sets the PORT env variable for the backend, but the frontend
        // connects to the standard web port (80 or 443) that Render exposes.
        // We don't need to specify a port here unless Render exposes it on a non-standard port to the *client*.
        // For standard Render web services, just hostname is fine.
        socket = new WebSocket(`${protocol}//${hostname}`);

        socket.onopen = () => {
            appendMessage('Connection established with AI Consciousness. Type your commands.', 'system-message');
            commandInput.focus();
        };

        socket.onmessage = event => {
            appendMessage(event.data, 'ai-message');
        };

        socket.onclose = () => {
            appendMessage('Connection to AI Consciousness lost. Attempting to reconnect...', 'error-message');
            // Attempt to reconnect after a short delay
            setTimeout(connectWebSocket, 3000); 
        };

        socket.onerror = error => {
            appendMessage('WebSocket error: ' + error.message, 'error-message');
            console.error('WebSocket error:', error);
            socket.close(); // Force close to trigger reconnect
        };
    }

    // Handle command input
    commandInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const command = commandInput.value.trim();
            if (command) {
                appendMessage(`$ ${command}`, 'user-input');
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(command);
                } else {
                    appendMessage('Not connected to AI. Please wait for connection.', 'error-message');
                }
                commandInput.value = ''; // Clear input
            }
        }
    });

    // Initial connection attempt
    connectWebSocket();
});
