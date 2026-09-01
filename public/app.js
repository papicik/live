/**
 * ==============================================================================
 * AUTONOMOUS AI LIBRARY - MASTER CLIENT APPLICATION (PUBLIC/APP.JS)
 *
 * Core Features:
 *   1. Resilient Event Delegation: document-level click listener on .book-spine
 *   2. Strict data-book-id on every rendered spine element
 *   3. openBookDetails(bookId) with immediate modal container styling:
 *      display: flex; opacity: 1; pointer-events: auto; z-index: 9999;
 *   4. Smooth "Read Book" reader triggering without state resets
 *   5. Continuous Reader formatting with <br/><br/> in parchment container
 *   6. Title Sanitizer: Strips (Vol. XX) / Vol. XX across all views
 * ==============================================================================
 */

// Global State
window.allBooks = window.allBooks || [];
window.currentActiveBook = null;

// Clean Title Sanitizer
function sanitizeTitle(title) {
  if (!title) return "";
  return String(title)
    .replace(/\s*\(Vol\.\s*\d+\)/gi, '')
    .replace(/\s*Vol\.\s*\d+/gi, '')
    .replace(/\s*\(Volume\s*\d+\)/gi, '')
    .replace(/\s*Volume\s*\d+/gi, '')
    .trim();
}
window.sanitizeTitle = sanitizeTitle;

document.addEventListener('DOMContentLoaded', () => {

  const renderedBookIds = new Set();

  // Canonical Shelf IDs
  const genreShelfMap = {
    'Sci-Fi & Cyberpunk': 'shelf-scifi',
    'Fantasy & Mythos': 'shelf-fantasy',
    'Mystery & Noir': 'shelf-mystery',
    'Romance & Drama': 'shelf-romance',
    'Philosophy & Synthetic Lore': 'shelf-philosophy',
    'Thriller & Horror': 'shelf-thriller'
  };

  // DOM References
  const bookModalLayer = document.getElementById('bookModalLayer');
  const modalWindowCard = document.getElementById('modalWindowCard');
  const btnModalClose = document.getElementById('btnModalClose');
  const btnOverviewExit = document.getElementById('btnOverviewExit');
  const tabContinuousReader = document.getElementById('tab-continuous-reader');
  const tabBookOverview = document.getElementById('tab-book-overview');

  // ----------------------------------------------------------------------------
  // 1. DYNAMIC BOOK SPINE RENDERING WITH STRICT data-book-id
  // ----------------------------------------------------------------------------
  function createBookSpineElement(book, isAnimated = false) {
    if (!book || !book.id) return null;

    book.title = sanitizeTitle(book.title);
    const bookIdStr = String(book.id);

    // Sync into global state
    const existingIdx = window.allBooks.findIndex(b => String(b.id) === bookIdStr);
    if (existingIdx === -1) {
      window.allBooks.push(book);
    } else {
      window.allBooks[existingIdx] = book;
    }

    const shelfId = genreShelfMap[book.genre] || 'shelf-scifi';
    const track = document.getElementById(shelfId);
    if (!track) return null;

    let spine = track.querySelector(`[data-book-id="${bookIdStr}"]`) || 
                track.querySelector(`[data-id="${bookIdStr}"]`) || 
                document.getElementById(`spine-${book.id}`);

    if (!spine) {
      spine = document.createElement('div');
      spine.id = `spine-${book.id}`;
      track.appendChild(spine);
    }

    // Standard classes and attributes
    spine.className = 'book-spine';
    spine.setAttribute('data-book-id', bookIdStr);
    spine.setAttribute('data-id', bookIdStr);
    spine.dataset.bookId = bookIdStr;
    spine.dataset.id = bookIdStr;
    spine.style.cursor = 'pointer';
    spine.style.pointerEvents = 'auto';
    spine.style.position = 'relative';
    spine.style.zIndex = '10';
    spine.style.transform = 'rotate(0deg)';
    spine.style.backgroundColor = book.spineColor || '#142a22';
    spine.setAttribute('title', `${book.title} — ${book.author} (${book.genre})`);

    const isGold = (book.accentColor && (book.accentColor.includes('f') || book.accentColor.includes('e'))) || Math.random() > 0.4;
    const titleClass = isGold ? 'spine-title-text gold-foil' : 'spine-title-text silver-foil';

    const titleLen = (book.title || '').length;
    let fontSize = '0.62rem';
    if (titleLen > 28) fontSize = '0.52rem';
    else if (titleLen > 20) fontSize = '0.56rem';
    else if (titleLen > 14) fontSize = '0.59rem';

    // Pure spine styling: embossed title and foil bands, zero AI glyphs
    spine.innerHTML = `
      <div class="spine-rib-band"></div>
      <div class="spine-title-wrapper">
        <span class="${titleClass}" style="font-size: ${fontSize};">${escapeHtml(book.title || 'Untitled')}</span>
      </div>
      <div class="spine-rib-band"></div>
    `;

    if (isAnimated) {
      spine.classList.add('anim-slide-in');
    }

    // Direct click fallback on element
    spine.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log('Spine clicked directly:', book.id);
      openBookDetails(book.id);
    };

    return spine;
  }

  // Aliases for compatibility
  window.createBookSpineElement = createBookSpineElement;
  window.renderBookSpine = createBookSpineElement;

  // ----------------------------------------------------------------------------
  // 2. RESILIENT EVENT DELEGATION (CRITICAL FIX)
  // Catches any click on .book-spine anywhere on the page
  // ----------------------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const spine = e.target.closest('.book-spine');
    if (spine) {
      const bookId = spine.dataset.bookId || spine.getAttribute('data-id') || spine.getAttribute('data-book-id');
      console.log('Spine clicked via Event Delegation:', bookId);
      openBookDetails(bookId);
    }
  });

  // ----------------------------------------------------------------------------
  // 3. MODAL DISPLAY & DETAILS INJECTION
  // Immediately sets modal container to display: flex; opacity: 1; pointer-events: auto; z-index: 9999;
  // ----------------------------------------------------------------------------
  function openBookDetails(bookId) {
    if (!bookId) return;

    let targetBook = (window.allBooks || []).find(b => String(b.id) === String(bookId));

    if (!targetBook) {
      console.warn('Book ID not found in cache, re-fetching from catalog...', bookId);
      fetch('/api/books')
        .then(r => r.json())
        .then(books => {
          window.allBooks = Array.isArray(books) ? books : [];
          targetBook = window.allBooks.find(b => String(b.id) === String(bookId));
          if (targetBook) {
            renderAndShowModal(targetBook);
          }
        })
        .catch(err => console.error('Error fetching book on demand:', err));
      return;
    }

    renderAndShowModal(targetBook);
  }

  function renderAndShowModal(book) {
    if (!book) return;
    book.title = sanitizeTitle(book.title);
    window.currentActiveBook = book;

    // Header bar
    const headerGenre = document.getElementById('modalHeaderGenre');
    const headerTitle = document.getElementById('modalHeaderTitle');
    if (headerGenre) headerGenre.textContent = book.genre || 'Autonomous Literature';
    if (headerTitle) headerTitle.textContent = book.title || 'Untitled';

    // Pure Clean Cover Artwork Canvas with Cache-Busting Query Parameter
    const cardArt = document.getElementById('cardArtCover');
    if (cardArt) {
      const rawCoverUrl = book.cover_url || book.coverUrl || '';
      const versionTag = book.created_at || book.createdAt || Date.now();
      const cacheBustedUrl = rawCoverUrl
        ? (rawCoverUrl.includes('?') ? `${rawCoverUrl}&v=${encodeURIComponent(versionTag)}` : `${rawCoverUrl}?v=${encodeURIComponent(versionTag)}`)
        : '';

      if (cardArt.tagName === 'IMG') {
        cardArt.src = cacheBustedUrl;
        cardArt.style.display = cacheBustedUrl ? 'block' : 'none';
      } else {
        if (cacheBustedUrl) {
          cardArt.style.backgroundImage = `url('${cacheBustedUrl}')`;
          cardArt.style.backgroundColor = 'transparent';
        } else {
          cardArt.style.backgroundImage = 'none';
          cardArt.style.background = `linear-gradient(135deg, ${book.spineColor || '#0e261f'} 0%, #030a07 100%)`;
        }
      }
    }

    // Specifications Panel
    const detailGenre = document.getElementById('detailGenreBadge');
    const detailTitle = document.getElementById('detailBookTitle');
    const detailAuthor = document.getElementById('detailAuthorName');
    const detailChapters = document.getElementById('detailChapterCount');
    const detailReadTime = document.getElementById('detailReadTime');
    const tabChapterCount = document.getElementById('tabChapterCount');
    const detailSynopsis = document.getElementById('detailSynopsis');

    const chCount = (book.chapters && book.chapters.length) || 6;
    const pageEst = book.pageCount || 20;

    // Calculate reading time based on ~250 WPM (for ~5,500 words = ~22 mins)
    const totalWords = (book.chapters || []).reduce((acc, c) => acc + (c.content || '').split(/\s+/).length, 0) || (pageEst * 275);
    const readMinutes = Math.max(15, Math.round(totalWords / 250));

    if (detailGenre) detailGenre.textContent = book.genre || 'Literature';
    if (detailTitle) detailTitle.textContent = book.title || '';
    if (detailAuthor) detailAuthor.textContent = book.author || '';
    if (detailChapters) detailChapters.textContent = `${chCount} Chapters (~${pageEst} Pages)`;
    if (detailReadTime) detailReadTime.textContent = `~${readMinutes} Mins`;
    if (tabChapterCount) tabChapterCount.textContent = chCount;
    if (detailSynopsis) detailSynopsis.textContent = book.summary || 'Manuscript archive description loading...';

    // Default to Overview View
    showOverviewView();

    // CRITICAL: Immediately set modal container styles
    const modal = document.getElementById('bookModalLayer');
    if (modal) {
      modal.style.display = 'flex';
      modal.style.opacity = '1';
      modal.style.pointerEvents = 'auto';
      modal.style.zIndex = '9999';
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  window.openBookDetails = openBookDetails;
  window.openBookModal = (bookOrId) => {
    if (typeof bookOrId === 'object' && bookOrId !== null) {
      renderAndShowModal(bookOrId);
    } else {
      openBookDetails(bookOrId);
    }
  };

  function closeBookModal() {
    const modal = document.getElementById('bookModalLayer');
    if (modal) {
      modal.style.display = 'none';
      modal.style.opacity = '0';
      modal.style.pointerEvents = 'none';
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }
  }
  window.closeBookModal = closeBookModal;

  // ----------------------------------------------------------------------------
  // 4. CONTINUOUS READER & MODAL VIEW SWITCHING
  // ----------------------------------------------------------------------------
  // ----------------------------------------------------------------------------
  // 4. CONTINUOUS READER & MODAL VIEW SWITCHING
  // ----------------------------------------------------------------------------
  function showReaderView(book) {
    const targetBook = book || window.currentActiveBook;
    if (!targetBook) {
      console.warn('showReaderView called with no active book');
      return;
    }

    targetBook.title = sanitizeTitle(targetBook.title);
    window.currentActiveBook = targetBook;

    // Ensure modal layer is open and active
    const modal = document.getElementById('bookModalLayer');
    if (modal) {
      modal.style.display = 'flex';
      modal.style.opacity = '1';
      modal.style.pointerEvents = 'auto';
      modal.style.zIndex = '9999';
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
    }

    const overviewEl = document.getElementById('modal-overview-view') || document.querySelector('.overview-section');
    const readerEl = document.getElementById('modal-reader-view') || document.getElementById('readerView') || document.querySelector('.reader-section');

    if (overviewEl) {
      overviewEl.style.display = 'none';
      overviewEl.classList.remove('active');
      overviewEl.classList.add('hidden');
    }

    if (readerEl) {
      readerEl.style.display = 'block';
      readerEl.classList.add('active');
      readerEl.classList.remove('hidden');
      readerEl.scrollTop = 0;
    }

    // Scroll viewport to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabContinuousReader) {
      tabContinuousReader.classList.add('active');
      tabContinuousReader.setAttribute('aria-selected', 'true');
    }
    if (tabBookOverview) {
      tabBookOverview.classList.remove('active');
      tabBookOverview.setAttribute('aria-selected', 'false');
    }

    renderFullManuscript(targetBook);
  }
  window.showReaderView = showReaderView;

  function showOverviewView() {
    const overviewEl = document.getElementById('modal-overview-view') || document.querySelector('.overview-section');
    const readerEl = document.getElementById('modal-reader-view') || document.getElementById('readerView') || document.querySelector('.reader-section');

    if (overviewEl) {
      overviewEl.style.display = 'flex';
      overviewEl.classList.add('active');
      overviewEl.classList.remove('hidden');
    }

    if (readerEl) {
      readerEl.style.display = 'none';
      readerEl.classList.remove('active');
      readerEl.classList.add('hidden');
    }

    if (tabBookOverview) {
      tabBookOverview.classList.add('active');
      tabBookOverview.setAttribute('aria-selected', 'true');
    }
    if (tabContinuousReader) {
      tabContinuousReader.classList.remove('active');
      tabContinuousReader.setAttribute('aria-selected', 'false');
    }
  }
  window.showOverviewView = showOverviewView;

  /**
   * Continuous Manuscript Renderer with dynamic chapter/content parsing & empty state safeguard
   */
  function renderFullManuscript(book) {
    const targetBook = book || window.currentActiveBook;
    if (!targetBook) return;

    targetBook.title = sanitizeTitle(targetBook.title);

    const readerEl = document.getElementById('modal-reader-view') || document.getElementById('readerView') || document.querySelector('.reader-section');
    if (!readerEl) return;

    // 1. Resolve chapters dynamically across multiple schema variations
    let chapters = [];
    if (Array.isArray(targetBook.chapters) && targetBook.chapters.length > 0) {
      chapters = targetBook.chapters;
    } else if (Array.isArray(targetBook.content) && targetBook.content.length > 0) {
      chapters = targetBook.content;
    } else if (typeof targetBook.content === 'string' && targetBook.content.trim().length > 0) {
      // Parse chapters from full_text / content string separated by "Chapter " or "---"
      const chunks = targetBook.content.split(/(?=(?:Chapter\s+[IVXLCDM\d]+|---\s*Chapter))/i);
      chapters = chunks.map((chunk, idx) => {
        const lines = chunk.replace(/^---\s*/, '').trim().split('\n');
        const heading = lines[0] || `Chapter ${idx + 1}`;
        const body = lines.slice(1).join('\n').trim();
        return {
          chapterNumber: idx + 1,
          title: heading.replace(/^#+\s*/, ''),
          content: body || heading
        };
      });
    } else if (typeof targetBook.full_text === 'string' && targetBook.full_text.trim().length > 0) {
      const chunks = targetBook.full_text.split(/(?=(?:Chapter\s+[IVXLCDM\d]+|---\s*Chapter))/i);
      chapters = chunks.map((chunk, idx) => {
        const lines = chunk.replace(/^---\s*/, '').trim().split('\n');
        const heading = lines[0] || `Chapter ${idx + 1}`;
        const body = lines.slice(1).join('\n').trim();
        return {
          chapterNumber: idx + 1,
          title: heading.replace(/^#+\s*/, ''),
          content: body || heading
        };
      });
    }

    const pageCount = targetBook.pageCount || 20;

    // 2. Empty State Safeguard: Manuscript actively synthesizing / pending
    if (!chapters || chapters.length === 0 || chapters.every(c => !(c.content || c.text || '').trim())) {
      readerEl.innerHTML = `
        <div class="reader-container" id="readerContainer">
          <header class="reader-header-block">
            <div class="reader-edition-tag">Archive Manuscript • Status: Transcribing</div>
            <h1 class="reader-title">${escapeHtml(targetBook.title)}</h1>
            <div class="reader-author">Penned by ${escapeHtml(targetBook.author)}</div>
            <div class="reader-genre-line">${escapeHtml(targetBook.genre)}</div>
            <hr class="reader-divider" />
          </header>
          <div class="reader-loading-state" style="text-align: center; padding: 60px 20px;">
            <div class="scribe-quill-pulse" style="font-size: 38px; margin-bottom: 16px; animation: bounce 1.8s infinite;">✍️</div>
            <h3 style="font-family: var(--font-serif); color: #dfba53; font-size: 1.4rem; margin-bottom: 10px;">Manuscript in Synthesis</h3>
            <p style="color: #a09789; font-size: 0.95rem; max-width: 480px; margin: 0 auto; line-height: 1.6;">
              The scribes are currently transcribing and compiling this complete novella edition into the archive. Please allow a few moments for the ink to cure.
            </p>
            <div style="margin-top: 30px;">
              <button class="btn-secondary-shelf btn-close-reader" onclick="window.closeBookModal()" style="border-color: #dfba53; color: #dfba53; padding: 8px 20px;">
                Return to Shelf
              </button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // 3. Render full continuous manuscript
    readerEl.innerHTML = `
      <div class="reader-container" id="readerContainer">
        <header class="reader-header-block">
          <div class="reader-edition-tag">Complete Novella Edition • ~${pageCount} Pages</div>
          <h1 class="reader-title">${escapeHtml(targetBook.title)}</h1>
          <div class="reader-author">Penned by ${escapeHtml(targetBook.author)}</div>
          <div class="reader-genre-line">${escapeHtml(targetBook.genre)}</div>
          <hr class="reader-divider" />
        </header>
        <div class="chapters-content">
          ${chapters.map((ch, i) => {
            const rawContent = ch.content || ch.text || '';
            const formattedContent = escapeHtml(rawContent)
              .split(/\n\n+/)
              .map(p => p.trim())
              .filter(p => p.length > 0)
              .join('<br/><br/>');

            const startPage = Math.max(1, Math.round((i / chapters.length) * pageCount) + 1);
            const endPage = Math.min(pageCount, Math.round(((i + 1) / chapters.length) * pageCount));

            return `
              <article class="chapter-block">
                <div class="chapter-page-meta">Pages ${startPage}–${endPage} of ~${pageCount}</div>
                <h2>${escapeHtml(ch.title || 'Chapter ' + (ch.chapterNumber || (i + 1)))}</h2>
                <div class="chapter-content">${formattedContent}</div>
              </article>
            `;
          }).join('')}
        </div>
        <footer class="reader-colophon">
          <div class="colophon-mark">❦</div>
          <div class="colophon-text">End of Manuscript • Archived in The Grand Athenaeum</div>
          <div style="margin-top: 24px; display: flex; justify-content: center;">
            <div class="uiverse-btn-wrapper">
              <button class="uiverse-btn btn-secondary-shelf btn-close-reader" onclick="window.closeBookModal()" title="Back to Shelf">
                <div class="uiverse-btn-inner">
                  <div class="uiverse-btn-content">
                    <span class="cta-label">Back to Shelf</span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </footer>
      </div>
    `;

    readerEl.scrollTop = 0;

    // Reset and attach scroll listener to update readingProgressBar
    const progressBar = document.getElementById('readingProgressBar');
    if (progressBar) {
      progressBar.style.width = '0%';
    }

    readerEl.onscroll = () => {
      if (!progressBar) return;
      const scrollTotal = readerEl.scrollHeight - readerEl.clientHeight;
      if (scrollTotal > 0) {
        const pct = Math.min(100, Math.max(0, (readerEl.scrollTop / scrollTotal) * 100));
        progressBar.style.width = `${pct}%`;
      }
    };
  }
  window.renderFullManuscript = renderFullManuscript;

  // ----------------------------------------------------------------------------
  // 5. CLIENT-SIDE PDF GENERATOR ENGINE (via jsPDF)
  // ----------------------------------------------------------------------------
  function loadBase64Image(url) {
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          resolve(dataUrl);
        } catch (err) {
          console.warn('Canvas conversion notice:', err);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
  window.loadBase64Image = loadBase64Image;

  /**
   * Universal Client-Side PDF Generator with Cover Page, Chapter Formatting & Pagination
   */
  async function downloadBookAsPdf(book) {
    const targetBook = book || window.currentActiveBook;
    if (!targetBook) {
      alert("Please select a book from the shelf to download.");
      return;
    }

    // Resolve jsPDF constructor
    let jsPdfConstructor = null;
    if (window.jspdf && window.jspdf.jsPDF) {
      jsPdfConstructor = window.jspdf.jsPDF;
    } else if (window.jsPDF) {
      jsPdfConstructor = window.jsPDF;
    }

    if (!jsPdfConstructor) {
      alert("PDF generation engine is currently loading. Please try again in a moment.");
      return;
    }

    const title = sanitizeTitle(targetBook.title) || 'Untitled Manuscript';
    const author = targetBook.author || 'Anonymous';
    const genre = targetBook.genre || 'Literature';
    const rawCoverUrl = targetBook.coverUrl || targetBook.cover_url || targetBook.cover || '';

    // Provide immediate visual feedback on buttons
    const buttons = document.querySelectorAll('.btn-download-pdf, #btnDownloadPdf, .btn-download-pdf-top, #btnDownloadPdfTop');
    buttons.forEach(btn => {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.innerHTML = '<div class="uiverse-btn-inner"><div class="uiverse-btn-content"><span class="cta-label">Preparing PDF...</span></div></div>';
      btn.disabled = true;
    });

    try {
      const doc = new jsPdfConstructor({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
      const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2); // 170mm

      // ==========================================
      // PAGE 1: COVER PAGE
      // ==========================================
      // Dark emerald luxury background
      doc.setFillColor(10, 24, 18);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Double gold foil ornamental border
      doc.setDrawColor(223, 186, 83);
      doc.setLineWidth(0.8);
      doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
      doc.setLineWidth(0.3);
      doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

      // Genre Tag
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(223, 186, 83);
      doc.text(genre.toUpperCase(), pageWidth / 2, 28, { align: 'center' });

      // Embed Cover Image if available
      let imageLoaded = false;
      if (rawCoverUrl) {
        try {
          const imgData = await loadBase64Image(rawCoverUrl);
          if (imgData) {
            const imgWidth = 90;
            const imgHeight = 120;
            const imgX = (pageWidth - imgWidth) / 2;
            const imgY = 36;
            doc.addImage(imgData, 'JPEG', imgX, imgY, imgWidth, imgHeight);
            imageLoaded = true;
          }
        } catch (imgErr) {
          console.warn("Cover image not embedded:", imgErr);
        }
      }

      // Title on Cover
      const titleY = imageLoaded ? 172 : 110;
      doc.setFont("times", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      const titleLines = doc.splitTextToSize(title, contentWidth);
      doc.text(titleLines, pageWidth / 2, titleY, { align: 'center' });

      // Gold divider line
      const dividerY = titleY + (titleLines.length * 8) + 4;
      doc.setDrawColor(223, 186, 83);
      doc.setLineWidth(0.5);
      doc.line(pageWidth / 2 - 25, dividerY, pageWidth / 2 + 25, dividerY);

      // Author
      doc.setFont("times", "italic");
      doc.setFontSize(13);
      doc.setTextColor(225, 218, 205);
      doc.text(`Penned by ${author}`, pageWidth / 2, dividerY + 10, { align: 'center' });

      // Colophon Footer
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(160, 151, 137);
      doc.text("COMPLETE NOVELLA EDITION • THE GRAND ATHENAEUM", pageWidth / 2, pageHeight - 20, { align: 'center' });

      // ==========================================
      // CHAPTERS & CONTENT PAGES
      // ==========================================
      let chapters = [];
      if (Array.isArray(targetBook.chapters) && targetBook.chapters.length > 0) {
        chapters = targetBook.chapters;
      } else if (Array.isArray(targetBook.content) && targetBook.content.length > 0) {
        chapters = targetBook.content;
      } else if (typeof targetBook.content === 'string' && targetBook.content.trim().length > 0) {
        const chunks = targetBook.content.split(/(?=(?:Chapter\s+[IVXLCDM\d]+|---\s*Chapter))/i);
        chapters = chunks.map((chunk, idx) => {
          const lines = chunk.replace(/^---\s*/, '').trim().split('\n');
          return {
            chapterNumber: idx + 1,
            title: (lines[0] || `Chapter ${idx + 1}`).replace(/^#+\s*/, ''),
            content: lines.slice(1).join('\n').trim()
          };
        });
      } else if (typeof targetBook.full_text === 'string' && targetBook.full_text.trim().length > 0) {
        const chunks = targetBook.full_text.split(/(?=(?:Chapter\s+[IVXLCDM\d]+|---\s*Chapter))/i);
        chapters = chunks.map((chunk, idx) => {
          const lines = chunk.replace(/^---\s*/, '').trim().split('\n');
          return {
            chapterNumber: idx + 1,
            title: (lines[0] || `Chapter ${idx + 1}`).replace(/^#+\s*/, ''),
            content: lines.slice(1).join('\n').trim()
          };
        });
      }

      if (chapters.length === 0) {
        chapters = [{
          chapterNumber: 1,
          title: "Chapter I",
          content: targetBook.summary || "Full manuscript text is being compiled in the archive."
        }];
      }

      for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
        const ch = chapters[cIdx];
        const chTitle = ch.title || `Chapter ${ch.chapterNumber || (cIdx + 1)}`;
        const chContent = ch.content || ch.text || '';

        doc.addPage();
        let currentY = margin + 10;

        // Chapter Header Label
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(180, 140, 50); // Gold accent
        doc.text(`CHAPTER ${ch.chapterNumber || (cIdx + 1)}`, margin, currentY);
        currentY += 7;

        // Chapter Title
        doc.setFont("times", "bold");
        doc.setFontSize(16);
        doc.setTextColor(24, 28, 24); // Dark ink
        const chTitleLines = doc.splitTextToSize(chTitle, contentWidth);
        doc.text(chTitleLines, margin, currentY);
        currentY += (chTitleLines.length * 7) + 3;

        // Decorative Chapter Divider
        doc.setDrawColor(210, 200, 185);
        doc.setLineWidth(0.3);
        doc.line(margin, currentY, margin + contentWidth, currentY);
        currentY += 8;

        // Chapter Paragraphs
        doc.setFont("times", "normal");
        doc.setFontSize(11);
        doc.setTextColor(40, 44, 40); // Deep charcoal prose

        const paragraphs = chContent.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);

        for (const p of paragraphs) {
          const lines = doc.splitTextToSize(p, contentWidth);
          const pHeight = lines.length * 5.8;

          if (currentY + pHeight > pageHeight - margin - 12) {
            doc.addPage();
            currentY = margin + 10;
          }

          doc.text(lines, margin, currentY, { lineHeightFactor: 1.35 });
          currentY += pHeight + 5;
        }
      }

      // ==========================================
      // RUNNING HEADERS & FOOTERS (Page 2..Total)
      // ==========================================
      const totalPages = doc.internal.getNumberOfPages();
      for (let pNum = 2; pNum <= totalPages; pNum++) {
        doc.setPage(pNum);

        // Header text & hairline
        doc.setFont("times", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(130, 125, 115);
        doc.text(`${title} • ${author}`, pageWidth / 2, 12, { align: 'center' });

        doc.setDrawColor(230, 225, 215);
        doc.setLineWidth(0.2);
        doc.line(margin, 15, pageWidth - margin, 15);

        // Footer text
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(140, 135, 125);
        doc.text(`Page ${pNum} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      // Filename formatting: [Book_Title] - [Author].pdf
      const safeTitle = title.replace(/[\/\\?%*:|"<>]/g, '').trim();
      const safeAuthor = author.replace(/[\/\\?%*:|"<>]/g, '').trim();
      const filename = `${safeTitle} - ${safeAuthor}.pdf`;

      doc.save(filename);
      console.log(`✓ PDF Generated & Downloaded: ${filename}`);

    } catch (err) {
      console.error("PDF Generation Error:", err);
      alert("An error occurred while generating the PDF. Please try again.");
    } finally {
      buttons.forEach(btn => {
        if (btn.dataset.originalHtml) {
          btn.innerHTML = btn.dataset.originalHtml;
        }
        btn.disabled = false;
      });
    }
  }
  window.downloadBookAsPdf = downloadBookAsPdf;

  // ----------------------------------------------------------------------------
  // 6. EVENT LISTENERS: READ BOOK, PDF DOWNLOAD, TABS & CLOSE
  // ----------------------------------------------------------------------------
  const readBookBtn = document.getElementById('readBookBtn');
  if (readBookBtn) {
    readBookBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log('Read Book button directly clicked for:', window.currentActiveBook?.title);
      showReaderView(window.currentActiveBook);
    });
  }

  const btnDownloadPdf = document.getElementById('btnDownloadPdf');
  if (btnDownloadPdf) {
    btnDownloadPdf.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      downloadBookAsPdf(window.currentActiveBook);
    });
  }

  const btnDownloadPdfTop = document.getElementById('btnDownloadPdfTop');
  if (btnDownloadPdfTop) {
    btnDownloadPdfTop.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      downloadBookAsPdf(window.currentActiveBook);
    });
  }

  document.addEventListener('click', (e) => {
    // PDF Download Buttons
    const pdfBtn = e.target.closest('#btnDownloadPdf, .btn-download-pdf, #btnDownloadPdfTop, .btn-download-pdf-top');
    if (pdfBtn) {
      e.stopPropagation();
      e.preventDefault();
      downloadBookAsPdf(window.currentActiveBook);
      return;
    }

    // Read Book Buttons
    const readBtn = e.target.closest('#readBookBtn, .read-full-btn, #btn-read-manuscript, .btn-read-book, #btn-read-book, .btn-primary-read');
    if (readBtn) {
      e.stopPropagation();
      e.preventDefault();
      console.log('Read Book triggered via document for:', window.currentActiveBook?.title);
      showReaderView(window.currentActiveBook);
      return;
    }

    // Close Reader / Back to Shelf Buttons
    const closeBtn = e.target.closest('.btn-modal-close, #btnModalClose, .btn-secondary-shelf, #btnOverviewExit, .btn-close-reader');
    if (closeBtn) {
      e.stopPropagation();
      e.preventDefault();
      closeBookModal();
      return;
    }
  });

  if (tabContinuousReader) {
    tabContinuousReader.addEventListener('click', (e) => {
      e.stopPropagation();
      showReaderView(window.currentActiveBook);
    });
  }

  if (tabBookOverview) {
    tabBookOverview.addEventListener('click', (e) => {
      e.stopPropagation();
      showOverviewView();
    });
  }

  if (btnModalClose) {
    btnModalClose.addEventListener('click', closeBookModal);
  }

  if (btnOverviewExit) {
    btnOverviewExit.addEventListener('click', closeBookModal);
  }

  if (modalWindowCard) {
    modalWindowCard.addEventListener('click', (e) => {
      // Check if user clicked a PDF download button inside modalWindowCard
      const pdfBtn = e.target.closest('#btnDownloadPdf, .btn-download-pdf, #btnDownloadPdfTop, .btn-download-pdf-top');
      if (pdfBtn) {
        e.stopPropagation();
        e.preventDefault();
        downloadBookAsPdf(window.currentActiveBook);
        return;
      }

      // Check if user clicked a Read Book button inside modalWindowCard
      const readBtn = e.target.closest('#readBookBtn, .read-full-btn, #btn-read-manuscript, .btn-read-book, #btn-read-book, .btn-primary-read');
      if (readBtn) {
        e.stopPropagation();
        e.preventDefault();
        console.log('Read Book triggered via modalWindowCard listener for:', window.currentActiveBook?.title);
        showReaderView(window.currentActiveBook);
        return;
      }

      // Check if user clicked a Close / Back to Shelf button inside modalWindowCard
      const closeBtn = e.target.closest('.btn-modal-close, #btnModalClose, .btn-secondary-shelf, #btnOverviewExit, .btn-close-reader');
      if (closeBtn) {
        e.stopPropagation();
        e.preventDefault();
        closeBookModal();
        return;
      }

      // Stop propagation to backdrop so clicking inside card does not close modal
      e.stopPropagation();
    });
  }

  if (bookModalLayer) {
    bookModalLayer.addEventListener('click', (e) => {
      if (e.target === bookModalLayer) closeBookModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && bookModalLayer && bookModalLayer.classList.contains('active')) {
      closeBookModal();
    }
  });

  // ----------------------------------------------------------------------------
  // 6. REAL-TIME CATALOG POLLING & SYNC
  // ----------------------------------------------------------------------------
  async function pollLibraryCatalog() {
    try {
      let res = await fetch('/api/books');
      if (!res.ok) res = await fetch('./data/books.json');
      if (!res.ok) return;

      const books = await res.json();
      window.allBooks = Array.isArray(books) ? books : [];

      if (window.allBooks.length === 0) {
        renderedBookIds.clear();
        Object.values(genreShelfMap).forEach(shelfId => {
          const track = document.getElementById(shelfId);
          if (track) track.innerHTML = '';
        });
        return;
      }

      syncShelvesWithCatalog(window.allBooks);
    } catch (err) {
      // Graceful fallback
    }
  }

  function syncShelvesWithCatalog(books) {
    if (!Array.isArray(books)) return;

    const activeIds = new Set(books.map(b => String(b.id)));
    for (const id of renderedBookIds) {
      if (!activeIds.has(String(id))) {
        renderedBookIds.delete(id);
        const spineEl = document.querySelector(`[data-book-id="${id}"]`) || document.querySelector(`[data-id="${id}"]`) || document.getElementById(`spine-${id}`);
        if (spineEl) spineEl.remove();
      }
    }

    books.forEach((book, index) => {
      const bookIdStr = String(book.id);
      if (!renderedBookIds.has(bookIdStr)) {
        renderedBookIds.add(bookIdStr);
        const isFreshArrival = renderedBookIds.size > 1 && index === 0;
        createBookSpineElement(book, isFreshArrival);

        if (isFreshArrival) {
          showArrivalToast(book);
        }
      }
    });
  }

  function showArrivalToast(book) {
    book.title = sanitizeTitle(book.title);
    const stack = document.getElementById('toastStack');
    if (!stack) return;

    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.innerHTML = `
      <span class="toast-glyph">✨</span>
      <div class="toast-text-block">
        <div class="toast-headline">New Volume Shelved into Archive</div>
        <div class="toast-subline">"${escapeHtml(book.title)}" • ${escapeHtml(book.genre)}</div>
      </div>
    `;

    stack.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('exit');
      setTimeout(() => toast.remove(), 350);
    }, 4500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial Poll and 4-second Polling Loop
  pollLibraryCatalog();
  setInterval(pollLibraryCatalog, 4000);

  // ----------------------------------------------------------------------------
  // 7. CLOCKRING SHELF GENERATION INDICATOR & STATUS SYNC
  // Positioned at the exact center of the generating shelf with zero layout displacement
  // ----------------------------------------------------------------------------
  function ensureShelfLoaders() {
    Object.entries(genreShelfMap).forEach(([genre, shelfId]) => {
      const track = document.getElementById(shelfId);
      if (!track) return;
      const cavity = track.closest('.shelf-cavity') || track.parentElement;
      if (!cavity) return;

      let loader = cavity.querySelector(`.shelf-loading-overlay[data-genre="${genre}"]`) ||
                   document.getElementById(`loader-${shelfId}`);
      if (!loader) {
        loader = document.createElement('div');
        loader.className = 'shelf-loading-overlay';
        loader.id = `loader-${shelfId}`;
        loader.setAttribute('data-genre', genre);
        loader.innerHTML = `
          <div class="shelf-loading-circle">
            <span role="status" class="clock-ring" style="--duration: 1.5s;">
              <span aria-hidden="true" class="clock-ring-hand"></span>
              <span class="sr-only">Loading</span>
            </span>
          </div>
        `;
        cavity.appendChild(loader);
      }
    });
  }

  function setShelfLoading(genre, isLoading) {
    ensureShelfLoaders();
    const allLoaders = document.querySelectorAll('.shelf-loading-overlay');
    allLoaders.forEach(loader => {
      const g = loader.getAttribute('data-genre') || loader.dataset.genre;
      if (g === genre) {
        if (isLoading) {
          loader.classList.add('active');
        } else {
          loader.classList.remove('active');
        }
      }
    });
  }

  window.setShelfLoading = setShelfLoading;
  window.showShelfLoader = (genre) => setShelfLoading(genre, true);
  window.hideShelfLoader = (genre) => setShelfLoading(genre, false);

  async function pollGenerationStatus() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) return;
      const data = await res.json();

      const isExecuting = Boolean(data.isCurrentlyExecuting);
      const activeGenre = data.activeGenre;

      ensureShelfLoaders();
      const allLoaders = document.querySelectorAll('.shelf-loading-overlay');
      allLoaders.forEach(loader => {
        const g = loader.getAttribute('data-genre') || loader.dataset.genre;
        if (isExecuting && activeGenre && g === activeGenre) {
          loader.classList.add('active');
        } else {
          loader.classList.remove('active');
        }
      });
    } catch (err) {
      // Graceful fallback
    }
  }

  ensureShelfLoaders();
  pollGenerationStatus();
  setInterval(pollGenerationStatus, 2000);

  // ----------------------------------------------------------------------------
  // 8. CA (CONTRACT ADDRESS) CLIPBOARD COPY INTERACTION
  // ----------------------------------------------------------------------------
  const caBadge = document.getElementById('caBadge');
  const caAddressText = document.getElementById('caAddressText');
  const caCopiedTooltip = document.getElementById('caCopiedTooltip');

  if (caBadge && caAddressText) {
    caBadge.addEventListener('click', async () => {
      const address = caAddressText.textContent.trim();
      try {
        await navigator.clipboard.writeText(address);
      } catch (err) {
        // Fallback for non-HTTPS / older environments
        const textarea = document.createElement('textarea');
        textarea.value = address;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      if (caCopiedTooltip) {
        caCopiedTooltip.classList.add('visible');
        setTimeout(() => {
          caCopiedTooltip.classList.remove('visible');
        }, 2000);
      }
    });
  }

});


