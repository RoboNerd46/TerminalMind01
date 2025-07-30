const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
// Make sure to set YOUTUBE_STREAM_KEY in your Render environment variables!
// IMPORTANT: Double-check your actual YouTube RTMP URL.
// The provided URL 'rtmp://a.rtmp.youtube.com/live2' is unusual.
// Standard YouTube RTMP ingest URLs are typically like 'rtmp://a.rtmp.youtube.com/live2'
// If you have a different base RTMP URL from YouTube, replace it here.
const YOUTUBE_RTMP_URL = 'rtmp://a.rtmp.youtube.com/live2';
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
const TEXT_X_OFFSET = 10;
const TEXT_Y_OFFSET_START = 10;
const MAX_SCREEN_LINES = Math.floor((VIDEO_HEIGHT - TEXT_Y_OFFSET_START) / LINE_HEIGHT);
const TYPING_SPEED_MS_PER_CHAR = 50; // Delay between characters for simulated typing

// Flicker effect (using alpha modulation for text color)
// This creates a subtle, rapid brightness fluctuation of the text.
// The expression `0.9 + 0.1*sin(100*PI*t)` makes alpha oscillate between 0.8 and 1.0 at 50Hz.
const FLICKER_EFFECT_ALPHA = "0.9 + 0.1*sin(100*PI*t)";

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
    // Join lines, ensure no empty lines at the end if the last line is full
    const textToWrite = currentScreenContent.join('\n');
    try {
        fs.writeFileSync(SCREEN_TEXT_FILE, textToWrite, { encoding: 'utf8' });
    } catch (error) {
        console.error("Failed to write to screen text file:", error);
    }
}

// Simulates typing a message to the screen buffer
async function typeMessageToScreen(prefix, message) {
    const wrappedLines = wordWrap(`${prefix}${message}`, Math.floor((VIDEO_WIDTH - TEXT_X_OFFSET * 2) / (FONT_SIZE * 0.6))); // Adjust 0.6 for monospace approx. char width

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
        await new Promise(resolve => setTimeout(resolve, TYPING_SPEED_MS_PER_CHAR * 5)); // Pause slightly at end of line
    }
}

// Clears the screen content
async function clearScreen() {
    currentScreenContent = [];
    updateScreenFile();
    await new Promise(resolve => setTimeout(resolve, 500)); // Short pause for visual clear
}

// --- LLM7.io API Integration Placeholder ---
async function callLLM7IO(prompt) {
    console.log(`[LLM7.io Placeholder] Sending prompt: ${prompt.substring(0, Math.min(prompt.length, 150))}...`);

    // =====================================================================
    // *** IMPORTANT: REPLACE THIS WITH YOUR ACTUAL LLM7.io API CALL ***
    // You will need to install the LLM7.io SDK or use a direct HTTP request (e.g., with 'node-fetch' npm package)
    // Make sure to add 'node-fetch' to your package.json dependencies if you use it.
    // Example:
    /*
    const fetch = require('node-fetch'); // if you install node-fetch

    try {
        const response = await fetch('https://api.llm7.io/v1/chat/completions', { // Adjust endpoint as per LLM7.io docs
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // No Authorization header if LLM7.io does not require API key
            },
            body: JSON.stringify({
                model: "your-llm7-model-name", // e.g., "llm7-pro", "llm7-fast"
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`LLM7.io API error: ${response.status} - ${errorBody}`);
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();

    } catch (error) {
        console.error("Error calling LLM7.io API:", error);
        return "ERROR: LLM communication failed. Retrying..."; // Provide a fallback
    }
    */
    // =====================================================================

    // === SIMULATED LLM RESPONSE FOR TESTING ===
    // If you haven't integrated LLM7.io yet, this will provide test responses.
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

    // FFmpeg command to generate a continuous video stream with dynamic text overlay
    // Reads text from SCREEN_TEXT_FILE, reloads it constantly, and applies flicker.
    const FFMPEG_COMMAND_ARGS = [
        '-loglevel', 'error', // Suppress verbose FFmpeg output
        '-f', 'lavfi', // Specify libavfilter as the input format
        // Use a single complex filtergraph as the input for video and audio
        // `color` source for background, `drawtext` for text, `anullsrc` for silent audio
        '-i', `color=c=black:s=${VIDEO_WIDTH}x${VIDEO_HEIGHT}:r=${FPS}[bg];` +
              `anullsrc[a];` + // Add anullsrc here
              `[bg]drawtext=fontfile=${FONT_PATH}:fontcolor=0x00FF00@${FLICKER_EFFECT_ALPHA}:fontsize=${FONT_SIZE}:x=${TEXT_X_OFFSET}:y=${TEXT_Y_OFFSET_START}:textfile=${SCREEN_TEXT_FILE}:reload=1:line_spacing=${LINE_HEIGHT - FONT_SIZE}[v]`,
        
        // Output mapping for video and audio (now mapped from the complex filtergraph)
        '-map', '[v]', // Map the generated video stream output by the filtergraph
        '-map', '[a]', // Map the generated audio stream output by the filtergraph

        // Video encoding
        '-c:v', 'libx264',
        '-preset', 'veryfast', // Faster encoding for live streaming
        '-crf', '25',         // Quality (23 is default, lower is better quality/larger file, higher is worse quality/smaller file)
        '-pix_fmt', 'yuv420p', // Pixel format for broad compatibility
        '-g', String(FPS * 2), // GOP size (frames between keyframes), e.g., 2 seconds of video
        '-keyint_min', String(FPS), // Minimum keyframe interval, e.g., 1 second
        '-r', String(FPS),    // Output framerate

        // Audio encoding (for silent audio stream)
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100', // Sample rate

        // Output format and URL
        '-f', 'flv', // Flash Video format, common for RTMP
        STREAM_TARGET
    ];

    ffmpegProcess = spawn('ffmpeg', FFMPEG_COMMAND_ARGS);

    // Log FFmpeg's stdout and stderr for debugging
    ffmpegProcess.stdout.on('data', data => {
        console.log(`FFmpeg stdout: ${data.toString()}`);
    });

    ffmpegProcess.stderr.on('data', data => {
        // FFmpeg often logs progress and errors to stderr.
        // You might see lines like 'frame=...' or 'fps=...' here.
        console.error(`FFmpeg stderr: ${data.toString()}`);
    });

    ffmpegProcess.
