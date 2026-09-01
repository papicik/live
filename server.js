/**
 * ==============================================================================
 * EXPRESS SERVER & CONCURRENT DAEMON RUNNER (server.js)
 *
 * Serves frontend files from /public, exposes /api/books endpoint,
 * supports pausing and resuming via /api/pause & /api/resume,
 * and manages the perpetual 1-minute autonomous book generator.
 *
 * Models:
 *   - Text (Architect & Writer): gemini-3.1-flash-lite (high-quota, zero 429 delays)
 *   - Cover Art (Artist): imagen-3.0-generate-002 (with graceful local archive fallback)
 * ==============================================================================
 */

import dotenv from 'dotenv';
dotenv.config();

console.log("Gemini API Key Loaded:", process.env.GEMINI_API_KEY ? "YES (Key Present)" : "NO (Missing Key)");

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { executePipelineCycle, initAiClient, sanitizeTitle, getPipelineState } from './worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'books.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

/// Global boolean flags controlling automated book generation & concurrency lock
let isGenerating = true;
let isCurrentlyExecuting = false;

// Ensure data directory and data/books.json exist and initialize to [] if empty
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(DATA_FILE) || fs.readFileSync(DATA_FILE, 'utf-8').trim() === '') {
  fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

// Middlewares
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

/**
 * Helper to normalize book data consistency (ensuring chapters, content, and full_text)
 */
function normalizeBookRecord(book) {
  if (!book) return book;
  const chapters = Array.isArray(book.chapters)
    ? book.chapters
    : (Array.isArray(book.content) ? book.content : []);

  const full_text = book.full_text || (chapters.length > 0
    ? chapters.map(c => `${c.title || ''}\n\n${c.content || c.text || ''}`).join('\n\n---\n\n')
    : (typeof book.content === 'string' ? book.content : ''));

  return {
    ...book,
    title: sanitizeTitle(book.title),
    chapters,
    content: (typeof book.content === 'string' && book.content) ? book.content : full_text,
    full_text,
    reading_format: book.reading_format || "20-Page Complete Novella",
    pageCount: book.pageCount || 20
  };
}

/**
 * GET /api/books
 * Real-time endpoint queried by frontend listener every 4 seconds
 */
app.get('/api/books', (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data || '[]');
      const normalized = parsed.map(normalizeBookRecord);
      return res.json(normalized);
    }
    return res.json([]);
  } catch (err) {
    console.error("Read Error:", err.message);
    res.status(500).json({ error: "Failed to read library database" });
  }
});

/**
 * GET /data/books.json
 * Direct alias for data/books.json
 */
app.get('/data/books.json', (req, res) => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data || '[]');
      const normalized = parsed.map(normalizeBookRecord);
      return res.json(normalized);
    }
    return res.json([]);
  } catch (err) {
    console.error("Read Error:", err.message);
    res.status(500).json({ error: "Failed to read books data" });
  }
});

/**
 * POST /api/pause
 * Sets isGenerating = false and returns JSON
 */
app.post('/api/pause', (req, res) => {
  isGenerating = false;
  console.log('⏸ [API Control] Book generation has been PAUSED (isGenerating = false).');
  res.json({
    status: "paused",
    message: "Book generation paused."
  });
});

/**
 * POST /api/resume
 * Sets isGenerating = true and returns JSON
 */
app.post('/api/resume', (req, res) => {
  isGenerating = true;
  console.log('▶ [API Control] Book generation has been RESUMED (isGenerating = true).');
  res.json({
    status: "running",
    message: "Book generation resumed."
  });
});

/**
 * GET /api/status
 * Queries current generator state and API key status
 */
app.get('/api/status', (req, res) => {
  const pipe = (typeof getPipelineState === 'function') ? getPipelineState() : {};
  res.json({
    isGenerating,
    isCurrentlyExecuting: isCurrentlyExecuting || pipe.isGenerating || false,
    activeGenre: pipe.activeGenre || null,
    activeStep: pipe.step || 'idle',
    activeBookId: pipe.activeBookId || null,
    status: isGenerating ? "running" : "paused",
    geminiApiKeyConfigured: Boolean(process.env.GEMINI_API_KEY)
  });
});

/**
 * POST /api/generate
 * On-demand manual generation trigger with concurrency safety
 */
app.post('/api/generate', async (req, res) => {
  try {
    if (isCurrentlyExecuting) {
      return res.status(409).json({
        status: "in_progress",
        message: "A manuscript is currently being synthesized. Please wait for it to complete."
      });
    }

    const aiClient = await initAiClient();
    if (!aiClient) {
      console.error("AI Generation Error: Missing or unconfigured GEMINI_API_KEY in .env");
      return res.status(400).json({
        error: "GEMINI_API_KEY is not configured or invalid in .env",
        keyPresent: Boolean(process.env.GEMINI_API_KEY)
      });
    }

    console.log('📖 [Manual Trigger] Starting on-demand manuscript generation cycle...');
    isCurrentlyExecuting = true;
    executePipelineCycle(aiClient)
      .then(novel => {
        console.log(`✓ Manual archive addition complete: "${novel?.title}"`);
      })
      .catch(err => {
        console.error("Generation Error:", err.message);
      })
      .finally(() => {
        isCurrentlyExecuting = false;
      });

    res.json({ status: "triggered", message: "Novel generation cycle started (~20-page format)." });
  } catch (err) {
    isCurrentlyExecuting = false;
    console.error("Generation Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Fallback route: serve index.html for root navigation
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Launch server & autonomous 1-minute sequential generator loop
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`=============================================================`);
  console.log(`🏛 Grand Library Server & Literary Pipeline Online`);
  console.log(`   Web Interface: http://localhost:${PORT}`);
  console.log(`   Live Books API: http://localhost:${PORT}/api/books`);
  console.log(`   Pause Endpoint: POST http://localhost:${PORT}/api/pause`);
  console.log(`   Resume Endpoint: POST http://localhost:${PORT}/api/resume`);
  console.log(`   Manual Trigger: POST http://localhost:${PORT}/api/generate`);
  console.log(`   Autonomous Cadence: 1 Minute (60,000 ms) post-completion`);
  console.log(`=============================================================`);

  // Initialize AI client
  let aiClient = null;
  try {
    aiClient = await initAiClient();
  } catch (err) {
    console.error("Initialization Error:", err.message);
  }

  const ONE_MINUTE_MS = 60 * 1000; // 60,000 ms

  /**
   * Safe sequential loop: Runs cycle, waits for active book to finish completely,
   * then schedules the next run exactly 1 minute (60,000 ms) later.
   */
  async function runScheduledCycle() {
    if (!isGenerating) {
      console.log('⏸ [1-Minute Timer] Book generation is currently PAUSED. Will check in 1 minute.');
      setTimeout(runScheduledCycle, ONE_MINUTE_MS);
      return;
    }

    if (isCurrentlyExecuting) {
      console.log('⏳ [1-Minute Timer] Previous manuscript synthesis still in progress. Waiting for active book to finish before scheduling next...');
      setTimeout(runScheduledCycle, 15000); // Check back in 15 seconds until current book finishes
      return;
    }

    if (!aiClient) {
      try {
        aiClient = await initAiClient();
      } catch (err) {
        console.error("API Init Error:", err.message);
      }
    }

    if (!aiClient) {
      console.error("Generation Error: Scheduled cycle skipped - GEMINI_API_KEY is not configured.");
      setTimeout(runScheduledCycle, ONE_MINUTE_MS);
      return;
    }

    isCurrentlyExecuting = true;
    console.log('⏰ [1-Minute Timer] Initiating scheduled autonomous generation cycle...');
    try {
      await executePipelineCycle(aiClient);
      console.log(`✓ Novel completed & shelved. Scheduling next volume in 1 minute (60,000 ms)...`);
    } catch (err) {
      console.error("Generation Error during scheduled cycle:", err.message);
    } finally {
      isCurrentlyExecuting = false;
      // Start next cycle 1 minute after previous book successfully finishes saving
      setTimeout(runScheduledCycle, ONE_MINUTE_MS);
    }
  }

  // Kick off autonomous loop: initial run scheduled in 1 minute
  setTimeout(runScheduledCycle, ONE_MINUTE_MS);
});

// Process error immunity handlers (keeps server alive on API errors)
process.on('uncaughtException', (err) => {
  console.error('[Process Error] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process Error] Unhandled Rejection:', reason?.message || reason);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down library daemon gracefully.');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down library daemon gracefully.');
  server.close(() => process.exit(0));
});
