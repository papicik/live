/**
 * ==============================================================================
 * HYBRID MULTI-AGENT NOVEL & ART PRODUCTION PIPELINE (worker.js)
 *
 * Multi-Agent System:
 *   - Architect Agent: gemini-3.5-flash (Primary) with automatic fallback chain (gemini-3.1-flash-lite, gemini-3.6-flash)
 *     Designs dynamic 5-6 focused chapters (~5,000 - 6,000 words, ~20 pages format)
 *   - Writer Agent: gemini-3.5-flash (Primary) with automatic fallback chain (gemini-3.1-flash-lite, gemini-3.6-flash)
 *     Iterative drafting with continuous narrative memory, smart 429 backoff & mandatory 2500ms rate-limit pause
 *   - Artist Agent: imagen-3.0-generate-002 saving physical JPEGs to /public/covers/cover_{bookId}.jpg
 *   - Autonomous Loop: 1-minute interval (60,000 ms) post-completion sequential loop
 *   - Complete removal of synthetic tags and model badges
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, 'data', 'books.json');
const ROOT_BOOKS_FILE = path.join(__dirname, 'books.json');
const COVERS_DIR = path.join(__dirname, 'public', 'covers');

// Supported Model Architecture with Cascading Fallback Chain
export const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash'
];
export const TEXT_MODEL = CANDIDATE_MODELS[0];
export const ARCHITECT_MODEL = TEXT_MODEL;
export const WRITER_MODEL = TEXT_MODEL;
export const IMAGEN_MODEL = 'imagen-3.0-generate-002';

// Canonical Literary Genres
const GENRES = [
  'Sci-Fi & Cyberpunk',
  'Fantasy & Mythos',
  'Mystery & Noir',
  'Romance & Drama',
  'Philosophy & Synthetic Lore',
  'Thriller & Horror'
];

// Ensure required directories exist
if (!fs.existsSync(path.dirname(DATA_FILE))) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}
if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

/**
 * Exponential backoff retry utility for API calls with smart 429 rate limit backoff
 */
async function retryWithBackoff(fn, maxRetries = 2, initialDelayMs = 1500) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err) {
      if (err.message && (
        err.message.includes('API_KEY_INVALID') || 
        err.message.includes('API key not valid') || 
        err.message.includes('PERMISSION_DENIED') ||
        err.message.includes('not found') ||
        err.message.includes('404') ||
        err.message.includes('is no longer available') ||
        err.message.includes('not supported for generateContent')
      )) {
        throw err; // Fail-fast on authentication or unsupported model errors
      }

      attempt++;
      if (attempt >= maxRetries) throw err;

      // Extract recommended retry delay if provided by Google API, or default to 10s on 429
      let delay = initialDelayMs * Math.pow(2, attempt - 1);
      if (isRateLimitError(err)) {
        let retrySeconds = 10;
        const match = err.message.match(/retry in ([0-9.]+)s/i) || err.message.match(/retryDelay":"([0-9]+)s/i);
        if (match && match[1]) {
          retrySeconds = Math.min(60, Math.max(10, Math.ceil(parseFloat(match[1]))));
        }
        delay = retrySeconds * 1000;
        console.warn(`[Rate Limit Safeguard] 429 Quota encountered (Attempt ${attempt}/${maxRetries}). Backing off for ${retrySeconds}s...`);
      } else {
        console.warn(`[Retry Warning] Attempt ${attempt} failed: ${err.message}. Retrying in ${delay}ms...`);
      }

      await new Promise(res => setTimeout(res, delay));
    }
  }
}

/**
 * Robust Multi-Model Cascading Execution Engine
 * Tries models in sequence (gemini-3.5-flash-lite -> gemini-3.1-flash-lite -> gemini-3.6-flash -> gemini-3.5-flash)
 */
export async function generateContentWithFallback(aiClient, { contents, config = {}, systemInstruction }) {
  let lastError = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await retryWithBackoff(async () => {
        return await aiClient.models.generateContent({
          model: model,
          contents: contents,
          config: {
            ...config,
            ...(systemInstruction ? { systemInstruction } : {})
          }
        });
      }, 2, 1500);
      return { response, modelUsed: model };
    } catch (err) {
      lastError = err;
      console.warn(`  [Model Cascading] Model ${model} encountered notice: ${err.message}. Cascading to next candidate...`);
    }
  }
  throw lastError || new Error('All candidate models failed in fallback chain');
}

/**
 * Check if an error represents a 429 Rate Limit / Quota Exhaustion
 */
function isRateLimitError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const status = err.status || err.statusCode || '';
  return (
    status === 429 ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  );
}

/**
 * Helper to pause execution for RPM rate limiting
 */
function pauseMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * STEP 1: Genre Selection
 */
export function selectGenre() {
  const genre = GENRES[Math.floor(Math.random() * GENRES.length)];
  console.log(`\n[Step 1: Literary Curator] Selected Genre: "${genre}"`);
  return genre;
}

/**
 * Clean title sanitizer: Strips series, volume counts, and parenthetical edition tags
 */
export function sanitizeTitle(title) {
  if (!title) return '';
  return String(title)
    .replace(/\s*\(Vol\.\s*[\w\d]+\)/gi, '')
    .replace(/\s*Vol\.\s*[\w\d]+/gi, '')
    .replace(/\s*\(Volume\s*[\w\d]+\)/gi, '')
    .replace(/\s*Volume\s*[\w\d]+/gi, '')
    .replace(/\s*\(Vol\s*[\w\d]+\)/gi, '')
    .replace(/\s*Vol\s*[\w\d]+/gi, '')
    .trim();
}

/**
 * STEP 2: Novel Architecture & Outline via Architect Agent (Cypherpunk & Web3 Lore Master)
 * Model: Cascading chain across gemini-3.5-flash-lite / gemini-3.1-flash-lite / gemini-3.6-flash / gemini-3.5-flash
 * Target Scope: 5-6 focused chapters (~20 pages / ~5,000 - 6,000 words)
 */
export async function createNovelArchitecture(aiClient, genre) {
  console.log(`[Step 2: Architect Agent] Invoking Cypherpunk Blueprint Engine for "${genre}" Web3 novella (~20 pages format)...`);

  if (!aiClient) {
    const err = new Error("GEMINI_API_KEY is not configured or invalid in .env");
    console.error("Pipeline Error:", err.message);
    throw err;
  }

  const systemInstruction = `You are an elite cypherpunk novelist and Web3 lore master. You craft brilliant, high-stakes, ~20-page literary novellas (5 to 6 chapters, approx 5,000-6,000 words total) where EVERY plot, character motivation, existential conflict, and world-building element is fundamentally driven by Cryptocurrency mechanics, Blockchain architecture, Web3 culture, and On-Chain phenomena (smart contracts, multi-sig vaults, MEV bots, private key heists, DAO governance battles, zero-knowledge proofs, hard forks, liquidity crunches, and anon developer identities).

GENRE FUSION RULES (Strictly enforce these crypto-native thematic frameworks across all shelves):
- Sci-Fi & Cyberpunk: Autonomous AI agents running on-chain sovereign states, quantum cryptographic decryption wars, interstellar validator node networks, decentralized mesh computing, darkpool sub-grids, MEV algorithmic warfare.
- Romance & Drama: High-stakes love, secrets, and betrayal between rival protocol founders, trust dilemmas around multi-sig threshold approvals, the human and relational toll of catastrophic liquidation spirals, anonymous core developers wrestling with real-world identity versus on-chain reputation.
- Mystery & Noir: Hardboiled on-chain forensic investigations, tracking stolen flash-loan millions through obfuscated mixers, desperate races against block finality and front-running bots, air-gapped cold storage hardware heists, corrupt validator syndicates, dead-man's-switch smart contracts.
- Fantasy & Mythos: Cryptographic rituals, ancient genesis blocks worshipped as divine relics, gas-fee sacrificial altars, consensus algorithms functioning as sacred cosmic laws, immutable Merkle-tree grimoires, proof-of-work trials of ascendance.
- Philosophy & Synthetic Lore: Cypherpunk manifestos, the ontology and metaphysics of digital scarcity and sovereign ownership, decentralization versus state monopoly over truth, the ethics of algorithmic governance, existentialism in deterministic virtual machines.
- Thriller & Horror: Algorithmic financial contagion, malicious smart-contract soul-binding traps, haunted zero-knowledge circuits, predatory arbitrage entities lurking in the dark forest of the mempool, inaccessible cold wallets holding life-saving fortunes with dying keys, re-entrancy attack nightmares.`;

  const prompt = `Design an extraordinary, original, high-stakes Web3/Cypherpunk novella for the genre shelf "${genre}".

CRITICAL REQUIREMENT:
Regardless of the genre, the core premise, plot tension, character stakes, and world mechanics MUST strictly revolve around Cryptocurrency, Blockchain technology, Web3 lore, or On-Chain phenomena.

Target format: A complete 20-page literary novella spanning 5 to 6 tight, focused chapters (approx 5,000 to 6,000 words total).

Provide:
1. title: An evocative, original, standalone cypherpunk/crypto literary title (3-5 words). Absolutely NO volume numbers, editions, or series markers.
2. penName: A distinguished, authentic cypherpunk / literary author pen name (e.g. Satoshi-inspired alias, classic cypherpunk handle, or distinctive literary pseudonym).
3. theme: Core thematic conflict and existential stakes rooted in cryptography, decentralization, consensus mechanisms, game theory, or on-chain power struggles.
4. spineColorHex: A rich, dark hex code suitable for vintage leather/cloth binding with cyber accents (e.g. #0a1f1d, #141c2b, #1b1428, #2a111a, #132230, #18221b).
5. accentColorHex: A luminous metallic or neon accent hex code (e.g. #00ff88, #00f0ff, #dfba53, #f59e0b, #38bdf8, #a855f7).
6. synopsis: A gripping, dramatic back-cover synopsis of 140-180 words establishing the on-chain stakes, characters, setting, and crypto mechanics.
7. cover_art_prompt: A rich, cinematic 3-4 sentence visual description of the book's cover art combining the genre's aesthetic with clear crypto/blockchain symbolism (e.g., glowing cryptographic hashes, ledger matrices, cold storage hardware, vintage cypherpunk computer terminals, neon blockchain topography, digital coin relics, validator node monoliths). Reject plain or abstract geometric noise; produce cinematic digital art descriptions.
8. chapterOutlines: An array of exactly 5 or 6 distinct, sequential chapter objects:
   [
     { "chapterNumber": 1, "title": "Chapter I: ...", "narrativeFocus": "..." },
     ...
     { "chapterNumber": 6, "title": "Chapter VI: ...", "narrativeFocus": "..." }
   ]

Return strictly valid JSON conforming to the schema:
{
  "title": "...",
  "penName": "...",
  "theme": "...",
  "spineColorHex": "#...",
  "accentColorHex": "#...",
  "synopsis": "...",
  "cover_art_prompt": "...",
  "chapterOutlines": [
    { "chapterNumber": 1, "title": "...", "narrativeFocus": "..." }
  ]
}`;

  const COVER_DIRECTIVE = "Pure cinematic digital illustration artwork only, atmospheric composition with glowing cryptographic ledger and blockchain motifs, dramatic lighting, no text, no titles, no author names, no letters, no typography, clean poster background";

  console.log(`  [Architect Agent] Generating cypherpunk blueprint with cascading AI models...`);
  const { response, modelUsed } = await generateContentWithFallback(aiClient, {
    contents: prompt,
    config: {
      temperature: 1.0,
      responseMimeType: 'application/json'
    },
    systemInstruction: systemInstruction
  });

  const rawText = response.text;
  const data = JSON.parse(rawText);

  if (data && data.title && Array.isArray(data.chapterOutlines) && data.chapterOutlines.length >= 5) {
    data.title = sanitizeTitle(data.title);
    let baseCoverPrompt = data.cover_art_prompt || data.visualArtPrompt || `A masterpiece cypherpunk cover illustration for ${data.title} featuring glowing blockchain ledgers`;
    data.cover_art_prompt = `${baseCoverPrompt.trim()}. ${COVER_DIRECTIVE}`;
    console.log(`[Step 2: Architect Agent] Approved: "${data.title}" by ${data.penName} (${data.chapterOutlines.length} Chapters, ~20 Pages Scope) via ${modelUsed}`);
    return data;
  }
  throw new Error('Incomplete JSON schema returned by Architect model');
}

/**
 * STEP 3: Writer Agent - Iterative Chapter Generation (Cypherpunk & Web3 Lore)
 * Model: Cascading chain across gemini-3.5-flash-lite / gemini-3.1-flash-lite / gemini-3.6-flash / gemini-3.5-flash
 * Pacing: Tight, engaging narrative (~900 - 1,100 words per chapter)
 * Rate Limiting: Mandatory 2000ms pause between sequential chapter API calls
 */
export async function writeAllChapters(aiClient, architecture) {
  console.log(`[Step 3: Writer Agent] Initiating iterative crypto-narrative drafting for ${architecture.chapterOutlines.length} chapters (~20 pages scope)...`);

  if (!aiClient) {
    const err = new Error("GEMINI_API_KEY is not configured or invalid in .env");
    console.error("Pipeline Error:", err.message);
    throw err;
  }

  const systemInstruction = `You are an elite cypherpunk novelist and Web3 lore master. You write gripping, realistic, atmospheric literary fiction exploring the frontiers of cryptocurrency, blockchain mechanics, cryptography, and decentralized culture.
Your prose features immersive narrative dialogue, realistic blockchain terminology (mempool, consensus, gas, hash, slippage, liquidity, block finality, private key encryption, multi-sig, zero-knowledge proofs, MEV, flash loans), and vivid sensory worldbuilding without generic placeholder filler.`;

  const chapters = [];
  let narrativeMemory = `Novella Title: "${architecture.title}" (${architecture.genre}). Theme: ${architecture.theme}. Core Web3 Premise: ${architecture.synopsis}`;
  const totalChapters = architecture.chapterOutlines.length;

  for (let idx = 0; idx < totalChapters; idx++) {
    const outline = architecture.chapterOutlines[idx];

    // Strict 2000ms rate-limit pause between sequential chapter calls
    if (idx > 0) {
      console.log(`  ⏳ [Rate Limit Safeguard] Pausing 2000ms before Chapter ${outline.chapterNumber}...`);
      await pauseMs(2000);
    }

    console.log(`  [Writer Agent] Writing Chapter ${outline.chapterNumber}/${totalChapters}: "${outline.title}"...`);

    const chapterPrompt = `You are an accomplished cypherpunk literary author writing Chapter ${outline.chapterNumber} of the crypto/Web3 novella "${architecture.title}".
Genre Shelf: ${architecture.genre}
Author Pen Name: ${architecture.penName}
Core Theme & Lore: ${architecture.theme}
Chapter Title: "${outline.title}"
Chapter Narrative Focus: "${outline.narrativeFocus}"

PREVIOUS STORY CONTEXT & NARRATIVE CONTINUITY:
${narrativeMemory}

STRICT CRYPTO-LITERARY WRITING GUIDELINES:
- Deliver a tight, complete, and engaging narrative chapter driven by genuine crypto/blockchain concepts and human drama.
- Incorporate immersive narrative dialogue and realistic blockchain terminology (e.g., mempool, consensus, gas, hash, slippage, liquidity, block finality, private key encryption, multi-sig, zero-knowledge proofs, MEV, flash loans) naturally within the context of the story.
- Target approximately 900 to 1,100 words of rich, immersive literary prose (approx. 3-4 pages per chapter for a 20-page complete work).
- Strictly adhere to "Show, Don't Tell": ground scenes in concrete sensory details, tension, realistic technical stakes, and psychological depth.
- Maintain seamless narrative continuity with preceding chapters.
- Return ONLY the clean chapter prose text. Zero introductory notes, chapter number headers, or meta disclaimers.`;

    const { response, modelUsed } = await generateContentWithFallback(aiClient, {
      contents: chapterPrompt,
      config: {
        temperature: 0.95
      },
      systemInstruction: systemInstruction
    });

    const chapterText = response.text;
    if (chapterText && chapterText.trim().length > 250) {
      chapters.push({
        chapterNumber: outline.chapterNumber,
        title: outline.title,
        content: chapterText.trim()
      });

      // Update narrative memory for subsequent chapters
      const snippet = chapterText.trim().substring(0, 320).replace(/\n+/g, ' ') + '...';
      narrativeMemory += `\n- Chapter ${outline.chapterNumber} ("${outline.title}"): ${outline.narrativeFocus} [Key Progression: ${snippet}]`;

      console.log(`  ✓ Written ${outline.title} (~${chapterText.trim().split(/\s+/).length} words via ${modelUsed})`);
    } else {
      throw new Error(`Chapter ${outline.chapterNumber} output was empty or insufficient.`);
    }
  }

  console.log(`[Step 3: Writer Agent] Completed full cypherpunk manuscript (${chapters.length} Chapters, ~20 Pages total).`);
  return chapters;
}

/**
 * STEP 4: Artist Agent - Cover Artwork Generation (Crypto/Web3 Iconography)
 * Aspect ratio: 3:4 vertical portrait
 * Saves directly to /public/covers/cover_${bookId}.jpg
 */
export async function generateCoverArt(aiClient, architecture, bookId) {
  console.log(`[Step 4: Artist Agent] Synthesizing Cypherpunk Cover Artwork for "${architecture.title}"...`);

  const filename = `cover_${bookId}.jpg`;
  const localCoverPath = path.join(COVERS_DIR, filename);
  const publicCoverUrl = `/covers/${filename}`;

  let coverGenerated = false;

  // 1. Dynamic AI Artwork Generation via Pollinations AI
  try {
    let uniqueSeed = Date.now() + Math.floor(Math.random() * 999999);
    if (uniqueSeed > 2147483647) uniqueSeed = uniqueSeed % 2147483647;

    const cryptoMotifs = "glowing cryptographic hashes, ledger matrices, cold storage hardware, vintage cypherpunk computer terminals, neon blockchain topography, digital coin relics, validator node monoliths";
    const styleDirective = "cinematic digital art masterpiece, dark atmospheric illumination, rich textures, dramatic lighting, 8k resolution, award-winning illustration, no typography, no letters, no words, clean background";
    const bookContext = `${architecture.genre} crypto novella "${architecture.title}". ${architecture.synopsis || ''}. Visual motifs: ${architecture.cover_art_prompt || cryptoMotifs}`;
    const coverPrompt = `${bookContext}. ${styleDirective}`;
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(coverPrompt)}?width=768&height=1024&seed=${uniqueSeed}&nologo=true`;

    console.log(`  [Artist Agent] Fetching dynamic cypherpunk artwork from Pollinations AI (Seed: ${uniqueSeed})...`);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const res = await fetch(pollinationsUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
          }
        });
        clearTimeout(timeout);

        if (res.status === 200) {
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          if (buffer.length > 5000) {
            fs.writeFileSync(localCoverPath, buffer);
            console.log(`  ✓ Unique AI Cypherpunk Cover Artwork generated & saved: ${localCoverPath} (${buffer.length} bytes)`);
            coverGenerated = true;
            break;
          }
        }
        console.warn(`  [Artist Agent Notice] Pollinations attempt ${attempt} returned status ${res.status}. Retrying in 4s...`);
      } catch (reqErr) {
        console.warn(`  [Artist Agent Notice] Pollinations attempt ${attempt} failed: ${reqErr.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  } catch (err) {
    console.warn(`  [Artist Agent Warning] Pollinations AI pipeline encountered error: ${err.message}`);
  }

  // 2. Imagen 3 Secondary AI Fallback (if Pollinations AI queue is busy)
  if (!coverGenerated && aiClient) {
    try {
      console.log(`  [Artist Agent] Engaging Imagen 3 AI engine fallback (${IMAGEN_MODEL})...`);
      const COVER_DIRECTIVE = "Pure cinematic digital illustration artwork only, atmospheric composition with glowing cryptographic ledger and blockchain motifs, dramatic lighting, no text, no titles, no author names, no letters, no typography, clean poster background";
      const dynamicPrompt = architecture.cover_art_prompt || `A masterpiece fine art cypherpunk cover illustration for "${architecture.title}" in the genre ${architecture.genre}, featuring glowing blockchain networks and cryptographic artifacts.`;
      const fullPrompt = `${dynamicPrompt}, ${COVER_DIRECTIVE}`;

      try {
        const genContentResult = await aiClient.models.generateContent({
          model: IMAGEN_MODEL,
          contents: fullPrompt,
          config: {
            aspectRatio: '3:4',
            outputMimeType: 'image/jpeg'
          }
        });

        const parts = genContentResult.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const p of parts) {
            if (p.inlineData && p.inlineData.data) {
              fs.writeFileSync(localCoverPath, Buffer.from(p.inlineData.data, 'base64'));
              console.log(`  ✓ Imagen 3 cover artwork generated: ${localCoverPath}`);
              coverGenerated = true;
              break;
            }
          }
        }
      } catch (genErr) {
        const legacyResult = await aiClient.models.generateImages({
          model: IMAGEN_MODEL,
          prompt: fullPrompt,
          config: {
            numberOfImages: 1,
            aspectRatio: '3:4',
            outputMimeType: 'image/jpeg'
          }
        });

        if (legacyResult?.generatedImages?.[0]?.image?.imageBytes) {
          fs.writeFileSync(localCoverPath, Buffer.from(legacyResult.generatedImages[0].image.imageBytes, 'base64'));
          console.log(`  ✓ Imagen 3 legacy cover artwork generated: ${localCoverPath}`);
          coverGenerated = true;
        }
      }
    } catch (imagenErr) {
      console.warn(`  [Artist Agent Notice] Imagen fallback unavailable: ${imagenErr.message}`);
    }
  }

  // 3. Fallback to high quality dynamic procedural cover if network generation is blocked
  if (!coverGenerated && !fs.existsSync(localCoverPath)) {
    // If a previously generated cover exists or a fallback is needed, copy a default placeholder
    const existingCovers = fs.readdirSync(COVERS_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
    if (existingCovers.length > 0) {
      const randomExisting = path.join(COVERS_DIR, existingCovers[Math.floor(Math.random() * existingCovers.length)]);
      fs.copyFileSync(randomExisting, localCoverPath);
      console.log(`  ✓ Archived cover repurposed to ensure no missing asset: ${localCoverPath}`);
    }
  }

  return publicCoverUrl;
}

/**
 * STEP 5: Atomic Database Append to data/books.json and root books.json
 */
export function atomicAppendBook(bookRecord) {
  bookRecord.title = sanitizeTitle(bookRecord.title);
  console.log(`[Step 5: Cataloging Agent] Archiving "${bookRecord.title}" into library database...`);

  let currentCatalog = [];
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      currentCatalog = JSON.parse(content || '[]').map(b => ({
        ...b,
        title: sanitizeTitle(b.title)
      }));
    }
  } catch (err) {
    currentCatalog = [];
  }

  // Prepend newest volume
  currentCatalog.unshift(bookRecord);

  // Write atomically using temporary file to prevent corruption
  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(currentCatalog, null, 2), 'utf-8');
  fs.renameSync(tempFile, DATA_FILE);

  // Keep root books.json in sync for immediate availability
  try {
    fs.writeFileSync(ROOT_BOOKS_FILE, JSON.stringify(currentCatalog, null, 2), 'utf-8');
  } catch (syncErr) {
    // Non-fatal
  }

  console.log(`[Step 5: Cataloging Agent] Archive updated! Total volumes in collection: ${currentCatalog.length}`);
}

export let pipelineState = {
  isGenerating: false,
  activeGenre: null,
  activeBookId: null,
  step: 'idle',
  startedAt: null
};

export function getPipelineState() {
  return pipelineState;
}

/**
 * Master Execution Cycle
 */
export async function executePipelineCycle(aiClient) {
  const timestamp = new Date().toISOString();
  console.log(`\n=============================================================`);
  console.log(`📚 Production Pipeline Cycle Initiated at ${timestamp}`);
  console.log(`=============================================================`);

  try {
    if (!aiClient) {
      throw new Error("Pipeline aborted: Gemini API Key is missing or invalid in .env");
    }

    // Step 1: Literary Genre
    const genre = selectGenre();
    pipelineState.isGenerating = true;
    pipelineState.activeGenre = genre;
    pipelineState.activeBookId = null;
    pipelineState.step = 'architecture';
    pipelineState.startedAt = Date.now();

    // Step 2: Architecture (5-6 chapters, ~20 pages) with Architect Agent
    const arch = await createNovelArchitecture(aiClient, genre);
    arch.genre = genre;
    arch.title = sanitizeTitle(arch.title);

    // Unique volume ID
    const bookId = `book-${Date.now()}`;
    pipelineState.activeBookId = bookId;

    // Step 3: Writer Agent - All Chapters with narrative memory & 2500ms delay
    pipelineState.step = 'writing';
    const chapters = await writeAllChapters(aiClient, arch);

    // Step 4: Artist Agent - Cover Art with imagen-3.0-generate-002
    pipelineState.step = 'cover';
    const coverUrl = await generateCoverArt(aiClient, arch, bookId);

    // Calculate approximate page count (~275 words per standard book page)
    const totalWords = chapters.reduce((sum, ch) => sum + (ch.content || '').split(/\s+/).length, 0);
    const estimatedPages = Math.max(18, Math.min(24, Math.round(totalWords / 275)));

    // Step 5: Final Record (Clean literary presentation, zero AI tags)
    const nowIso = new Date().toISOString();
    const fullText = chapters.map(c => `${c.title || ''}\n\n${c.content || ''}`).join('\n\n---\n\n');

    const novel = {
      id: bookId,
      genre: arch.genre,
      title: sanitizeTitle(arch.title),
      author: arch.penName,
      pageCount: estimatedPages || 20,
      spineColor: arch.spineColorHex || '#10261f',
      accentColor: arch.accentColorHex || '#dfba53',
      width: 24,
      height: 200,
      tilt: 0,
      coverUrl: coverUrl,
      cover_url: coverUrl,
      summary: arch.synopsis,
      reading_format: "20-Page Complete Novella",
      readingFormat: "20-Page Complete Novella",
      chapters: chapters,
      content: fullText,
      full_text: fullText,
      createdAt: nowIso,
      created_at: nowIso
    };

    atomicAppendBook(novel);
    console.log(`✨ Volume Completed: "${novel.title}" (${novel.chapters.length} Ch., ~${estimatedPages} Pages) shelved in "${novel.genre}".\n`);
    return novel;
  } catch (err) {
    console.error("Pipeline Error:", err.message);
    throw err;
  } finally {
    pipelineState.isGenerating = false;
    pipelineState.activeGenre = null;
    pipelineState.activeBookId = null;
    pipelineState.step = 'idle';
    pipelineState.startedAt = null;
  }
}

/**
 * AI Client Initializer
 */
export async function initAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    return null;
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const aiClient = new GoogleGenAI({ apiKey: apiKey.trim() });
    return aiClient;
  } catch (err) {
    console.error("API Initialization Error:", `Failed to initialize @google/genai client: ${err.message}`);
    return null;
  }
}

let isWorkerBusy = false;

/**
 * Autonomous Background Daemon Runner (1-minute cycle: 60,000 ms post-completion)
 */
export async function startPerpetualWorker() {
  console.log('🏛 Autonomous Novel Production Pipeline Initializing...');
  console.log('⏱ Interval: 1 Minute (60,000 ms) post-completion sequential loop.');

  const aiClient = await initAiClient();
  if (!aiClient) {
    console.error("Pipeline Error: Missing GEMINI_API_KEY in .env. Worker cannot run.");
    return;
  }

  const ONE_MINUTE_MS = 60 * 1000; // 60,000 ms

  async function scheduleNextCycle() {
    if (isWorkerBusy) {
      console.log('⏳ Previous book synthesis still in progress. Waiting for active book to finish before scheduling next...');
      setTimeout(scheduleNextCycle, 15000);
      return;
    }

    isWorkerBusy = true;
    try {
      await executePipelineCycle(aiClient);
      console.log(`✓ Novel completed & shelved. Scheduling next volume in 1 minute (60,000 ms)...`);
    } catch (err) {
      console.error("Pipeline Error during worker cycle:", err.message);
    } finally {
      isWorkerBusy = false;
      // Start next cycle 1 minute after previous book successfully finishes saving
      setTimeout(scheduleNextCycle, ONE_MINUTE_MS);
    }
  }

  // Initial execution immediately, followed by 1-minute intervals post-completion
  await scheduleNextCycle();
}

// Standalone terminal execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startPerpetualWorker().catch(err => {
    console.error("Pipeline Error:", err.message);
  });
}

