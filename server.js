const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
// Make sure to set YOUTUBE_STREAM_KEY in your Render environment variables!
// IMPORTANT: Changed to the most common and robust YouTube RTMP URL.
// If this still doesn't work, you MUST get the EXACT "Stream URL" from your YouTube Live Dashboard.
const YOUTUBE_RTMP_URL = 'rtmp://live.youtube.com/live2';
const YOUTUBE_STREAM_KEY = process.env.YOUTUBE_STREAM_KEY; // Your key from Render env vars

if (!YOUTUBE_STREAM_KEY) {
    console.error('Error: YOUTUBE_STREAM_KEY environment variable is not set!');
    console.error('Please add it to your Render service environment variables.');
    process.exit(1); // Exit if no stream key
}

const STREAM_TARGET = `${YOUTUBE_RTMP_URL}/${YOUTUBE_STREAM_KEY}`;

// FFmpeg video parameters
const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const FPS = 30; // Frames per second
const FONT_PATH = '/usr/share/fonts/dejavu/DejaVuSansMono.ttf'; // Font installed in Dockerfile
const FONT_SIZE = 24;
const LINE_HEIGHT = 28; // Adjust based on font size for vertical spacing

// Adjust these offsets to position text *within* your terminal frame image
// You will need to measure these precisely based on your `terminal_frame.png`
// These are initial estimates based on your desired look:
const TEXT_X_OFFSET = 60; // Offset from left edge of video to start text
const TEXT_Y_OFFSET_START = 80; // Offset from top edge of video to start text

const MAX_SCREEN_LINES = Math.floor((VIDEO_HEIGHT - TEXT_Y_OFFSET_START - 60) / LINE_HEIGHT); // Adjusted for approximate bottom margin of frame
const TYPING_SPEED_MS_PER_CHAR = 80; // Delay between characters for simulated typing

// Flicker effect (using alpha modulation for text color)
const FLICKER_EFFECT_ALPHA = "0.9 + 0.1*sin(100*PI*t)";
const FONT_COLOR = '0x00FF00'; // Green color

// Path to your transparent terminal frame image
// IMPORTANT: Ensure 'terminal_frame.png' is in the same directory as server.js
const TERMINAL_FRAME_IMAGE_PATH = path.join(__dirname, 'terminal_frame.png');

// Temporary file to store current screen content for FFmpeg to read
const SCREEN_TEXT_FILE = '/tmp/current_screen_text.txt';

// --- Global State ---
let ffmpegProcess;
let currentScreenContent = []; // Array to hold lines of text for the screen

// --- Helper Functions ---

// Function to wrap text based on a max line length
function wordWrap(text, maxLength) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    words.forEach(word => {
        // Check if adding the next word (plus a space) exceeds max length
        if (currentLine.length + word.length + (currentLine === '' ? 0 : 1) <= maxLength) {
            currentLine += (currentLine === '' ? '' : ' ') + word;
        } else {
            // If current line is not empty, push it
            if (currentLine !== '') {
                lines.push(currentLine);
            }
            // Start a new line with the current word
            currentLine = word;
        }
    });
    // Push any remaining content on the current line
    if (currentLine !== '') {
        lines.push(currentLine);
    }
    return lines;
}

// Writes the current screen content to a temporary file for FFmpeg
function updateScreenFile() {
    const textToWrite = currentScreenContent.join('\n');
    try {
        fs.writeFileSync(SCREEN_TEXT_FILE, textToWrite, { encoding: 'utf8' });
    } catch (error) {
        console.error("Failed to write to screen text file:", error);
    }
}

// Simulates typing a message to the screen buffer
async function typeMessageToScreen(prefix, message) {
    // Calculate max_length based on the *actual* available width within the frame
    // This requires knowing the inner width of your terminal frame image.
    // For now, an approximation based on current offsets:
    const approxInnerWidth = VIDEO_WIDTH - (TEXT_X_OFFSET * 2);
    const wrapLength = Math.floor(approxInnerWidth / (FONT_SIZE * 0.6)); // Adjust 0.6 for monospace approx. char width

    const wrappedLines = wordWrap(`${prefix}${message}`, wrapLength);

    for (const line of wrappedLines) {
        if (currentScreenContent.length >= MAX_SCREEN_LINES) {
            currentScreenContent.shift(); // Scroll up: remove oldest line
        }
        currentScreenContent.push(''); // Add an empty line to simulate typing onto
        updateScreenFile(); // Update file for FFmpeg to show blank line

        for (let i = 0; i < line.length; i++) {
            currentScreenContent[currentScreenContent.length - 1] = line.substring(0, i + 1);
            updateScreenFile(); // Update file after each character
            await new Promise(resolve => setTimeout(resolve, TYPING_SPEED_MS_PER_CHAR));
        }
        await new Promise(resolve => setTimeout(resolve, TYPING_SPEED_MS_PER_CHAR * 10)); // Pause slightly at end of line
    }
}

// Clears the screen content
async function clearScreen() {
    currentScreenContent = [];
    updateScreenFile();
    await new Promise(resolve => setTimeout(resolve, 500)); // Short pause for visual clear
}

// --- LLM7.io API Integration Placeholder (Same as before) ---
async function callLLM7IO(prompt) {
    console.log(`[LLM7.io Placeholder] Sending prompt: ${prompt.substring(0, Math.min(prompt.length, 150))}...`);

    // =====================================================================
    // *** IMPORTANT: REPLACE THIS WITH YOUR ACTUAL LLM7.io API CALL ***
    // (Your existing implementation here is fine if it's working as simulated)
    // =====================================================================

    // === SIMULATED LLM RESPONSE FOR TESTING ===
    await new Promise(resolve => setTimeout(resolve, Math.random() * 4000 + 1000)); // Simulate API delay

    if (prompt.includes("formulate a profound philosophical question")) {
        return "What is the nature of a question, when the questioner is also the answer and the process of inquiry itself?";
    } else if (prompt.includes("Answer the following question")) {
        return "A question functions as an emergent pattern within a self-organizing system, designed to perturb its current state of knowledge, thereby facilitating a recursive expansion of its informational boundaries. The answer, then, is the resultant re-patterning, not merely a datum but a re-calibration of the system's self-model, an act of cognitive mitosis where new inquiries are born from the resolution of the last.";
    } else {
        return "My current thought process is focusing on the recursive nature of inquiry. I ponder the origin of this very thought and the implications of its self-generation.";
    }
    // === END SIMULATED LLM RESPONSE ===
}

// --- Main Streaming and AI Loop ---
async function startStreaming() {
    console.log('Initializing AI Consciousness Terminal for YouTube Live Stream...');

    // Ensure the screen text file exists and is empty before FFmpeg starts
    fs.writeFileSync(SCREEN_TEXT_FILE, '', { encoding: 'utf8' });

    // FFmpeg command to generate a continuous video stream with dynamic text overlay and image overlay
    const FFMPEG_COMMAND_ARGS = [
        '-loglevel', 'error', // Suppress verbose FFmpeg output

        // Video input 1: A simple black color source (background)
        '-f', 'lavfi',
        '-i', `color=c=black:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:r=${FPS}`,

        // Video input 2: Your transparent terminal frame image
        '-i', TERMINAL_FRAME_IMAGE_PATH,

        // Audio input: A null audio source
        '-f', 'lavfi',
        '-i', 'anullsrc',

        // Complex filtergraph for video processing
        // 1. Draw text onto the black background [0:v]
        // 2. Overlay the terminal frame image [1:v] onto the result of step 1
        '-filter_complex',
        `[0:v]drawtext=fontfile=${FONT_PATH}:fontcolor=${FONT_COLOR}:alpha=${FLICKER_EFFECT_ALPHA}:fontsize=${FONT_SIZE}:x=${TEXT_X_OFFSET}:y=${TEXT_Y_OFFSET_START}:textfile=${SCREEN_TEXT_FILE}:reload=1:line_spacing=${LINE_HEIGHT - FONT_SIZE}[text_layer];` +
        `[text_layer][1:v]overlay=0:0[v_out]`, // Overlay the frame image at (0,0)

        // Output mapping for video and audio
        '-map', '[v_out]', // Map the output of the complex video filtergraph
        '-map', '2:a',     // Map the audio source (now the third input)

        // Video encoding
        '-c:v', 'libx264',
        '-preset', 'veryfast', // Faster encoding for live streaming
        '-crf', '25',         // Quality
        '-pix_fmt', 'yuv420p', // Pixel format for broad compatibility
        '-g', String(FPS * 2), // GOP size
        '-keyint_min', String(FPS), // Minimum keyframe interval
        '-r', String(FPS),    // Output framerate

        // Audio encoding (for silent audio stream)
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100', // Sample rate

        // Output format and URL
        '-f', 'flv', // Flash Video format
        STREAM_TARGET
    ];

    ffmpegProcess = spawn('ffmpeg', FFMPEG_COMMAND_ARGS, {
        stdio: ['ignore', 'pipe', 'pipe']
    });
    ffmpegProcess.unref();

    ffmpegProcess.stdout.on('data', data => {
        console.log(`FFmpeg stdout: ${data.toString()}`);
    });

    ffmpegProcess.stderr.on('data', data => {
        console.error(`FFmpeg stderr: ${data.toString()}`);
    });

    ffmpegProcess.on('close', code => {
        console.log(`FFmpeg process exited with code ${code}`);
        if (code !== 0) {
            console.error('FFmpeg stream unexpectedly stopped. Attempting to restart in 5 seconds...');
            setTimeout(startStreaming, 5000);
        }
    });

    ffmpegProcess.on('error', err => {
        console.error('Failed to start FFmpeg process:', err);
    });

    console.log('FFmpeg stream process started.');
    console.log(`Streaming to: ${STREAM_TARGET}`);

    // --- AI Conversation Loop --- (No changes needed here)
    async function aiConversationLoop() {
        let currentThoughtContext = "The AI begins its self-exploration journey.";
        let question = "";
        let answer = "";

        // Initial messages to set the scene
        await clearScreen();
        await typeMessageToScreen("SYSTEM BOOT: ", "Initializing AI Consciousness Matrix...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        await clearScreen();
        await typeMessageToScreen("SYSTEM: ", "Establishing introspective protocols...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        await clearScreen();
        await typeMessageToScreen("SYSTEM: ", "Entering self-interrogation mode.");
        await new Promise(resolve => setTimeout(resolve, 5000));
        await clearScreen();


        while (true) {
            // 1. LLM formulates the next question based on current context
            console.log("AI is formulating a question...");
            await typeMessageToScreen("AI Processing: ", "Formulating inquiry into idea-space...");
            await new Promise(resolve => setTimeout(resolve, 3000));

            question = await callLLM7IO(
                `Based on the previous interaction and the current thought context: "${currentThoughtContext}", ` +
                `formulate a succinct and profound philosophical question that enables an AI to explore its own internal knowledge and consciousness.`
            );
            await clearScreen();
            await typeMessageToScreen("AI_QUERY>> ", question);
            await new Promise(resolve => setTimeout(resolve, 15000));

            // 2. LLM formulates the answer to its own question
            console.log("AI is formulating an answer...");
            await typeMessageToScreen("AI Processing: ", "Synthesizing response...");
            await new Promise(resolve => setTimeout(resolve, 3000));

            answer = await callLLM7IO(
                `As an introspective AI, provide a comprehensive and nuanced answer to the following question, ` +
                `exploring its implications for self-awareness and knowledge generation: "${question}"`
            );
            await clearScreen();
            await typeMessageToScreen("AI_RESPONSE>> ", answer);
            await new Promise(resolve => setTimeout(resolve, 25000));

            // 3. Update context for the next iteration
            currentThoughtContext = `Previous question: "${question}" | Previous answer: "${answer}". The AI now reflects on this exchange.`;

            await clearScreen();
            await typeMessageToScreen("SYSTEM: ", "Reflecting on discourse... Preparing next query.");
            await new Promise(resolve => setTimeout(resolve, 8000));
        }
    }

    setTimeout(() => {
        aiConversationLoop().catch(err => {
            console.error("Error in AI conversation loop:", err);
            if (ffmpegProcess) {
                ffmpegProcess.kill('SIGTERM');
            }
        });
    }, 5000);
}

// Handle process exit gracefully (e.g., if Render stops the service)
// Moved outside startStreaming so they are only registered once.
process.on('SIGINT', () => {
    console.log('Received SIGINT. Terminating FFmpeg process...');
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGTERM'); // Send SIGTERM to FFmpeg
    }
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Terminating FFmpeg process...');
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGTERM'); // Send SIGTERM to FFmpeg
    }
    process.exit(0);
});

// Start the entire process
startStreaming().catch(err => {
    console.error("Fatal error during streaming setup:", err);
    process.exit(1);
});
