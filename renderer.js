// =====================================================================
// RENDERER LOGIC (Front-End)
// Here we control the User Interface (Buttons, Lists, Text, Visual AI)
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
    // --- TRANSLATION LOGIC ---
    const translations = {
        en: {
            apiKeyPlaceholder: "Gemini API Key",
            heroTitle: "Select songs to classify",
            heroDesc: "Audio will be analyzed by Gemini Embeddings 2. We intelligently slice the entire song into 80-second blocks and mathematically average the results for unmatched acoustic fidelity.",
            btnBrowse: "Browse .mp3 files",
            queueTitle: "Processing Queue",
            queueFiles: "Files",
            emptyState: "No files selected.",
            btnCompare: "Launch AI (Compare Songs)",
            btn3D: "3D Spectrum",
            compareTitle: "Similarity Analyzer (Cosine Approx.)",
            graphTitle: "Acoustic Spectrum (PCA Visualization)",
            selectReference: "Select a song as a reference...",
            compareEmpty: "Select a reference above to see the most similar ones.",
            pleaseEnterKey: "Please enter your Gemini API Key above!",
            waiting: "Waiting to process...",
            queueBadge: "Queue",
            processing: "Processing...",
            extracted: "Extracted",
            failed: "Failed",
            noSongs: "You do not have any processed songs yet."
        },
        pt: {
            apiKeyPlaceholder: "Chave de API do Gemini",
            heroTitle: "Selecione músicas para classificar",
            heroDesc: "O áudio será analisado pelo Gemini Embeddings 2. Fatiamos a música em blocos de 80 segundos e calculamos a média matemática dos resultados para uma precisão acústica incomparável.",
            btnBrowse: "Procurar arquivos .mp3",
            queueTitle: "Fila de Processamento",
            queueFiles: "Arquivos",
            emptyState: "Nenhum arquivo selecionado.",
            btnCompare: "Iniciar IA (Comparar Músicas)",
            btn3D: "Espectro 3D",
            compareTitle: "Analisador de Similaridade (Aprox. por Cosseno)",
            graphTitle: "Espectro Acústico (Visualização PCA)",
            selectReference: "Selecione uma música como referência...",
            compareEmpty: "Selecione uma referência acima para ver as mais similares.",
            pleaseEnterKey: "Por favor, insira sua Chave de API do Gemini acima!",
            waiting: "Aguardando processamento...",
            queueBadge: "Fila",
            processing: "Processando...",
            extracted: "Extraído",
            failed: "Falhou",
            noSongs: "Você ainda não possui nenhuma música processada."
        }
    };

    let currentLang = localStorage.getItem('appLang') || 'en';
    const langSelect = document.getElementById('langSelect');
    langSelect.value = currentLang;

    function applyTranslations(lang) {
        currentLang = lang;
        localStorage.setItem('appLang', lang);
        const t = translations[lang];

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) el.textContent = t[key];
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (t[key]) el.placeholder = t[key];
        });
        
        // Update dynamic text if elements exist
        const refOption = document.querySelector('#reference-select option[value=""]');
        if (refOption) refOption.textContent = t.selectReference;
        
        const qFiles = document.querySelector('[data-i18n="queueFiles"]');
        if(qFiles) qFiles.textContent = t.queueFiles;
    }

    langSelect.addEventListener('change', (e) => applyTranslations(e.target.value));
    applyTranslations(currentLang); // initial call
    // -------------------------

    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyBtn = document.getElementById('saveKeyBtn');
    const selectBtn = document.getElementById('select-btn');
    const fileList = document.getElementById('file-list');
    const queueCount = document.getElementById('queue-count');

    // Load API Key if exists
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        apiKeyInput.type = 'password';
    }

    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('geminiApiKey', key);
            saveKeyBtn.style.backgroundColor = 'var(--success)';
            setTimeout(() => { saveKeyBtn.style.backgroundColor = ''; }, 1000);
        }
    });

    // Helper to get filename from path
    const getFileName = (path) => path.split('\\').pop().split('/').pop();

    let processedCount = 0;
    let totalCount = 0;

    // Handle Progress IPC
    // Listens to progress updates from our "backend" (main.js) and updates the UI.
    window.api.onProgress((data) => {
        const { file, status } = data;
        const safeId = "file-" + getFileName(file).replace(/[^a-zA-Z0-9]/g, '');
        
        const listItem = document.getElementById(safeId);
        if (listItem) {
            const statusText = listItem.querySelector('.file-status');
            const statusBadge = listItem.querySelector('.status-badge');
            
            statusText.textContent = status;
            
            if (status === 'Done!') {
                statusBadge.className = 'status-badge success';
                statusBadge.textContent = translations[currentLang].extracted;
                
                processedCount++;
            } else if (status.startsWith('Error')) {
                 statusBadge.className = 'status-badge error';
                 statusBadge.textContent = translations[currentLang].failed;
            }
        }
    });

    selectBtn.addEventListener('click', async () => {
        // ... API key checks...
        const key = apiKeyInput.value.trim();
        if (!key) {
            const originalText = selectBtn.innerHTML;
            selectBtn.innerHTML = `<span>${translations[currentLang].pleaseEnterKey}</span>`;
            selectBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
            apiKeyInput.focus();
            
            setTimeout(() => {
                selectBtn.innerHTML = originalText;
                selectBtn.style.background = '';
            }, 3000);
            return;
        }

        // Opens the file explorer and gets the file paths
        const files = await window.api.selectFiles();
        if (!files || files.length === 0) return;

        // Clear empty state
        if (totalCount === 0) {
            fileList.innerHTML = '';
        }

        const newFilesToProcess = [];
        
        for (const filePath of files) {
            const fileName = getFileName(filePath);
            const safeId = "file-" + fileName.replace(/[^a-zA-Z0-9]/g, '');

            // Don't add if already in list
            if (document.getElementById(safeId)) continue;
            
            totalCount++;
            const qCountNum = document.getElementById('qCountNum');
            if (qCountNum) qCountNum.textContent = totalCount;

            // Visually creates the song in the processing list
            const li = document.createElement('li');
            li.className = 'file-item';
            li.id = safeId;
            li.innerHTML = `
                <div class="file-info">
                    <div class="file-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                    </div>
                    <div class="file-details">
                        <span class="file-name">${fileName}</span>
                        <span class="file-status">${translations[currentLang].waiting}</span>
                    </div>
                </div>
                <div class="status-badge processing">${translations[currentLang].queueBadge}</div>
            `;
            fileList.appendChild(li);

            newFilesToProcess.push({ filePath, safeId });
        }

        // =====================================================================
        // CONCURRENCY POOL (Smart Processing Queue)
        // Instead of processing 100 files at the same time (which would explode RAM and API limits)
        // We create a "Pool" where we process a maximum of 3 files at a time simultaneously.
        // =====================================================================
        const maxConcurrent = 3;
        let index = 0;
        
        const processNext = async () => {
            if (index >= newFilesToProcess.length) return; // Finished everything
            const currentItem = newFilesToProcess[index++];
            
            // Process current file
            await processFileSequentially(currentItem.filePath, key, currentItem.safeId);
            
            // When finished, it automatically pulls the next file from the queue! Recursive loop.
            processNext();
        };

        // Start our "3 simultaneous workers"
        for (let i = 0; i < maxConcurrent; i++) {
            processNext();
        }
    });

    async function processFileSequentially(filePath, key, safeId) {
        const listItem = document.getElementById(safeId);
        const statusBadge = listItem.querySelector('.status-badge');
        statusBadge.textContent = translations[currentLang].processing;
        
        try {
            const result = await window.api.processAudio(filePath, key);
            if (!result.success) {
                const statusText = listItem.querySelector('.file-status');
                statusText.textContent = `Error: ${result.error}`;
                statusBadge.className = 'status-badge error';
                statusBadge.textContent = translations[currentLang].failed;
            }
        } catch (e) {
            const statusText = listItem.querySelector('.file-status');
            statusText.textContent = `Unexpected Error`;
            statusBadge.className = 'status-badge error';
            statusBadge.textContent = translations[currentLang].failed;
        }
    }

    // COMPARISON LOGIC
    const compareBtn = document.getElementById('compare-btn');
    const comparePanel = document.getElementById('compare-panel');
    const referenceSelect = document.getElementById('reference-select');
    const compareList = document.getElementById('compare-list');
    let embeddingsDB = {};

    // =====================================================================
    // COSINE SIMILARITY (Similaridade de Cosseno)
    // If we have two multidimensional vectors generated by AI, how do we know
    // how similar they are? We calculate the mathematical "angle" between them!
    // Result close to 1 = Extremely similar
    // Result close to 0 = Completely different
    // =====================================================================
    function cosineSimilarity(vecA, vecB) {
        let dotProduct = 0.0, normA = 0.0, normB = 0.0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i]; // Dot product multiplication
            normA += vecA[i] ** 2;         // Magnitude of A
            normB += vecB[i] ** 2;         // Magnitude of B
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    compareBtn.addEventListener('click', async () => {
        comparePanel.style.display = 'flex';
        
        // Fetch DB
        // We request the entire database (JSON) saved in the Backend
        embeddingsDB = await window.api.getDatabase();
        const files = Object.keys(embeddingsDB);
        
        if (files.length === 0) {
            alert(translations[currentLang].noSongs);
            return;
        }

        // Populate Select
        // Populates the select field (dropdown) with all available songs
        referenceSelect.innerHTML = `<option value="">${translations[currentLang].selectReference}</option>`;
        files.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            referenceSelect.appendChild(opt);
        });
        
        compareList.innerHTML = '<div class="empty-state">Now select a reference above to view the similarity ranking.</div>';
    });

    referenceSelect.addEventListener('change', () => {
        const refFile = referenceSelect.value;
        if (!refFile) return;

        // Gets the "digital fingerprint" (vector) of the selected song
        const refVector = embeddingsDB[refFile];
        const results = [];

        // Loop: Compares the selected song against ALL others in the database
        for (const [fName, vector] of Object.entries(embeddingsDB)) {
            if (fName === refFile) continue; // Ignores if it's the selected song itself
            
            // Calculate similarity score (closer to 1 = more similar)
            // This is where we call Cosine Similarity to give a similarity "Score"
            const score = cosineSimilarity(refVector, vector);
            results.push({ name: fName, score });
        }

        // Sort by highest score first
        // Sorts to display from most similar to least similar
        results.sort((a, b) => b.score - a.score);

        compareList.innerHTML = '';
        if (results.length === 0) {
            compareList.innerHTML = '<div class="empty-state">Only one song in the database, please add more!</div>';
            return;
        }

        // Visually creates the result list
        results.forEach(res => {
            const li = document.createElement('li');
            li.className = 'file-item';
            li.innerHTML = `
                <div class="file-info">
                    <div class="file-details">
                        <span class="file-name">${res.name}</span>
                        <span class="file-status">Similarity: ${(res.score * 100).toFixed(2)}%</span>
                    </div>
                </div>
                <div class="status-badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">
                    Top Rank
                </div>
            `;
            compareList.appendChild(li);
        });
    });
    // =====================================================================
    // 3D GRAPH LOGIC (Visualização com PCA e Plotly)
    // =====================================================================
    const visualize3DBtn = document.getElementById('visualize-3d-btn');
    const graphModal = document.getElementById('graph-modal');
    const closeGraphBtn = document.getElementById('close-graph-btn');

    visualize3DBtn.addEventListener('click', async () => {
        // Obter os vetores já reduzidos pelo backend usando a biblioteca PCA
        visualize3DBtn.innerHTML = `<span>Loading...</span>`;
        
        try {
            const reducedData = await window.api.get3DEmbeddings();
            const labels = Object.keys(reducedData);
            
            if (labels.length < 3) {
                alert("Please add at least 3 songs to generate a 3D graph.");
                visualize3DBtn.innerHTML = `<span>${translations[currentLang].btn3D}</span>`;
                return;
            }

            const x = [];
            const y = [];
            const z = [];
            const text = [];

            labels.forEach(label => {
                const vector = reducedData[label];
                x.push(vector[0]);
                y.push(vector[1]);
                z.push(vector[2]);
                text.push(label);
            });

            const trace = {
                x: x,
                y: y,
                z: z,
                text: text,
                mode: 'markers+text',
                type: 'scatter3d',
                marker: {
                    size: 8,
                    color: z, // Cores baseadas no eixo Z
                    colorscale: 'Viridis',
                    opacity: 0.8
                },
                textposition: 'top center',
                textfont: {
                    color: '#ffffff',
                    size: 10
                }
            };

            const layout = {
                margin: { l: 0, r: 0, b: 0, t: 0 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                autosize: true,
                scene: {
                    xaxis: { title: 'Component 1', backgroundcolor: "rgba(0,0,0,0)", gridcolor: "#444" },
                    yaxis: { title: 'Component 2', backgroundcolor: "rgba(0,0,0,0)", gridcolor: "#444" },
                    zaxis: { title: 'Component 3', backgroundcolor: "rgba(0,0,0,0)", gridcolor: "#444" },
                    camera: { eye: { x: 1.5, y: 1.5, z: 1.5 } }
                }
            };

            const config = { 
                responsive: true,
                displayModeBar: true,
                displaylogo: false
            };

            Plotly.newPlot('plot-container', [trace], layout, config);
            
            graphModal.style.display = 'flex';
            
            // Força o Plotly a recalcular o tamanho assim que o modal for exibido
            setTimeout(() => {
                Plotly.Plots.resize('plot-container');
            }, 100);
            
        } catch (error) {
            console.error(error);
            alert("Error generating 3D Graph.");
        } finally {
            visualize3DBtn.innerHTML = `
                <span data-i18n="btn3D">${translations[currentLang].btn3D}</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            `;
        }
    });

    closeGraphBtn.addEventListener('click', () => {
        graphModal.style.display = 'none';
    });});
