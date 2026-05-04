const { contextBridge, ipcRenderer } = require('electron');

// =====================================================================
// PRELOAD SCRIPT (The Secure Bridge)
// For security reasons, HTML/JS does not have direct access to PC files (Node.js).
// The ContextBridge acts as a "controlled bridge". We only expose to the front-end
// the specific methods we configure here.
// =====================================================================

contextBridge.exposeInMainWorld('api', {
    // Front-end says: "Open the file explorer" -> Invokes 'select-files' in main.js
    selectFiles: () => ipcRenderer.invoke('select-files'),
    
    // Front-end says: "Process this audio over there"
    processAudio: (filePath, apiKey) => ipcRenderer.invoke('process-audio', filePath, apiKey),
    
    // Front-end asks for the saved songs database
    getDatabase: () => ipcRenderer.invoke('get-database'),
    
    // Front-end asks for the 3D coordinates for the graph
    get3DEmbeddings: () => ipcRenderer.invoke('get-3d-embeddings'),
    
    // Continuous event: listening to progress updates from main.js
    onProgress: (callback) => ipcRenderer.on('process-progress', (event, message) => callback(message))
});
