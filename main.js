// 'main.js' is the core of our Electron application (the Backend).
// Here we handle the file system, windows, and heavy processing (FFmpeg and Gemini API).
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// We import FFmpeg (a powerful tool for audio and video manipulation).
// We use auto-installer packages so the user doesn't need to manually download FFmpeg.
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const { PCA } = require('ml-pca');

// Official Google SDK for Gemini
const { GoogleGenAI } = require('@google/genai');

// Configuring FFmpeg paths in our system
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#00000000',
            symbolColor: '#ffffff',
            height: 40
        },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Ensure temp dir exists
// We create a temporary folder where we'll save the sliced audio chunks before sending them to Gemini.
const tempDir = path.join(app.getPath('userData'), 'temp_audio');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Inter Process Communication
// IPC (Inter-Process Communication): It's how the front-end (HTML/JS) "talks" to the back-end (Node.js/Electron).
// Here, we create a listener ('select-files') for when the user clicks the select files button.
ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Audio', extensions: ['mp3'] }]
    });
    return result.filePaths;
});

// Helper function: Gets the total duration of the audio file using FFprobe.
const getDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) reject(err);
            else resolve(metadata.format.duration);
        });
    });
};

// Helper function: Slice/Crop an audio segment.
// It takes the original file, starts at `start` time, and cuts a piece of `duration` time.
const cropAudio = (inputPath, outputPath, start, duration) => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .setStartTime(start)
            .setDuration(duration)
            .output(outputPath)
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err))
            .run();
    });
};

// =====================================================================
// MATHEMATICAL MAGIC (Mean Pooling)
// How does the Gemini model process things? It generates a giant Array of numbers (vector).
// If we divide the song into several pieces (e.g., 5 parts), we will have 5 vectors.
// To represent the *entire* song in a single vector, we add the values at the same positions and divide by the total (Arithmetic Mean).
// This preserves the global acoustic characteristics of the song!
// =====================================================================
const averageVectors = (vectors) => {
    if (!vectors || vectors.length === 0) return [];
    
    const vectorLength = vectors[0].length;
    const averaged = new Array(vectorLength).fill(0);
    
    // Sum the 'j' column of all 'i' vectors
    for (let i = 0; i < vectors.length; i++) {
        for (let j = 0; j < vectorLength; j++) {
            averaged[j] += vectors[i][j];
        }
    }
    
    // Divide by the total number of vectors to get the mean
    for (let j = 0; j < vectorLength; j++) {
        averaged[j] /= vectors.length;
    }
    
    return averaged;
};

// =====================================================================
// MAIN FLOW: AUDIO PROCESSING
// =====================================================================
ipcMain.handle('process-audio', async (event, filePath, apiKey) => {
    try {
        if (!apiKey) throw new Error("Gemini API Key is required.");

        const ai = new GoogleGenAI({ apiKey });
        const fileName = path.basename(filePath);
        
        event.sender.send('process-progress', { file: filePath, status: 'Analyzing audio duration...' });
        
        // Use 80 seconds per chunk
        // The processing limit of some models may vary, 
        // so we slice the song into 80-second chunks.
        const maxDuration = 80;
        const duration = await getDuration(filePath);
        
        // Calculates how many parts the song will be divided into
        const chunksCount = Math.ceil(duration / maxDuration);
        const collectedVectors = [];

        for (let i = 0; i < chunksCount; i++) {
            const startPoint = i * maxDuration;
            const chunkDuration = Math.min(maxDuration, duration - startPoint);
            
            // Skip tiny chunks (less than 2 seconds) that might cause errors
            // We ignore very short chunks at the end of the song to avoid API errors
            if (chunkDuration < 2) continue;
            
            event.sender.send('process-progress', { file: filePath, status: `Slicing chunk ${i + 1} of ${chunksCount}...` });
            
            // 1. Cut the audio locally (saves to a temporary file)
            const tempCropPath = path.join(tempDir, `crop_${Date.now()}_${i}.mp3`);
            await cropAudio(filePath, tempCropPath, startPoint, chunkDuration);
            
            event.sender.send('process-progress', { file: filePath, status: `Uploading chunk ${i + 1} of ${chunksCount}...` });
            
            // 2. Upload the audio chunk to Google Gemini servers
            const uploadResult = await ai.files.upload({
                file: tempCropPath,
                mimeType: 'audio/mp3',
            });
            
            event.sender.send('process-progress', { file: filePath, status: `Embedding chunk ${i + 1} of ${chunksCount}...` });
            
            // 3. Audio Embedding (Vector) Extraction
            // This is where the AI "Magic" happens. It "listens" to the chunk and turns the sound 
            // into a series of numbers that represent its mood, style, beat, etc.
            const response = await ai.models.embedContent({
                model: 'gemini-embedding-2-preview',
                contents: [
                    {
                        fileData: {
                            fileUri: uploadResult.uri,
                            mimeType: uploadResult.mimeType
                        }
                    }
                ]
            });

            // Cleanup remote
            // 4. Remote Cleanup: Important to delete the file on Google's side to avoid taking up space on the user's account
            try {
               await ai.files.delete({ name: uploadResult.name });
            } catch(e) {
               console.log("Warning: Failed to delete file from Gemini:", e.message);
            }
            
            // Cleanup local
            // 5. Local Cleanup: Deletes the tiny piece of audio from the computer
            if (fs.existsSync(tempCropPath)) {
                fs.unlinkSync(tempCropPath);
            }
            
            // Keeps the extracted vector in our list so we can average it later
            let values;
            if (response.embedding && response.embedding.values) {
                values = response.embedding.values;
            } else if (response.embeddings && response.embeddings.length > 0) {
                values = response.embeddings[0].values;
            }

            if (values) {
                collectedVectors.push(values);
            }
        }

        if (collectedVectors.length === 0) {
            throw new Error("Could not obtain embedding vectors from any chunk.");
        }

        event.sender.send('process-progress', { file: filePath, status: 'Mean Pooling and Saving...' });
        
        // Mathematical Mean Pooling
        // Transforms the many vectors into 1 single vector (a definitive digital fingerprint of the entire song)
        const masterVector = averageVectors(collectedVectors);
        
        // Saves this "digital fingerprint" in a local JSON file that will serve as our "Database"
        const dbPath = path.join(__dirname, 'embeddings.json');
        let db = {};
        if (fs.existsSync(dbPath)) {
            const data = fs.readFileSync(dbPath, 'utf8');
            try { db = JSON.parse(data); } catch(e) {}
        }

        db[fileName] = masterVector;
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

        event.sender.send('process-progress', { file: filePath, status: 'Done!' });
        return { success: true, fileName };

    } catch (error) {
        console.error(error);
        return { success: false, error: error.message };
    }
});

// IPC for retrieving embeddings
// Listens to calls from the front-end requesting the entire "Database" to perform comparisons
ipcMain.handle('get-database', () => {
    const dbPath = path.join(__dirname, 'embeddings.json');
    if (!fs.existsSync(dbPath)) return {};
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
});

// IPC for 3D Visualization (PCA Dimensionality Reduction)
// Reduces the 768 dimensions from Gemini to just 3 (X, Y, Z) so we can plot them on a 3D graph!
ipcMain.handle('get-3d-embeddings', () => {
    const dbPath = path.join(__dirname, 'embeddings.json');
    if (!fs.existsSync(dbPath)) return {};
    
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const labels = Object.keys(db);
    const vectors = Object.values(db);
    
    if (vectors.length === 0) return {};
    
    try {
        // Initialize PCA with the original vectors
        const pca = new PCA(vectors);
        // Reduce dimensionality to 3 principal components
        const reduced = pca.predict(vectors, { nComponents: 3 }).to2DArray();
        
        const result = {};
        for (let i = 0; i < labels.length; i++) {
            result[labels[i]] = reduced[i];
        }
        return result;
    } catch(e) {
        console.error("PCA Error: ", e);
        return {};
    }
});
