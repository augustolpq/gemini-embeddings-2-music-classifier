# Gemini Embeddings 2 Music Classifier 🎵🤖

Um aplicativo desktop construído com Electron.js que utiliza a API Gemini Embeddings 2 do Google para analisar, classificar e comparar o grau de similaridade musical (acústica, humor, ritmo) entre arquivos de áudio `.mp3` no seu computador.

## 🎯 Objetivo

O objetivo principal deste projeto é demonstrar como modelos de IA Embeddings (neste caso, o Gemini Embeddings 2) podem "ouvir" e "entender" arquivos multimídia. Ao transformar áudios complexos em matrizes matemáticas (Vetores de Embedding), podemos utilizar cálculos geométricos simples (como Similaridade de Cosseno) para encontrar músicas parecidas de forma rápida e eficiente.

## 🧠 Como Funciona a Mágica? (A Arquitetura)

O modelo Gemini possui limites de tamanho para o processamento de áudio. Para analisar músicas completas, criamos um sistema inteligente de **Mean Pooling (Média Matemática)**:

1. **Fatiamento Inteligente:** Usando `ffmpeg`, dividimos cada arquivo `.mp3` em pedaços (chunks) menores de 80 segundos de duração.
2. **Processamento em Fila (Pool):** O frontend controla uma fila assíncrona, enviando no máximo 3 chunks simultâneos para a API do Google para não sobrecarregar os limites da API.
3. **Extração de Vetores:** O Gemini "ouve" o chunk e devolve um vetor multidimensional que representa o humor, ritmo, batida e estilo daquele pedaço de música.
4. **Mean Pooling:** O Backend soma todos os vetores da música e tira a média aritmética deles. O resultado é um único vetor (uma impressão digital definitiva) que representa as qualidades globais de toda a música!
5. **Comparações de Cosseno:** Com essas "impressões digitais" salvas em um banco de dados local (`embeddings.json`), quando você deseja comparar qual música se parece mais com outra, o sistema não escuta elas de novo; ele apenas mede a distância e o ângulo (Cosine Similarity) entre as duas impressões digitais salvas para gerar um Score em %!

## 🚀 Como Rodar o Projeto Pela Primeira Vez

### Pré-requisitos
Antes de começar, você precisa ter as seguintes ferramentas instaladas no seu computador:
- **Node.js** (e o gerenciador de pacotes npm)
- Uma **Chave de API do Gemini** (Gemini API Key) válida.

*Nota: Você **não** precisa instalar o FFmpeg manualmente no seu sistema operacional, o projeto já baixa binários pré-compilados como dependência do NPM.*

### Passo a Passo da Instalação

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/augustolpq/gemini-embeddings-2-music-classifier.git
   cd gemini-embeddings-2-music-classifier
   ```

2. **Instale as dependências do projeto:**
   Isso fará o download do Electron, bibliotecas do Google AI e os binários embutidos do FFmpeg.
   ```bash
   npm install
   ```

3. **Inicie a Aplicação:**
   ```bash
   npm start
   ```

4. **Começando a usar:**
   - Na tela inicial do app, cole a sua **Chave de API do Gemini** no campo indicado e clique em "Salvar".
   - Clique em "Procurar arquivos .mp3" e selecione algumas músicas.
   - O sistema irá fatiar, enviar, gerar os vetores e limpar tudo automaticamente de forma segura.
   - Assim que o processamento terminar, clique no botão para "Lançar a IA", selecione a música de referência e veja o ranking de similaridade em tempo real!

## 📦 Bibliotecas Principais

- `electron`: Framework para criação da interface Desktop.
- `@google/genai`: SDK Oficial para a interação com a IA do Gemini.
- `fluent-ffmpeg`: Biblioteca ponte para manipular arquivos de mídia via node.
- `@ffmpeg-installer/ffmpeg` e `@ffprobe-installer/ffprobe`: Binários "standalone" que fazem o corte dos áudios funcionarem out-of-the-box, sem configurações complexas para o usuário final.

---
Feito de forma didática para explorar o limite entre a música e a IA! 🎸
