// ═══════════════════════════════════════════════════════════
//  Browser Typo Workshop - Main Application
// ═══════════════════════════════════════════════════════════

// ── Glyph Registry ─────────────────────────────────────────
// Each glyph has: key (unique ID), label (display), chars (what it matches when typing), category
const GLYPHS = [
  // Uppercase A-Z
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(ch => ({
    key: `upper_${ch}`, label: ch, chars: ch, category: 'uppercase'
  })),
  // Lowercase a-z
  ...'abcdefghijklmnopqrstuvwxyz'.split('').map(ch => ({
    key: `lower_${ch}`, label: ch, chars: ch, category: 'lowercase'
  })),
  // Numbers 0-9
  ...'0123456789'.split('').map(ch => ({
    key: `num_${ch}`, label: ch, chars: ch, category: 'numbers'
  })),
  // Symbols
  { key: 'paren_l',   label: '(',  chars: '(',  category: 'symbols' },
  { key: 'paren_r',   label: ')',  chars: ')',  category: 'symbols' },
  { key: 'comma',     label: ',',  chars: ',',  category: 'symbols' },
  { key: 'period',    label: '.',  chars: '.',  category: 'symbols' },
  { key: 'angle_l',   label: '<',  chars: '<',  category: 'symbols' },
  { key: 'angle_r',   label: '>',  chars: '>',  category: 'symbols' },
  { key: 'question',  label: '?',  chars: '?',  category: 'symbols' },
  { key: 'exclaim',   label: '!',  chars: '!',  category: 'symbols' },
  { key: 'ampersand', label: '&',  chars: '&',  category: 'symbols' },
  { key: 'percent',   label: '%',  chars: '%',  category: 'symbols' },
  { key: 'dollar',    label: '$',  chars: '$',  category: 'symbols' },
  { key: 'at',        label: '@',  chars: '@',  category: 'symbols' },
  { key: 'hash',      label: '#',  chars: '#',  category: 'symbols' },
  { key: 'caret',     label: '^',  chars: '^',  category: 'symbols' },
  { key: 'asterisk',  label: '*',  chars: '*',  category: 'symbols' },
  { key: 'plus',      label: '+',  chars: '+',  category: 'symbols' },
  { key: 'equals',    label: '=',  chars: '=',  category: 'symbols' },
  { key: 'tilde',     label: '~',  chars: '~',  category: 'symbols' },
  { key: 'won',       label: '₩',  chars: '₩',  category: 'symbols' },
  { key: 'slash',     label: '/',  chars: '/',  category: 'symbols' },
  { key: 'backslash', label: '\\', chars: '\\', category: 'symbols' },
  { key: 'pipe',      label: '|',  chars: '|',  category: 'symbols' },
  { key: 'pound',     label: '£',  chars: '£',  category: 'symbols' },
  { key: 'euro',      label: '€',  chars: '€',  category: 'symbols' },
  // Ligatures (multi-char)
  { key: 'lig_fl',    label: 'fl', chars: 'fl', category: 'ligatures' },
  { key: 'lig_ft',    label: 'ft', chars: 'ft', category: 'ligatures' },
  { key: 'lig_fi',    label: 'fi', chars: 'fi', category: 'ligatures' },
];

// Quick lookup maps
const glyphByKey = {};
const glyphByChars = {};
GLYPHS.forEach(g => {
  glyphByKey[g.key] = g;
  glyphByChars[g.chars] = g;
});

// Ligatures sorted longest-first for greedy matching
const LIGATURES = GLYPHS
  .filter(g => g.category === 'ligatures')
  .sort((a, b) => b.chars.length - a.chars.length);

// Store for each glyph: { paths: [...], width, height }
const fontData = {};

// Store original image blobs for download
const originalImages = {}; // key → { blob: Blob, ext: string }

// Typing state
let cursorX = 20;
let cursorY = 80;
let fontSize = 60;
// Bounds and one-press step for the typing canvas's default font size.
const FONT_SIZE_MIN = 20;
const FONT_SIZE_MAX = 120;
const FONT_SIZE_STEP = 4;
let fontColor = '#000000';
let ligaturesEnabled = true;
let typedChars = []; // { glyphKey, x, y, size, color, advance }
let caretIndex = 0;
let selectionStart = null;
let selectionEnd = null;

// One press of a Char size button grows/shrinks by this factor. Shared by
// the typing canvas and the round table so both feel the same.
const CHAR_SIZE_STEP = 1.08;

// ── Initialize ──────────────────────────────────────────────
// The script tag is injected by index.html, so this file can finish
// loading after DOMContentLoaded has already fired — in which case the
// event would never come and init() would never run.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  buildGrid('uppercase', 'gridUppercase');
  buildGrid('lowercase', 'gridLowercase');
  buildGrid('numbers', 'gridNumbers');
  buildGrid('symbols', 'gridSymbols');
  buildGrid('ligatures', 'gridLigatures');
  document.getElementById('totalGlyphs').textContent = GLYPHS.length;
  setupTypingCanvas();
  setupA4Canvas();
  setupPosterCanvas();
  setupRoundTable();
  setupControls();
}

// ── Build Drop Zones for a Category ────────────────────────
function buildGrid(category, containerId) {
  const grid = document.getElementById(containerId);

  GLYPHS.filter(g => g.category === category).forEach(glyph => {
    const zone = document.createElement('div');
    zone.className = 'drop-zone';
    zone.dataset.key = glyph.key;

    // Escape label for safe HTML
    const safeLabel = escapeHtml(glyph.label);

    zone.innerHTML = `
      <span class="letter-label">${safeLabel}</span>
      <span class="drop-hint">drop</span>
      <img class="preview-img" alt="${safeLabel}">
      <button class="remove-btn" title="Remove">&times;</button>
      <span class="vector-indicator">&#10003; vec</span>
      <div class="processing">Processing...</div>
      <input type="file" accept="image/*">
    `;

    zone.addEventListener('dragover', onDragOver);
    zone.addEventListener('dragleave', onDragLeave);
    zone.addEventListener('drop', e => onDrop(e, glyph.key));

    zone.addEventListener('click', e => {
      if (e.target.classList.contains('remove-btn')) return;
      zone.querySelector('input[type="file"]').click();
    });

    zone.querySelector('input[type="file"]').addEventListener('change', e => {
      if (e.target.files.length) handleFile(e.target.files[0], glyph.key);
    });

    zone.querySelector('.remove-btn').addEventListener('click', e => {
      e.stopPropagation();
      removeGlyph(glyph.key);
    });

    grid.appendChild(zone);
  });
}

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}

// ── Drag & Drop Handlers ───────────────────────────────────
function onDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onDrop(e, key) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    handleFile(file, key);
  }
}

// ── Process Uploaded Image ─────────────────────────────────
function handleFile(file, key) {
  const zone = document.querySelector(`.drop-zone[data-key="${key}"]`);

  // Store original image blob for later download
  const ext = file.name.split('.').pop().toLowerCase() || 'png';
  originalImages[key] = { blob: file, ext };

  const reader = new FileReader();

  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      zone.querySelector('.preview-img').src = e.target.result;
      zone.classList.add('has-image');

      zone.classList.add('is-processing');
      setTimeout(() => {
        vectorizeGlyph(key, img);
        zone.classList.remove('is-processing');
        zone.classList.add('has-vector');
        updateStatus();
        redrawTypingCanvas();
      }, 50);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── Remove Glyph ──────────────────────────────────────────
function removeGlyph(key) {
  const zone = document.querySelector(`.drop-zone[data-key="${key}"]`);
  zone.classList.remove('has-image', 'has-vector', 'is-processing');
  zone.querySelector('.preview-img').src = '';
  zone.querySelector('input[type="file"]').value = '';
  delete fontData[key];
  delete originalImages[key];
  updateStatus();
  redrawTypingCanvas();
}

// ── Update Status ──────────────────────────────────────────
function updateStatus() {
  const allKeys = Object.keys(fontData);
  document.getElementById('uploadCount').textContent = allKeys.length;

  // Per-category counts
  const cats = { uppercase: 0, lowercase: 0, numbers: 0, symbols: 0, ligatures: 0 };
  const totals = { uppercase: 0, lowercase: 0, numbers: 0, symbols: 0, ligatures: 0 };
  GLYPHS.forEach(g => {
    totals[g.category]++;
    if (fontData[g.key]) cats[g.category]++;
  });

  document.getElementById('uppercaseCount').textContent = `${cats.uppercase}/${totals.uppercase}`;
  document.getElementById('lowercaseCount').textContent = `${cats.lowercase}/${totals.lowercase}`;
  document.getElementById('numbersCount').textContent = `${cats.numbers}/${totals.numbers}`;
  document.getElementById('symbolsCount').textContent = `${cats.symbols}/${totals.symbols}`;
  document.getElementById('ligaturesCount').textContent = `${cats.ligatures}/${totals.ligatures}`;

  const placeholder = document.getElementById('typingPlaceholder');
  placeholder.classList.toggle('hidden', allKeys.length > 0);

  renderA4Canvas();
}

// ═══════════════════════════════════════════════════════════
//  VECTORIZATION ENGINE
// ═══════════════════════════════════════════════════════════

function vectorizeGlyph(key, img) {
  const canvas = document.createElement('canvas');
  const size = 200;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const scale = Math.min(size / img.width, size / img.height) * 0.9;
  const w = img.width * scale;
  const h = img.height * scale;
  const ox = (size - w) / 2;
  const oy = (size - h) / 2;
  ctx.drawImage(img, ox, oy, w, h);

  const imageData = ctx.getImageData(0, 0, size, size);
  const pixels = imageData.data;

  // ── Color-distance based segmentation ──
  // Sample background color from corners (more robust than grayscale)
  const bgColor = sampleBackgroundColor(pixels, size);

  // Compute color distance from background for every pixel
  const dist = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    // Euclidean distance in RGB space
    const dr = r - bgColor.r;
    const dg = g - bgColor.g;
    const db = b - bgColor.b;
    dist[i] = Math.sqrt(dr * dr + dg * dg + db * db);
  }

  // Normalize to 0-255 range for Otsu
  let maxDist = 0;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] > maxDist) maxDist = dist[i];
  }
  const gray = new Float32Array(size * size);
  if (maxDist > 0) {
    for (let i = 0; i < dist.length; i++) {
      gray[i] = (dist[i] / maxDist) * 255;
    }
  }

  // Otsu on the distance map — higher distance = more likely foreground
  const threshold = otsuThreshold(gray);
  const binaryRaw = new Uint8Array(size * size);
  for (let i = 0; i < size * size; i++) {
    binaryRaw[i] = gray[i] >= threshold ? 1 : 0;
  }

  // Seal hairline gaps in the letter outline (e.g. from translucent edges or
  // noise) so the flood fill can't leak through them into inner holes.
  // Raw binary is still used for letter body; closed is only for topology.
  const binaryClosed = morphologicalClose(binaryRaw, size, 4);

  // ── Flood-fill from borders to find definite background ──
  const reachable = new Uint8Array(size * size); // 1 = confirmed background
  const ffQueue = [];

  // Seed from all 4 borders (using closed version)
  for (let x = 0; x < size; x++) {
    if (!binaryClosed[x]) { reachable[x] = 1; ffQueue.push(x); }
    const bi = (size - 1) * size + x;
    if (!binaryClosed[bi]) { reachable[bi] = 1; ffQueue.push(bi); }
  }
  for (let y = 1; y < size - 1; y++) {
    const li = y * size;
    if (!binaryClosed[li]) { reachable[li] = 1; ffQueue.push(li); }
    const ri = y * size + (size - 1);
    if (!binaryClosed[ri]) { reachable[ri] = 1; ffQueue.push(ri); }
  }

  while (ffQueue.length > 0) {
    const idx = ffQueue.pop();
    const px = idx % size, py = (idx - px) / size;
    const neighbors = [
      py > 0 ? idx - size : -1,
      py < size - 1 ? idx + size : -1,
      px > 0 ? idx - 1 : -1,
      px < size - 1 ? idx + 1 : -1
    ];
    for (const ni of neighbors) {
      if (ni >= 0 && !reachable[ni] && !binaryClosed[ni]) {
        reachable[ni] = 1;
        ffQueue.push(ni);
      }
    }
  }

  // ── Separate inner holes from letter highlights ──
  // Among unreachable non-binaryRaw pixels:
  //   large connected region = hole (P, O, B counter) → keep as background
  //   small region = highlight inside letter body → fill as foreground
  const unreachedBg = new Uint8Array(size * size); // unreachable AND below threshold
  for (let i = 0; i < size * size; i++) {
    unreachedBg[i] = (!reachable[i] && !binaryRaw[i]) ? 1 : 0;
  }

  // Find connected components among unreachedBg pixels — track perimeter
  // alongside area so we can do shape-based hole classification later.
  const componentId = new Int32Array(size * size).fill(-1);
  const componentSizes = [];
  const componentPerims = [];
  let nextId = 0;

  for (let i = 0; i < size * size; i++) {
    if (unreachedBg[i] && componentId[i] === -1) {
      const id = nextId++;
      let area = 0;
      let perim = 0;
      const cQueue = [i];
      componentId[i] = id;

      while (cQueue.length > 0) {
        const ci = cQueue.pop();
        area++;
        const cx = ci % size, cy = (ci - cx) / size;
        const cNeighbors = [
          cy > 0 ? ci - size : -1,
          cy < size - 1 ? ci + size : -1,
          cx > 0 ? ci - 1 : -1,
          cx < size - 1 ? ci + 1 : -1
        ];
        for (const ni of cNeighbors) {
          if (ni < 0 || !unreachedBg[ni]) {
            // Boundary edge of the hole — touches ink (FG) or image edge
            perim++;
          } else if (componentId[ni] === -1) {
            componentId[ni] = id;
            cQueue.push(ni);
          }
        }
      }
      componentSizes.push(area);
      componentPerims.push(perim);
    }
  }

  // ── Hole-aware classification (mirror of the FG stroke-aware filter) ──
  // Big holes are definite counters (B, O, e, a) — keep regardless of
  // shape. Small holes are only kept if they're compact/round, the
  // signature of an intentional design element (e.g. the tiny ink rings
  // in the bubble-X glyph). Small but irregular/elongated gaps are
  // almost always paper noise or ink-fiber artifacts → fill back as FG.
  //
  //   shape ratio = perimeter² / area
  //     • perfect disk ≈ 4π ≈ 12.6
  //     • 3×3 square   = 16
  //     • thin gap     > 25
  const bigHoleArea     = size * size * 0.003;    // 0.3% — definite counter
  const minHoleArea     = size * size * 0.00005;  // 0.005% — absolute floor (~2 px @200²)
  const holeRoundCutoff = 22;                      // ratio ≤ 22 = compact

  const isHole = componentSizes.map((area, id) => {
    if (area >= bigHoleArea) return true;     // big counter, keep no matter what
    if (area < minHoleArea)  return false;    // tiny dust, fill back
    const perim = componentPerims[id];
    const ratio = (perim * perim) / area;
    return ratio <= holeRoundCutoff;          // compact small hole = intentional
  });

  // Final binary
  const binary = new Uint8Array(size * size);
  for (let i = 0; i < size * size; i++) {
    if (reachable[i]) {
      binary[i] = 0; // outer background
    } else if (binaryRaw[i]) {
      binary[i] = 1; // definite letter (high color distance)
    } else if (componentId[i] >= 0 && isHole[componentId[i]]) {
      binary[i] = 0; // inner hole (large bg-colored region inside letter)
    } else {
      binary[i] = 1; // small highlight inside letter → fill as letter
    }
  }

  // ── Stroke-aware noise filter ──
  // The previous filter dropped every FG connected component below 0.2%
  // of image area. That worked for clean filled glyphs but also killed
  // thin pen strokes (e.g. faint cursive L) once Otsu fragmented them
  // into short slivers. Here we look at the *shape* too:
  //
  //   shape ratio = perimeter² / area
  //     • compact disk  ≈ 4π ≈ 12.6
  //     • 3×3 square    = 16
  //     • 1px stroke    ≈ 4·length (climbs fast as the shape elongates)
  //
  // A small component that is clearly stroke-like (high ratio) is kept;
  // a small round/compact blob is treated as dust and dropped. Anything
  // above the area threshold passes as before, so behaviour on clean
  // glyphs like the bold D stays identical.
  const minComponentArea = size * size * 0.002;   // 0.2% — definitely a glyph element
  const minStrokeArea    = size * size * 0.0002;  // 0.02% — absolute floor; smaller is dust no matter what
  const strokeShapeRatio = 18;                     // perimeter²/area cutoff

  const fgComponentId = new Int32Array(size * size).fill(-1);
  const fgComponentSizes = [];
  const fgComponentPerims = [];
  let fgNextId = 0;
  for (let i = 0; i < size * size; i++) {
    if (binary[i] && fgComponentId[i] === -1) {
      const id = fgNextId++;
      let area = 0;
      let perim = 0;
      const fgQueue = [i];
      fgComponentId[i] = id;
      while (fgQueue.length > 0) {
        const ci = fgQueue.pop();
        area++;
        const cx = ci % size, cy = (ci - cx) / size;
        // 4-neighbors; out-of-image counts as background edge for the
        // perimeter so border-touching strokes aren't undercounted.
        const fgNb = [
          cy > 0 ? ci - size : -1,
          cy < size - 1 ? ci + size : -1,
          cx > 0 ? ci - 1 : -1,
          cx < size - 1 ? ci + 1 : -1
        ];
        for (const ni of fgNb) {
          if (ni < 0 || !binary[ni]) {
            perim++;
          } else if (fgComponentId[ni] === -1) {
            fgComponentId[ni] = id;
            fgQueue.push(ni);
          }
        }
      }
      fgComponentSizes.push(area);
      fgComponentPerims.push(perim);
    }
  }
  for (let i = 0; i < size * size; i++) {
    if (!binary[i]) continue;
    const id = fgComponentId[i];
    const area = fgComponentSizes[id];
    if (area >= minComponentArea) continue;        // big enough on its own
    if (area < minStrokeArea) { binary[i] = 0; continue; } // tiny — definite dust
    const perim = fgComponentPerims[id];
    const shape = (perim * perim) / area;
    if (shape < strokeShapeRatio) binary[i] = 0;    // small + compact = noise
    // else: small but elongated → likely a stroke fragment, keep it
  }

  // ── Bbox of the cleaned binary ──
  let minX = size, minY = size, maxX = -1, maxY = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (binary[y * size + x]) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    fontData[key] = { paths: [], width: 0.5, height: 1 };
    return;
  }

  // ── Marching-squares contour extraction ──
  // Produces closed loops where every endpoint is shared by exactly two
  // segments, so stitching is unambiguous and self-intersection-free.
  // Unlike Moore-Neighbor, it never accidentally jumps between an outer
  // edge and an inner-hole edge of the same component.
  const contours = extractContoursMarchingSquares(binary, size, size);

  // Closed-contour aware simplification. Naively running RDP on a loop
  // where first == last yields a degenerate split, so we first pick
  // two far-apart anchor points and simplify each half.
  const simplified = contours.map(c => simplifyClosedPath(c, 1.0));

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const normalized = simplified.map(path =>
    path.map(p => ({
      x: (p.x - minX) / bh,
      y: (p.y - minY) / bh
    }))
  ).filter(p => p.length > 2);

  fontData[key] = {
    paths: normalized,
    width: bw / bh,
    height: 1
  };
}

// ── Sample Background Color from Corners ───────────────────
function sampleBackgroundColor(pixels, size) {
  // Sample from corner regions (top-left, top-right, bottom-left, bottom-right)
  // Use a 10% margin from each corner
  const margin = Math.floor(size * 0.1);
  const samples = [];

  for (let y = 0; y < margin; y++) {
    for (let x = 0; x < margin; x++) {
      samples.push(y * size + x);                          // top-left
      samples.push(y * size + (size - 1 - x));             // top-right
      samples.push((size - 1 - y) * size + x);             // bottom-left
      samples.push((size - 1 - y) * size + (size - 1 - x)); // bottom-right
    }
  }

  // Average color of all corner samples
  let rSum = 0, gSum = 0, bSum = 0;
  for (const idx of samples) {
    rSum += pixels[idx * 4];
    gSum += pixels[idx * 4 + 1];
    bSum += pixels[idx * 4 + 2];
  }
  const n = samples.length;
  return {
    r: Math.round(rSum / n),
    g: Math.round(gSum / n),
    b: Math.round(bSum / n)
  };
}

// ── Morphological Operations ───────────────────────────────
function dilate(src, size) {
  const dst = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (src[idx]) { dst[idx] = 1; continue; }
      if (x > 0 && src[idx - 1]) { dst[idx] = 1; continue; }
      if (x < size - 1 && src[idx + 1]) { dst[idx] = 1; continue; }
      if (y > 0 && src[idx - size]) { dst[idx] = 1; continue; }
      if (y < size - 1 && src[idx + size]) { dst[idx] = 1; continue; }
    }
  }
  return dst;
}

function erode(src, size) {
  const dst = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (!src[idx]) continue;
      if (x > 0 && !src[idx - 1]) continue;
      if (x < size - 1 && !src[idx + 1]) continue;
      if (y > 0 && !src[idx - size]) continue;
      if (y < size - 1 && !src[idx + size]) continue;
      dst[idx] = 1;
    }
  }
  return dst;
}

function morphologicalClose(src, size, iterations) {
  let result = src;
  for (let i = 0; i < iterations; i++) result = dilate(result, size);
  for (let i = 0; i < iterations; i++) result = erode(result, size);
  return result;
}

// ── Otsu's Threshold ───────────────────────────────────────
function otsuThreshold(gray) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[Math.round(gray[i])]++;

  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];

  let sumBg = 0, wBg = 0, best = 0, bestT = 128;

  for (let t = 0; t < 256; t++) {
    wBg += hist[t];
    if (wBg === 0) continue;
    const wFg = total - wBg;
    if (wFg === 0) break;
    sumBg += t * hist[t];
    const mBg = sumBg / wBg;
    const mFg = (sumAll - sumBg) / wFg;
    const between = wBg * wFg * (mBg - mFg) * (mBg - mFg);
    if (between > best) { best = between; bestT = t; }
  }
  return bestT;
}

// ═══════════════════════════════════════════════════════════
//  MARCHING SQUARES — robust binary→contour conversion
// ═══════════════════════════════════════════════════════════
// For each 2×2 window of pixels we look at which corners are
// foreground. The 16 cases each define 0/1/2 line segments through
// the cell. Stitching consecutive segments by their shared midpoint
// endpoint produces closed contours with no risk of self-intersection
// or boundary-jumping that Moore-Neighbor tracing suffers from.
function extractContoursMarchingSquares(binary, w, h) {
  function pix(x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return binary[y * w + x];
  }

  // Each cell origin is at (cx, cy); we extend by 1 cell on each side
  // so that contours touching the image boundary still close.
  // Edge midpoints use half-integer coords so adjacent cells share keys.
  const segments = [];

  for (let cy = -1; cy < h; cy++) {
    for (let cx = -1; cx < w; cx++) {
      const tl = pix(cx,     cy);
      const tr = pix(cx + 1, cy);
      const br = pix(cx + 1, cy + 1);
      const bl = pix(cx,     cy + 1);
      const idx = tl + tr * 2 + br * 4 + bl * 8;
      if (idx === 0 || idx === 15) continue;

      const tm = { x: cx + 0.5, y: cy };
      const rm = { x: cx + 1,   y: cy + 0.5 };
      const bm = { x: cx + 0.5, y: cy + 1 };
      const lm = { x: cx,       y: cy + 0.5 };

      // Direction convention: walking from `from` to `to`, foreground
      // lies on the LEFT. This makes outer loops go counterclockwise
      // and inner-hole loops go clockwise — both close cleanly.
      switch (idx) {
        case 1:  segments.push({ from: tm, to: lm }); break; // TL
        case 2:  segments.push({ from: rm, to: tm }); break; // TR
        case 3:  segments.push({ from: rm, to: lm }); break; // top half
        case 4:  segments.push({ from: bm, to: rm }); break; // BR
        case 5:  // saddle: treat as two separate diagonals
          segments.push({ from: tm, to: lm });
          segments.push({ from: bm, to: rm });
          break;
        case 6:  segments.push({ from: bm, to: tm }); break; // right half
        case 7:  segments.push({ from: bm, to: lm }); break; // !BL
        case 8:  segments.push({ from: lm, to: bm }); break; // BL
        case 9:  segments.push({ from: tm, to: bm }); break; // left half
        case 10: // saddle
          segments.push({ from: rm, to: tm });
          segments.push({ from: lm, to: bm });
          break;
        case 11: segments.push({ from: rm, to: bm }); break; // !BR
        case 12: segments.push({ from: lm, to: rm }); break; // bottom half
        case 13: segments.push({ from: tm, to: rm }); break; // !TR
        case 14: segments.push({ from: lm, to: tm }); break; // !TL
      }
    }
  }

  // Stitch segments into closed loops.
  // Each midpoint endpoint appears in (typically) one segment-from and
  // one segment-to, so following `to → next from` is deterministic.
  const startsAt = new Map();
  for (let i = 0; i < segments.length; i++) {
    const k = segments[i].from.x + ',' + segments[i].from.y;
    if (!startsAt.has(k)) startsAt.set(k, []);
    startsAt.get(k).push(i);
  }

  const used = new Uint8Array(segments.length);
  const contours = [];

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;

    const loop = [];
    const startPt = segments[i].from;
    loop.push(startPt);
    let cur = segments[i].to;
    used[i] = 1;

    let safety = segments.length + 1;
    while (safety-- > 0) {
      if (cur.x === startPt.x && cur.y === startPt.y) break;
      loop.push(cur);
      const k = cur.x + ',' + cur.y;
      const candidates = startsAt.get(k);
      let nextIdx = -1;
      if (candidates) {
        for (const ci of candidates) {
          if (!used[ci]) { nextIdx = ci; break; }
        }
      }
      if (nextIdx === -1) break; // broken loop; bail
      used[nextIdx] = 1;
      cur = segments[nextIdx].to;
    }

    if (loop.length >= 3) contours.push(loop);
  }

  return contours;
}

// ── Closed-contour Ramer-Douglas-Peucker ───────────────────
// Standard RDP assumes an open polyline. Closed loops where first ≈
// last would collapse: the line from first to last has length 0, so
// every interior point is "far enough" only relative to the start
// point, producing a degenerate split. Fix: pick the point farthest
// from the start as a second anchor, then simplify both halves.
function simplifyClosedPath(points, tolerance) {
  if (points.length <= 3) return points.slice();

  // Find the point farthest from points[0]
  let farIdx = 0, farDist = 0;
  const p0 = points[0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - p0.x, dy = points[i].y - p0.y;
    const d = dx * dx + dy * dy;
    if (d > farDist) { farDist = d; farIdx = i; }
  }
  if (farIdx === 0) return [p0];

  const firstHalf = points.slice(0, farIdx + 1);
  const secondHalf = points.slice(farIdx).concat([p0]);
  const a = simplifyOpenPath(firstHalf, tolerance);
  const b = simplifyOpenPath(secondHalf, tolerance);
  // Join, dropping the duplicated anchor & the loop-closing duplicate
  return a.slice(0, -1).concat(b.slice(0, -1));
}

function simplifyOpenPath(points, tolerance) {
  if (points.length <= 2) return points.slice();
  let maxDist = 0, maxIdx = 0;
  const first = points[0], last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToLineDist(points[i], first, last);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > tolerance) {
    const left = simplifyOpenPath(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyOpenPath(points.slice(maxIdx), tolerance);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

// ── Contour Extraction (outer edges + inner holes) ─────────
// `outside` is a Uint8Array marking pixels that are topology-outside the
// letter (reachable from the canvas border via the closed-binary flood fill).
// It is used to separate outer-boundary from inner-hole boundary pixels so
// we can trace each exactly once.
function extractContours(binary, w, h, outside) {
  const visited = new Uint8Array(w * h);
  const contours = [];

  // 1) Trace OUTER contours only: filled pixels whose bg neighbor is
  //    the actual outside (not an inner hole). Using isOuterEdge as the
  //    start condition prevents us from starting a trace on an inner-hole
  //    boundary (which is handled separately in pass 2).
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (binary[idx] && !visited[idx] && isOuterEdge(binary, x, y, w, h, outside)) {
        const contour = traceContour(binary, visited, x, y, w, h);
        if (contour.length > 4) contours.push(contour);
      }
    }
  }

  // 2) Trace inner-hole boundaries. A hole is a bg pixel not marked outside.
  const holeVisited = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (!binary[idx] && !outside[idx] && !holeVisited[idx]) {
        const holeBoundary = traceHoleBoundary(binary, holeVisited, x, y, w, h);
        if (holeBoundary.length > 4) contours.push(holeBoundary);
      }
    }
  }

  return contours;
}

function isEdge(binary, x, y, w, h) {
  if (!binary[y * w + x]) return false;
  if (x > 0 && !binary[y * w + (x - 1)]) return true;
  if (x < w - 1 && !binary[y * w + (x + 1)]) return true;
  if (y > 0 && !binary[(y - 1) * w + x]) return true;
  if (y < h - 1 && !binary[(y + 1) * w + x]) return true;
  return false;
}

function isOuterEdge(binary, x, y, w, h, outside) {
  if (!binary[y * w + x]) return false;
  if (x > 0 && outside[y * w + (x - 1)]) return true;
  if (x < w - 1 && outside[y * w + (x + 1)]) return true;
  if (y > 0 && outside[(y - 1) * w + x]) return true;
  if (y < h - 1 && outside[(y + 1) * w + x]) return true;
  return false;
}

function traceContour(binary, visited, startX, startY, w, h) {
  const path = [];
  const dirs = [
    { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 1 },
    { dx: -1, dy: 0 }, { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 }
  ];

  let x = startX, y = startY, dir = 0, steps = 0;
  const maxSteps = w * h;

  do {
    path.push({ x, y });
    visited[y * w + x] = 1;

    let found = false;
    const startDir = (dir + 5) % 8;

    for (let i = 0; i < 8; i++) {
      const d = (startDir + i) % 8;
      const nx = x + dirs[d].dx;
      const ny = y + dirs[d].dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h &&
          binary[ny * w + nx] && isEdge(binary, nx, ny, w, h)) {
        x = nx; y = ny; dir = d; found = true; break;
      }
    }
    if (!found) break;
    steps++;
  } while ((x !== startX || y !== startY) && steps < maxSteps);

  return path;
}

// Trace the boundary of an inner hole (white region inside the letter)
function traceHoleBoundary(binary, holeVisited, holeX, holeY, w, h) {
  // First, flood-fill to find all pixels of this hole & mark visited
  const holePixels = new Set();
  const fillQueue = [holeY * w + holeX];
  holeVisited[holeY * w + holeX] = 1;

  while (fillQueue.length > 0) {
    const idx = fillQueue.pop();
    holePixels.add(idx);
    const px = idx % w, py = (idx - px) / w;
    const neighbors = [
      py > 0 ? idx - w : -1,
      py < h - 1 ? idx + w : -1,
      px > 0 ? idx - 1 : -1,
      px < w - 1 ? idx + 1 : -1
    ];
    for (const ni of neighbors) {
      if (ni >= 0 && !binary[ni] && !holeVisited[ni]) {
        holeVisited[ni] = 1;
        fillQueue.push(ni);
      }
    }
  }

  // Now trace the filled pixels that border this hole
  // Find a starting edge pixel adjacent to the hole
  const borderVisited = new Uint8Array(w * h);
  let startX = -1, startY = -1;

  for (const idx of holePixels) {
    const px = idx % w, py = (idx - px) / w;
    // Check 4-neighbors for a filled pixel
    const neighbors = [
      { x: px - 1, y: py }, { x: px + 1, y: py },
      { x: px, y: py - 1 }, { x: px, y: py + 1 }
    ];
    for (const n of neighbors) {
      if (n.x >= 0 && n.x < w && n.y >= 0 && n.y < h && binary[n.y * w + n.x]) {
        startX = n.x;
        startY = n.y;
        break;
      }
    }
    if (startX >= 0) break;
  }

  if (startX < 0) return [];

  // Trace around the hole boundary (filled pixels that touch this hole)
  const path = [];
  const dirs = [
    { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 1 },
    { dx: -1, dy: 0 }, { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 }
  ];

  let x = startX, y = startY, dir = 0, steps = 0;
  const maxSteps = w * h;

  function touchesHole(px, py) {
    if (px > 0 && holePixels.has(py * w + (px - 1))) return true;
    if (px < w - 1 && holePixels.has(py * w + (px + 1))) return true;
    if (py > 0 && holePixels.has((py - 1) * w + px)) return true;
    if (py < h - 1 && holePixels.has((py + 1) * w + px)) return true;
    return false;
  }

  do {
    path.push({ x, y });
    borderVisited[y * w + x] = 1;

    let found = false;
    const startDir = (dir + 5) % 8;

    for (let i = 0; i < 8; i++) {
      const d = (startDir + i) % 8;
      const nx = x + dirs[d].dx;
      const ny = y + dirs[d].dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h &&
          binary[ny * w + nx] && touchesHole(nx, ny) && !borderVisited[ny * w + nx]) {
        x = nx; y = ny; dir = d; found = true; break;
      }
    }

    if (!found) {
      // Also allow revisiting start to close the loop
      for (let i = 0; i < 8; i++) {
        const d = (startDir + i) % 8;
        const nx = x + dirs[d].dx;
        const ny = y + dirs[d].dy;
        if (nx === startX && ny === startY) {
          found = true; x = nx; y = ny; break;
        }
      }
      if (!found) break;
    }
    steps++;
  } while ((x !== startX || y !== startY) && steps < maxSteps);

  return path;
}

// ── Path Simplification (Ramer-Douglas-Peucker) ───────────
function simplifyPath(points, tolerance) {
  if (points.length <= 2) return points;

  let maxDist = 0, maxIdx = 0;
  const first = points[0], last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToLineDist(points[i], first, last);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }

  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyPath(points.slice(maxIdx), tolerance);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function pointToLineDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// ═══════════════════════════════════════════════════════════
//  RENDERING ENGINE
// ═══════════════════════════════════════════════════════════

// ── Glyph Metrics (baseline-aware) ────────────────────────
// `size` is the cap-height: distance from baseline to top of an uppercase
// glyph. Each glyph reports how it relates to the baseline:
//   topRatio    = height above baseline, as fraction of size
//   bottomRatio = depth below baseline,  as fraction of size
// Defaults assume the glyph sits on the baseline at full cap-height.
// Descenders (p, q, j, g, y) sit higher and drop below — body occupies
// the upper 70% (~x-height) and the tail extends 30% below baseline,
// so the total rendered height stays equal to `size`.
const DESCENDER_KEYS = new Set([
  'lower_p', 'lower_q', 'lower_j', 'lower_g', 'lower_y'
]);

function getGlyphMetrics(key) {
  if (DESCENDER_KEYS.has(key)) {
    return { topRatio: 0.7, bottomRatio: 0.3 };
  }
  return { topRatio: 1.0, bottomRatio: 0.0 };
}

// drawGlyph renders the glyph so its baseline lands at (y + size).
// `y` is the top of the cap-box; the glyph path may extend above or below
// that box depending on the glyph's metrics.
function drawGlyph(ctx, key, x, y, size, color) {
  const data = fontData[key];
  const glyph = glyphByKey[key];
  const { topRatio, bottomRatio } = getGlyphMetrics(key);
  const renderHeight = size * (topRatio + bottomRatio);
  const baselineY = y + size;
  const renderTop = baselineY - size * topRatio;

  if (!data || !data.paths || data.paths.length === 0) {
    // Fallback placeholder
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, renderTop, size * 0.6, renderHeight);
    ctx.fillStyle = color;
    ctx.font = `${size * 0.3}px monospace`;
    ctx.fillText(glyph ? glyph.label : '?', x + size * 0.1, renderTop + renderHeight * 0.6);
    return size * 0.6;
  }

  const letterW = data.width * renderHeight;

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, renderHeight / 60);
  // 'miter' so sharp lineTo corners meet crisply; smooth quadratics still
  // join curve-to-curve naturally and don't need round joins.
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 4;

  // ── Adaptive corner/smooth decision ──
  // At each interior vertex, compare incoming and outgoing direction.
  // cos(turn) close to 1   → going almost straight  → smooth with quadratic
  // cos(turn) below cutoff → sharp turn (corner)    → preserve with lineTo
  //   (cos 0.5 = 60° turn,   0.7 = 45° turn,   0.0 = 90° turn)
  // The midpoint-quadratic technique rounds every corner because each
  // vertex becomes a Bezier control point; this mixed approach keeps
  // the smoothing for genuinely smooth contour sections while letting
  // intended angles (X intersections, A apex, T crossbar, etc.) survive.
  const CORNER_COS_THRESHOLD = 0.5;

  // Combine ALL paths into a single path and use evenodd fill rule
  // This makes inner contours (holes in P, O, B, D, A, R, Q...) cut out correctly
  ctx.beginPath();

  data.paths.forEach(path => {
    if (path.length < 2) return;
    ctx.moveTo(x + path[0].x * renderHeight, renderTop + path[0].y * renderHeight);

    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const next = path[i + 1];

      const v1x = curr.x - prev.x, v1y = curr.y - prev.y;
      const v2x = next.x - curr.x, v2y = next.y - curr.y;
      const len1 = Math.hypot(v1x, v1y);
      const len2 = Math.hypot(v2x, v2y);
      const cosTurn = (len1 > 0 && len2 > 0)
        ? (v1x * v2x + v1y * v2y) / (len1 * len2)
        : 1;

      const cx = x + curr.x * renderHeight;
      const cy = renderTop + curr.y * renderHeight;

      if (cosTurn < CORNER_COS_THRESHOLD) {
        // Sharp corner — draw straight TO the vertex, no smoothing.
        ctx.lineTo(cx, cy);
      } else {
        // Smooth section — midpoint quadratic (vertex is control point,
        // curve passes through midpoint of curr→next).
        const mx = (curr.x + next.x) / 2;
        const my = (curr.y + next.y) / 2;
        ctx.quadraticCurveTo(
          cx, cy,
          x + mx * renderHeight, renderTop + my * renderHeight
        );
      }
    }

    const last = path[path.length - 1];
    ctx.lineTo(x + last.x * renderHeight, renderTop + last.y * renderHeight);
    ctx.closePath();
  });

  ctx.fill('evenodd');

  return letterW + size * 0.1;
}

// ═══════════════════════════════════════════════════════════
//  TYPING CANVAS with Ligature Support
// ═══════════════════════════════════════════════════════════

function setupTypingCanvas() {
  const area = document.getElementById('typingArea');
  const canvas = document.getElementById('typingCanvas');

  function resizeCanvas() {
    canvas.width = area.clientWidth;
    canvas.height = area.clientHeight;
    redrawTypingCanvas();
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  area.setAttribute('tabindex', '0');
  area.addEventListener('click', () => area.focus());

  let isDragging = false;

  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    area.focus();
    const pt = canvasPointFromEvent(canvas, e);
    const idx = findCaretIndexAt(pt.x, pt.y);
    caretIndex = idx;
    selectionStart = idx;
    selectionEnd = idx;
    isDragging = true;
    redrawTypingCanvas();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const pt = canvasPointFromEvent(canvas, e);
    const idx = findCaretIndexAt(pt.x, pt.y);
    caretIndex = idx;
    selectionEnd = idx;
    redrawTypingCanvas();
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    if (selectionStart === selectionEnd) clearSelection();
    redrawTypingCanvas();
  });

  area.addEventListener('keydown', e => {
    const key = e.key;

    if (e.ctrlKey || e.metaKey) {
      if (key.toLowerCase() === 'a') {
        e.preventDefault();
        selectionStart = 0;
        selectionEnd = typedChars.length;
        caretIndex = typedChars.length;
        redrawTypingCanvas();
      }
      return;
    }

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      e.preventDefault();
      const dir = key === 'ArrowLeft' ? -1 : 1;
      if (e.shiftKey) {
        if (selectionStart === null) selectionStart = caretIndex;
        caretIndex = Math.max(0, Math.min(typedChars.length, caretIndex + dir));
        selectionEnd = caretIndex;
      } else {
        if (hasSelection()) {
          const [s, en] = getSelectionRange();
          caretIndex = dir < 0 ? s : en;
        } else {
          caretIndex = Math.max(0, Math.min(typedChars.length, caretIndex + dir));
        }
        clearSelection();
      }
      redrawTypingCanvas();
      return;
    }

    if (key === 'ArrowUp' || key === 'ArrowDown') {
      e.preventDefault();
      moveCaretVertically(key === 'ArrowUp' ? -1 : 1, e.shiftKey);
      redrawTypingCanvas();
      return;
    }

    if (key === 'Home' || key === 'End') {
      e.preventDefault();
      const pos = getCaretPositionForIndex(caretIndex);
      const targetX = key === 'Home' ? -99999 : 99999;
      const newIdx = findCaretIndexAt(targetX, pos.y + pos.size / 2);
      if (e.shiftKey) {
        if (selectionStart === null) selectionStart = caretIndex;
        selectionEnd = newIdx;
      } else {
        clearSelection();
      }
      caretIndex = newIdx;
      redrawTypingCanvas();
      return;
    }

    e.preventDefault();

    if (key === 'Backspace') {
      if (!deleteSelection()) {
        if (caretIndex > 0) {
          typedChars.splice(caretIndex - 1, 1);
          caretIndex--;
          recalcCursor();
        }
      }
      redrawTypingCanvas();
      return;
    }

    if (key === 'Delete') {
      if (!deleteSelection()) {
        if (caretIndex < typedChars.length) {
          typedChars.splice(caretIndex, 1);
          recalcCursor();
        }
      }
      redrawTypingCanvas();
      return;
    }

    if (key === 'Enter') {
      deleteSelection();
      typedChars.splice(caretIndex, 0, {
        glyphKey: '\n', x: 0, y: 0,
        size: fontSize, color: fontColor, advance: 0
      });
      caretIndex++;
      recalcCursor();
      redrawTypingCanvas();
      return;
    }

    if (key.length === 1) {
      deleteSelection();
      const ch = key;

      // Ligature: check char immediately before caret
      if (ligaturesEnabled && caretIndex > 0) {
        const prev = typedChars[caretIndex - 1];
        if (prev && prev.glyphKey !== '\n' && prev.glyphKey !== ' ') {
          const prevGlyph = glyphByKey[prev.glyphKey];
          if (prevGlyph) {
            const combo = prevGlyph.chars.toLowerCase() + ch.toLowerCase();
            for (const lig of LIGATURES) {
              if (lig.chars === combo && fontData[lig.key]) {
                typedChars.splice(caretIndex - 1, 1, {
                  glyphKey: lig.key, x: 0, y: 0,
                  size: fontSize, color: fontColor, advance: 0
                });
                recalcCursor();
                redrawTypingCanvas();
                return;
              }
            }
          }
        }
      }

      const glyphKey = resolveCharToKey(ch);
      typedChars.splice(caretIndex, 0, {
        glyphKey, x: 0, y: 0,
        size: fontSize, color: fontColor, advance: 0
      });
      caretIndex++;
      recalcCursor();
      redrawTypingCanvas();
    }
  });
}

// ── Selection / Caret Helpers ──────────────────────────────
function hasSelection() {
  return selectionStart !== null && selectionEnd !== null && selectionStart !== selectionEnd;
}

function getSelectionRange() {
  return [Math.min(selectionStart, selectionEnd), Math.max(selectionStart, selectionEnd)];
}

function clearSelection() {
  selectionStart = null;
  selectionEnd = null;
}

function deleteSelection() {
  if (!hasSelection()) return false;
  const [s, e] = getSelectionRange();
  typedChars.splice(s, e - s);
  caretIndex = s;
  clearSelection();
  recalcCursor();
  return true;
}

function canvasPointFromEvent(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function getCaretPositionForIndex(index) {
  if (typedChars.length === 0) return { x: 20, y: 80, size: fontSize };

  if (index <= 0) {
    const first = typedChars[0];
    if (first.glyphKey === '\n') return { x: 20, y: 80, size: first.size };
    return { x: first.x, y: first.y, size: first.size };
  }

  if (index >= typedChars.length) {
    return { x: cursorX, y: cursorY, size: fontSize };
  }

  const tc = typedChars[index];
  if (tc.glyphKey === '\n') {
    const prev = typedChars[index - 1];
    if (prev && prev.glyphKey !== '\n') {
      return { x: prev.x + prev.advance, y: prev.y, size: prev.size };
    }
    let y = 80;
    for (let i = 0; i < index; i++) {
      if (typedChars[i].glyphKey === '\n') y += typedChars[i].size * 1.4;
    }
    return { x: 20, y, size: tc.size };
  }

  return { x: tc.x, y: tc.y, size: tc.size };
}

function findCaretIndexAt(clickX, clickY) {
  const positions = [];
  for (let i = 0; i <= typedChars.length; i++) {
    positions.push(getCaretPositionForIndex(i));
  }
  let bestIdx = 0;
  let bestScore = Infinity;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    let yPenalty;
    if (clickY >= p.y && clickY <= p.y + p.size) yPenalty = 0;
    else yPenalty = Math.abs(clickY - (p.y + p.size / 2)) * 10;
    const score = yPenalty + Math.abs(p.x - clickX);
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function moveCaretVertically(delta, shiftKey) {
  const current = getCaretPositionForIndex(caretIndex);
  const targetY = current.y + delta * fontSize * 1.4;
  const newIndex = findCaretIndexAt(current.x, targetY + current.size / 2);
  if (shiftKey) {
    if (selectionStart === null) selectionStart = caretIndex;
    caretIndex = newIndex;
    selectionEnd = newIndex;
  } else {
    caretIndex = newIndex;
    clearSelection();
  }
}

// Map a typed character to its glyph key
function resolveCharToKey(ch) {
  // Check uppercase letter
  if (ch >= 'A' && ch <= 'Z') {
    const key = `upper_${ch}`;
    if (glyphByKey[key]) return key;
  }
  // Check lowercase letter
  if (ch >= 'a' && ch <= 'z') {
    const key = `lower_${ch}`;
    if (glyphByKey[key]) return key;
  }
  // Check digit
  if (ch >= '0' && ch <= '9') {
    const key = `num_${ch}`;
    if (glyphByKey[key]) return key;
  }
  // Symbol lookup by chars
  const g = glyphByChars[ch];
  if (g) return g.key;
  // Unknown - return the raw char as key (fallback rendering)
  return ch;
}

function getGlyphAdvance(key, size) {
  if (key === ' ') return size * 0.4;
  const data = fontData[key];
  if (data && data.paths && data.paths.length > 0) {
    const { topRatio, bottomRatio } = getGlyphMetrics(key);
    const renderHeight = size * (topRatio + bottomRatio);
    return data.width * renderHeight + size * 0.1;
  }
  return size * 0.7;
}

function recalcCursor() {
  const canvas = document.getElementById('typingCanvas');
  cursorX = 20;
  cursorY = 80;
  for (const tc of typedChars) {
    if (tc.glyphKey === '\n') {
      cursorX = 20;
      cursorY += tc.size * 1.4;
      continue;
    }
    tc.x = cursorX;
    tc.y = cursorY;
    const advance = getGlyphAdvance(tc.glyphKey, tc.size);
    tc.advance = advance;
    if (cursorX + advance > canvas.width - 20) {
      cursorX = 20;
      cursorY += tc.size * 1.4;
      tc.x = cursorX;
      tc.y = cursorY;
    }
    cursorX += advance + (tc.kernAdjust || 0);
  }
}

function redrawTypingCanvas() {
  const canvas = document.getElementById('typingCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Selection highlight (behind glyphs)
  if (hasSelection()) {
    const [s, e] = getSelectionRange();
    ctx.fillStyle = 'rgba(102, 126, 234, 0.28)';
    for (let i = s; i < e; i++) {
      const tc = typedChars[i];
      if (tc.glyphKey === '\n') continue;
      ctx.fillRect(tc.x, tc.y, tc.advance, tc.size);
    }
  }

  for (const tc of typedChars) {
    if (tc.glyphKey === '\n' || tc.glyphKey === ' ') continue;

    if (fontData[tc.glyphKey]) {
      drawGlyph(ctx, tc.glyphKey, tc.x, tc.y, tc.size, tc.color);
    } else {
      // Fallback for characters without custom glyph
      ctx.fillStyle = tc.color;
      ctx.font = `${tc.size}px sans-serif`;
      const label = glyphByKey[tc.glyphKey] ? glyphByKey[tc.glyphKey].label : tc.glyphKey;
      ctx.fillText(label, tc.x, tc.y + tc.size * 0.8);
    }
  }

  // Caret blink (only when focused and no active selection)
  const area = document.getElementById('typingArea');
  const focused = area && (area === document.activeElement || area.contains(document.activeElement));
  if (focused && !hasSelection()) {
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      const pos = getCaretPositionForIndex(caretIndex);
      ctx.fillStyle = '#667eea';
      ctx.fillRect(pos.x, pos.y, 2, pos.size);
    }
  }
}

// Cursor blink loop
setInterval(() => {
  const area = document.getElementById('typingArea');
  if (area && (area === document.activeElement || area.contains(document.activeElement))) {
    redrawTypingCanvas();
  }
  if (a4Caret) {
    renderA4Canvas();
  }
  if (posterCaret) {
    renderPosterCanvas();
  }
}, 500);

// ── Controls ───────────────────────────────────────────────
function setupControls() {
  const sizeLabel = document.getElementById('fontSizeLabel');
  const colorPicker = document.getElementById('fontColor');
  const ligToggle = document.getElementById('ligatureToggle');

  // Default font size: the size NEW glyphs are typed at. Already-typed
  // glyphs keep their own size — those are edited with Char size.
  const stepFontSize = (delta) => {
    fontSize = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, fontSize + delta));
    sizeLabel.textContent = fontSize + 'px';
  };
  sizeLabel.textContent = fontSize + 'px';
  document.getElementById('fontSizeUpBtn').addEventListener('click', () => {
    stepFontSize(FONT_SIZE_STEP);
  });
  document.getElementById('fontSizeDownBtn').addEventListener('click', () => {
    stepFontSize(-FONT_SIZE_STEP);
  });

  colorPicker.addEventListener('input', () => {
    fontColor = colorPicker.value;
  });

  ligToggle.addEventListener('change', () => {
    ligaturesEnabled = ligToggle.checked;
    renderA4Canvas();
  });

  const typingStep = () => fontSize * 0.04;
  document.getElementById('typingKernUpBtn').addEventListener('click', () => {
    adjustKernAtTypingCaret(typingStep());
  });
  document.getElementById('typingKernDownBtn').addEventListener('click', () => {
    adjustKernAtTypingCaret(-typingStep());
  });

  document.getElementById('typingSizeUpBtn').addEventListener('click', () => {
    scaleTypingSize(CHAR_SIZE_STEP);
  });
  document.getElementById('typingSizeDownBtn').addEventListener('click', () => {
    scaleTypingSize(1 / CHAR_SIZE_STEP);
  });

  const a4Step = () => {
    if (a4RenderedLayout && a4Caret) {
      const line = a4RenderedLayout[a4Caret.lineIdx];
      if (line) return line.size * 0.04;
    }
    const canvas = document.getElementById('a4Canvas');
    return (canvas ? canvas.height : 1485) * 0.005;
  };
  document.getElementById('a4KernUpBtn').addEventListener('click', () => {
    adjustKernAtA4Caret(a4Step());
  });
  document.getElementById('a4KernDownBtn').addEventListener('click', () => {
    adjustKernAtA4Caret(-a4Step());
  });

  document.getElementById('a4SizeUpBtn').addEventListener('click', () => {
    adjustSizeAtA4Caret(0.1);
  });
  document.getElementById('a4SizeDownBtn').addEventListener('click', () => {
    adjustSizeAtA4Caret(-0.1);
  });

  const a4LineHeightSlider = document.getElementById('a4LineHeightSlider');
  const a4LineHeightLabel = document.getElementById('a4LineHeightLabel');
  a4LineHeightSlider.addEventListener('input', () => {
    a4LineHeight = parseFloat(a4LineHeightSlider.value);
    a4LineHeightLabel.textContent = a4LineHeight.toFixed(2);
    renderA4Canvas();
  });

  const posterStep = () => {
    const canvas = document.getElementById('posterCanvas');
    const H = canvas ? canvas.height : 1485;
    return H * 0.005;
  };
  document.getElementById('posterKernUpBtn').addEventListener('click', () => {
    adjustKernAtPosterCaret(posterStep());
  });
  document.getElementById('posterKernDownBtn').addEventListener('click', () => {
    adjustKernAtPosterCaret(-posterStep());
  });

  document.getElementById('clearCanvasBtn').addEventListener('click', () => {
    typedChars = [];
    caretIndex = 0;
    clearSelection();
    cursorX = 20;
    cursorY = 80;
    redrawTypingCanvas();
  });

  document.getElementById('downloadAllBtn').addEventListener('click', downloadAll);
  document.getElementById('saveTypedBtn').addEventListener('click', saveTypedImage);

  document.getElementById('clearAllBtn').addEventListener('click', () => {
    GLYPHS.forEach(g => removeGlyph(g.key));
    typedChars = [];
    caretIndex = 0;
    clearSelection();
    cursorX = 20;
    cursorY = 80;
    redrawTypingCanvas();
  });
}

// ═══════════════════════════════════════════════════════════
//  DOWNLOAD ALL - zip original images into a folder
// ═══════════════════════════════════════════════════════════

// File-name-safe label map for symbols/ligatures
const FILE_NAME_MAP = {
  paren_l:   'PAREN-L',
  paren_r:   'PAREN-R',
  comma:     'COMMA',
  period:    'PERIOD',
  angle_l:   'ANGLE-L',
  angle_r:   'ANGLE-R',
  question:  'QUESTION',
  exclaim:   'EXCLAIM',
  ampersand: 'AMPERSAND',
  percent:   'PERCENT',
  dollar:    'DOLLAR',
  at:        'AT',
  hash:      'HASH',
  caret:     'CARET',
  asterisk:  'ASTERISK',
  plus:      'PLUS',
  equals:    'EQUALS',
  tilde:     'TILDE',
  won:       'WON',
  slash:     'SLASH',
  backslash: 'BACKSLASH',
  pipe:      'PIPE',
  pound:     'POUND',
  euro:      'EURO',
  lig_fl:    'LIG-FL',
  lig_ft:    'LIG-FT',
  lig_fi:    'LIG-FI',
};

function getDateString() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${mm}${dd}${yyyy}`;
}

function getFileLabel(key) {
  if (FILE_NAME_MAP[key]) return FILE_NAME_MAP[key];
  // Uppercase letters: upper_A → A-upper
  if (key.startsWith('upper_')) return `${key.slice(6)}-upper`;
  // Lowercase letters: lower_a → a-lower
  if (key.startsWith('lower_')) return `${key.slice(6)}-lower`;
  // Digits: num_0 → 0-num
  if (key.startsWith('num_')) return `${key.slice(4)}-num`;
  return key.toUpperCase();
}

async function downloadAll() {
  const keys = Object.keys(originalImages);
  if (keys.length === 0) {
    alert('No images uploaded yet.');
    return;
  }

  const btn = document.getElementById('downloadAllBtn');
  btn.disabled = true;
  btn.textContent = 'Zipping...';

  try {
    const dateStr = getDateString();
    const folderName = `BrowserBaseTypography-${dateStr}`;
    const zip = new JSZip();
    const folder = zip.folder(folderName);

    for (const key of keys) {
      const { blob, ext } = originalImages[key];
      const label = getFileLabel(key);
      const fileName = `${dateStr}-${label}.${ext}`;
      folder.file(fileName, blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folderName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download failed:', err);
    alert('Download failed. Check console for details.');
  } finally {
    btn.disabled = false;
    btn.textContent = '\u{1F4E6} Download Glyphs (.zip)';
  }
}

// ═══════════════════════════════════════════════════════════
//  SAVE TYPED IMAGE - export typing canvas as PNG
// ═══════════════════════════════════════════════════════════

function saveTypedImage() {
  const canvas = document.getElementById('typingCanvas');

  if (typedChars.length === 0) {
    alert('Nothing typed yet. Type something first!');
    return;
  }

  // Redraw without cursor so it doesn't appear in the saved image
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const tc of typedChars) {
    if (tc.glyphKey === '\n' || tc.glyphKey === ' ') continue;
    if (fontData[tc.glyphKey]) {
      drawGlyph(ctx, tc.glyphKey, tc.x, tc.y, tc.size, tc.color);
    } else {
      ctx.fillStyle = tc.color;
      ctx.font = `${tc.size}px sans-serif`;
      const label = glyphByKey[tc.glyphKey] ? glyphByKey[tc.glyphKey].label : tc.glyphKey;
      ctx.fillText(label, tc.x, tc.y + tc.size * 0.8);
    }
  }

  // Export
  const dateStr = getDateString();
  const fileName = `BrowserBaseTypography-typed-${dateStr}.png`;

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Restore cursor blink
    redrawTypingCanvas();
  }, 'image/png');
}

// ═══════════════════════════════════════════════════════════
//  LIVE A4 PRINT - Book Cover Preview
// ═══════════════════════════════════════════════════════════

const A4_DEFAULT_LINES = ['Rhizomatic!', 'Font!!!'];

// A4 caret & kerning state
let a4Caret = null; // { lineIdx, charIdx } — charIdx in rendered-glyph space
let a4Kerns = []; // a4Kerns[lineIdx] = array of extra gap after each rendered glyph
let a4LineSizes = [1.0, 1.0]; // per-line font size factor (default 1.0)
let a4LineHeight = 1.15; // line advance as multiple of line size (gap = lh - 1)
let a4RenderedLayout = null; // populated during render for hit-testing
let a4SuppressCaret = false;

function getA4TextLines() {
  const input = document.getElementById('a4TextInput');
  if (!input) return A4_DEFAULT_LINES;
  return input.value.split('\n');
}

function getA4RequiredKeys() {
  const lines = getA4TextLines();
  const keys = new Set();
  for (const line of lines) {
    for (const ch of line) {
      if (ch === ' ') continue;
      const key = resolveCharToKey(ch);
      if (glyphByKey[key]) keys.add(key);
    }
  }
  return [...keys];
}

function setupA4Canvas() {
  const canvas = document.getElementById('a4Canvas');
  canvas.width = 2100;
  canvas.height = 1485;
  renderA4Canvas();

  document.getElementById('exportA4Btn').addEventListener('click', exportA4Image);

  const textInput = document.getElementById('a4TextInput');
  textInput.addEventListener('input', () => {
    a4Kerns = [];
    a4Caret = null;
    renderA4Canvas();
  });

  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const pt = canvasPointFromEvent(canvas, e);
    const pos = findA4CaretAt(pt.x, pt.y);
    if (pos) {
      a4Caret = pos;
      renderA4Canvas();
    }
  });
}

function tokenizeA4Line(line, size, ctx) {
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    let matched = false;
    if (ligaturesEnabled) {
      for (const lig of LIGATURES) {
        if (line.substr(i, lig.chars.length).toLowerCase() === lig.chars && fontData[lig.key]) {
          const key = lig.key;
          tokens.push({
            width: getGlyphAdvance(key, size),
            draw: (c, x, y, s, col) => drawGlyph(c, key, x, y, s, col)
          });
          i += lig.chars.length;
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      const ch = line[i];
      if (ch === ' ') {
        tokens.push({ width: size * 0.4, draw: () => {} });
      } else {
        const key = resolveCharToKey(ch);
        if (fontData[key]) {
          tokens.push({
            width: getGlyphAdvance(key, size),
            draw: (c, x, y, s, col) => drawGlyph(c, key, x, y, s, col)
          });
        } else {
          ctx.font = `${size * 0.95}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          const w = ctx.measureText(ch).width + size * 0.04;
          const glyphCh = ch;
          tokens.push({
            width: w,
            draw: (c, x, y, s, col) => {
              c.fillStyle = '#cccccc';
              c.font = `${s * 0.95}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
              c.fillText(glyphCh, x, y + s * 0.85);
            }
          });
        }
      }
      i++;
    }
  }
  return tokens;
}

function ensureA4KernsStructure(counts) {
  while (a4Kerns.length < counts.length) a4Kerns.push([]);
  while (a4Kerns.length > counts.length) a4Kerns.pop();
  for (let i = 0; i < counts.length; i++) {
    if (!a4Kerns[i]) a4Kerns[i] = [];
    while (a4Kerns[i].length < counts[i]) a4Kerns[i].push(0);
    while (a4Kerns[i].length > counts[i]) a4Kerns[i].pop();
  }
}

function ensureA4LineSizes(lineCount) {
  while (a4LineSizes.length < lineCount) a4LineSizes.push(1.0);
  while (a4LineSizes.length > lineCount) a4LineSizes.pop();
}

function adjustSizeAtA4Caret(delta) {
  if (!a4Caret) return;
  const lineIdx = a4Caret.lineIdx;
  if (lineIdx < 0 || lineIdx >= a4LineSizes.length) return;
  a4LineSizes[lineIdx] = Math.max(0.2, a4LineSizes[lineIdx] + delta);
  renderA4Canvas();
}

function renderA4Canvas() {
  const canvas = document.getElementById('a4Canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const rightCenterX = W * 0.75;
  // Text must live inside the right half of the A4 (the book's front cover).
  // Leave a small safety margin so the widest line never crosses the spine
  // or runs off the right edge.
  const maxLineWidth = (W / 2) * 0.95;

  const lines = getA4TextLines();
  ensureA4LineSizes(lines.length);

  // Sum factor for vertical layout (per-line size aware).
  // Last line uses factor; preceding lines use factor * a4LineHeight (row + gap).
  let sumFactor = 0;
  for (let i = 0; i < lines.length; i++) {
    const f = a4LineSizes[i] || 1.0;
    sumFactor += i < lines.length - 1 ? f * a4LineHeight : f;
  }
  sumFactor = Math.max(1, sumFactor);

  let baseGlyph = Math.min(H * 0.20, (H * 0.85) / sumFactor);

  // Width-fit pass: tokenize each line at the vertical-constrained baseGlyph
  // and shrink baseGlyph if any line overflows the right half. Token widths
  // scale linearly with size, so a single measurement gives the exact ratio.
  let measuredTokens = lines.map((line, idx) =>
    tokenizeA4Line(line, baseGlyph * (a4LineSizes[idx] || 1.0), ctx));
  let widthShrink = 1.0;
  for (let i = 0; i < measuredTokens.length; i++) {
    const tokens = measuredTokens[i];
    const lineKerns = a4Kerns[i] || [];
    let lineWidth = 0;
    for (let j = 0; j < tokens.length; j++) {
      lineWidth += tokens[j].width;
      if (j < tokens.length - 1) lineWidth += (lineKerns[j] || 0);
    }
    if (lineWidth > maxLineWidth) {
      widthShrink = Math.min(widthShrink, maxLineWidth / lineWidth);
    }
  }
  if (widthShrink < 1.0) {
    baseGlyph *= widthShrink;
  }
  // Global trim so the cover breathes a little inside the right half.
  baseGlyph *= 0.97;
  measuredTokens = lines.map((line, idx) =>
    tokenizeA4Line(line, baseGlyph * (a4LineSizes[idx] || 1.0), ctx));

  const totalHeight = sumFactor * baseGlyph;
  let y = (H - totalHeight) / 2;

  const allTokens = measuredTokens;
  ensureA4KernsStructure(allTokens.map(t => t.length));

  a4RenderedLayout = [];

  for (let lineIdx = 0; lineIdx < allTokens.length; lineIdx++) {
    const lineSize = baseGlyph * (a4LineSizes[lineIdx] || 1.0);
    const tokens = allTokens[lineIdx];
    const lineKerns = a4Kerns[lineIdx] || [];

    let lineWidth = 0;
    for (let i = 0; i < tokens.length; i++) {
      lineWidth += tokens[i].width;
      if (i < tokens.length - 1) lineWidth += (lineKerns[i] || 0);
    }

    const startX = rightCenterX - lineWidth / 2;
    let cursorX = startX;
    const chars = [];

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      tok.draw(ctx, cursorX, y, lineSize, '#000000');
      chars.push({ x: cursorX, width: tok.width });
      cursorX += tok.width;
      if (i < tokens.length - 1) cursorX += (lineKerns[i] || 0);
    }

    a4RenderedLayout.push({
      lineIdx, y, size: lineSize,
      chars, startX, endX: cursorX
    });

    y += lineSize * a4LineHeight;
  }

  if (!a4SuppressCaret) drawA4Caret(ctx);
  updateA4Status();
}

function drawA4Caret(ctx) {
  if (!a4Caret || !a4RenderedLayout) return;
  if (Math.floor(Date.now() / 500) % 2 !== 0) return;

  const line = a4RenderedLayout[a4Caret.lineIdx];
  if (!line) return;

  let caretX;
  if (line.chars.length === 0) {
    caretX = line.startX;
  } else if (a4Caret.charIdx <= 0) {
    caretX = line.chars[0].x;
  } else if (a4Caret.charIdx >= line.chars.length) {
    const last = line.chars[line.chars.length - 1];
    caretX = last.x + last.width;
  } else {
    const prev = line.chars[a4Caret.charIdx - 1];
    const curr = line.chars[a4Caret.charIdx];
    caretX = (prev.x + prev.width + curr.x) / 2;
  }

  ctx.fillStyle = '#667eea';
  ctx.fillRect(caretX - 1.5, line.y, 3, line.size);
}

function findA4CaretAt(clickX, clickY) {
  if (!a4RenderedLayout || a4RenderedLayout.length === 0) return null;

  let bestLine = null;
  let bestDist = Infinity;
  for (const line of a4RenderedLayout) {
    let dist;
    if (clickY >= line.y && clickY <= line.y + line.size) dist = 0;
    else dist = Math.min(Math.abs(clickY - line.y), Math.abs(clickY - (line.y + line.size)));
    if (dist < bestDist) { bestDist = dist; bestLine = line; }
  }
  if (!bestLine) return null;

  const gapXs = [];
  if (bestLine.chars.length === 0) {
    gapXs.push(bestLine.startX);
  } else {
    gapXs.push(bestLine.chars[0].x);
    for (let i = 1; i < bestLine.chars.length; i++) {
      const prev = bestLine.chars[i - 1];
      const curr = bestLine.chars[i];
      gapXs.push((prev.x + prev.width + curr.x) / 2);
    }
    const last = bestLine.chars[bestLine.chars.length - 1];
    gapXs.push(last.x + last.width);
  }

  let bestIdx = 0;
  let bestXDist = Infinity;
  for (let i = 0; i < gapXs.length; i++) {
    const d = Math.abs(gapXs[i] - clickX);
    if (d < bestXDist) { bestXDist = d; bestIdx = i; }
  }

  return { lineIdx: bestLine.lineIdx, charIdx: bestIdx };
}

// Typing-canvas twin of scaleRtSize(): scales the dragged selection, or
// the glyph before the caret when there is none.
function scaleTypingSize(factor) {
  const targets = [];
  if (hasSelection()) {
    const [start, end] = getSelectionRange();
    // Newlines carry this canvas's line advance (cursorY += size * 1.4),
    // so they scale with the rest or the lines would start overlapping.
    for (let i = start; i < end; i++) targets.push(typedChars[i]);
  } else if (caretIndex > 0) {
    const target = typedChars[caretIndex - 1];
    if (target && target.glyphKey !== '\n') targets.push(target);
  }
  if (targets.length === 0) return;

  for (const target of targets) {
    if (!target) continue;
    target.size = Math.max(8, target.size * factor);
  }
  recalcCursor();
  redrawTypingCanvas();
}

function adjustKernAtTypingCaret(delta) {
  if (hasSelection()) {
    caretIndex = getSelectionRange()[0];
    clearSelection();
  }
  if (caretIndex === 0) return;
  const target = typedChars[caretIndex - 1];
  if (!target || target.glyphKey === '\n') return;
  target.kernAdjust = (target.kernAdjust || 0) + delta;
  recalcCursor();
  redrawTypingCanvas();
}

function adjustKernAtA4Caret(delta) {
  if (!a4Caret) return;
  const { lineIdx, charIdx } = a4Caret;
  const lineKerns = a4Kerns[lineIdx];
  if (!lineKerns) return;
  if (charIdx <= 0 || charIdx >= lineKerns.length + 1) return;
  const slot = charIdx - 1;
  if (slot >= lineKerns.length) return;
  lineKerns[slot] = (lineKerns[slot] || 0) + delta;
  renderA4Canvas();
}

function updateA4Status() {
  const required = getA4RequiredKeys();
  const total = required.length;
  const filled = required.filter(k => fontData[k]).length;
  const statusEl = document.getElementById('a4Status');
  const btn = document.getElementById('exportA4Btn');
  if (!statusEl || !btn) return;

  statusEl.textContent = `${filled} / ${total} required glyphs`;
  if (filled === total && total > 0) {
    statusEl.classList.add('ready');
  } else {
    statusEl.classList.remove('ready');
  }
  btn.disabled = false;
}

function exportA4Image() {
  const canvas = document.getElementById('a4Canvas');
  a4SuppressCaret = true;
  renderA4Canvas();

  const dateStr = getDateString();
  const fileName = `BrowserBaseTypography-bookcover-${dateStr}.jpg`;

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    a4SuppressCaret = false;
    renderA4Canvas();
  }, 'image/jpeg', 0.95);
}

// ═══════════════════════════════════════════════════════════
//  2 A5 POSTERS ON A4
// ═══════════════════════════════════════════════════════════

const POSTER_DEFAULT_LEFT = ['Poster', 'One'];
const POSTER_DEFAULT_RIGHT = ['Poster', 'Two'];

let posterCaret = null; // { side: 'left'|'right', lineIdx, charIdx }
let posterKerns = { left: [], right: [] };
let posterRenderedLayout = { left: null, right: null };
let posterSuppressCaret = false;

function getPosterTextLines(side) {
  const id = side === 'left' ? 'posterLeftInput' : 'posterRightInput';
  const input = document.getElementById(id);
  if (!input) return side === 'left' ? POSTER_DEFAULT_LEFT : POSTER_DEFAULT_RIGHT;
  return input.value.split('\n');
}

function setupPosterCanvas() {
  const canvas = document.getElementById('posterCanvas');
  canvas.width = 2100;
  canvas.height = 1485;
  renderPosterCanvas();

  document.getElementById('exportPosterBtn').addEventListener('click', exportPosterImage);

  ['posterLeftInput', 'posterRightInput'].forEach(id => {
    const input = document.getElementById(id);
    input.addEventListener('input', () => {
      const side = id === 'posterLeftInput' ? 'left' : 'right';
      posterKerns[side] = [];
      if (posterCaret && posterCaret.side === side) posterCaret = null;
      renderPosterCanvas();
    });
  });

  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const pt = canvasPointFromEvent(canvas, e);
    const pos = findPosterCaretAt(pt.x, pt.y);
    if (pos) {
      posterCaret = pos;
      renderPosterCanvas();
    }
  });
}

function ensurePosterKernsStructure(side, counts) {
  const kerns = posterKerns[side];
  while (kerns.length < counts.length) kerns.push([]);
  while (kerns.length > counts.length) kerns.pop();
  for (let i = 0; i < counts.length; i++) {
    if (!kerns[i]) kerns[i] = [];
    while (kerns[i].length < counts[i]) kerns[i].push(0);
    while (kerns[i].length > counts[i]) kerns[i].pop();
  }
}

function renderPosterCanvas() {
  const canvas = document.getElementById('posterCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Subtle divider between the two A5 posters
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();

  renderPosterSide('left', ctx, 0, 0, W / 2, H);
  renderPosterSide('right', ctx, W / 2, 0, W / 2, H);

  if (!posterSuppressCaret) drawPosterCaret(ctx);
}

function renderPosterSide(side, ctx, offsetX, offsetY, width, height) {
  const lines = getPosterTextLines(side);
  const factor = Math.max(1, (lines.length - 1) * 1.15 + 1);
  const glyphSize = Math.min(height * 0.20, (height * 0.85) / factor);
  const lineGap = glyphSize * 1.15;
  const totalHeight = (lines.length - 1) * lineGap + glyphSize;
  let y = offsetY + (height - totalHeight) / 2;

  const centerX = offsetX + width / 2;

  const allTokens = lines.map(line => tokenizeA4Line(line, glyphSize, ctx));
  ensurePosterKernsStructure(side, allTokens.map(t => t.length));

  const layout = [];

  for (let lineIdx = 0; lineIdx < allTokens.length; lineIdx++) {
    const tokens = allTokens[lineIdx];
    const lineKerns = posterKerns[side][lineIdx] || [];

    let lineWidth = 0;
    for (let i = 0; i < tokens.length; i++) {
      lineWidth += tokens[i].width;
      if (i < tokens.length - 1) lineWidth += (lineKerns[i] || 0);
    }

    const startX = centerX - lineWidth / 2;
    let cursorX = startX;
    const chars = [];

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      tok.draw(ctx, cursorX, y, glyphSize, '#000000');
      chars.push({ x: cursorX, width: tok.width });
      cursorX += tok.width;
      if (i < tokens.length - 1) cursorX += (lineKerns[i] || 0);
    }

    layout.push({ lineIdx, y, size: glyphSize, chars, startX, endX: cursorX });
    y += lineGap;
  }

  posterRenderedLayout[side] = layout;
}

function drawPosterCaret(ctx) {
  if (!posterCaret) return;
  const layout = posterRenderedLayout[posterCaret.side];
  if (!layout) return;
  if (Math.floor(Date.now() / 500) % 2 !== 0) return;

  const line = layout[posterCaret.lineIdx];
  if (!line) return;

  let caretX;
  if (line.chars.length === 0) {
    caretX = line.startX;
  } else if (posterCaret.charIdx <= 0) {
    caretX = line.chars[0].x;
  } else if (posterCaret.charIdx >= line.chars.length) {
    const last = line.chars[line.chars.length - 1];
    caretX = last.x + last.width;
  } else {
    const prev = line.chars[posterCaret.charIdx - 1];
    const curr = line.chars[posterCaret.charIdx];
    caretX = (prev.x + prev.width + curr.x) / 2;
  }

  ctx.fillStyle = '#667eea';
  ctx.fillRect(caretX - 1.5, line.y, 3, line.size);
}

function findPosterCaretAt(clickX, clickY) {
  const canvas = document.getElementById('posterCanvas');
  const W = canvas.width;
  const side = clickX < W / 2 ? 'left' : 'right';
  const layout = posterRenderedLayout[side];
  if (!layout || layout.length === 0) return null;

  let bestLine = null;
  let bestDist = Infinity;
  for (const line of layout) {
    let dist;
    if (clickY >= line.y && clickY <= line.y + line.size) dist = 0;
    else dist = Math.min(Math.abs(clickY - line.y), Math.abs(clickY - (line.y + line.size)));
    if (dist < bestDist) { bestDist = dist; bestLine = line; }
  }
  if (!bestLine) return null;

  const gapXs = [];
  if (bestLine.chars.length === 0) {
    gapXs.push(bestLine.startX);
  } else {
    gapXs.push(bestLine.chars[0].x);
    for (let i = 1; i < bestLine.chars.length; i++) {
      const prev = bestLine.chars[i - 1];
      const curr = bestLine.chars[i];
      gapXs.push((prev.x + prev.width + curr.x) / 2);
    }
    const last = bestLine.chars[bestLine.chars.length - 1];
    gapXs.push(last.x + last.width);
  }

  let bestIdx = 0;
  let bestXDist = Infinity;
  for (let i = 0; i < gapXs.length; i++) {
    const d = Math.abs(gapXs[i] - clickX);
    if (d < bestXDist) { bestXDist = d; bestIdx = i; }
  }

  return { side, lineIdx: bestLine.lineIdx, charIdx: bestIdx };
}

function adjustKernAtPosterCaret(delta) {
  if (!posterCaret) return;
  const { side, lineIdx, charIdx } = posterCaret;
  const lineKerns = posterKerns[side][lineIdx];
  if (!lineKerns) return;
  if (charIdx <= 0 || charIdx >= lineKerns.length + 1) return;
  const slot = charIdx - 1;
  if (slot >= lineKerns.length) return;
  lineKerns[slot] = (lineKerns[slot] || 0) + delta;
  renderPosterCanvas();
}

function exportPosterImage() {
  const canvas = document.getElementById('posterCanvas');
  posterSuppressCaret = true;
  renderPosterCanvas();

  const dateStr = getDateString();
  const fileName = `BrowserBaseTypography-posters-${dateStr}.jpg`;

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    posterSuppressCaret = false;
    renderPosterCanvas();
  }, 'image/jpeg', 0.95);
}

// ═══════════════════════════════════════════════════════════
//  ROUND TABLE WRITING
// ═══════════════════════════════════════════════════════════
// Pass-the-keyboard writing session. Each participant types 1–2 lines
// using the custom font. After their turn, only the NEXT participant
// can see what they wrote. When the round table ends, all entries
// become readable in a two-column A4-landscape "reading view", and
// can be exported as a print-imposed double-sided booklet PDF.

const ROUND_TABLE_DEFAULT_PARTICIPANTS = 6;

// Allowed participant counts are 4n - 2 (6, 10, 14). Each printed A4
// sheet folds into four A5 booklet pages, and the first and last logical
// pages are always the prompts page and the thank-you page, so only
// 4n - 2 entries fill the sheets with no blank pages. Two would also fit
// but is too few for a round table, so six is the floor.
const RT_MIN_PARTICIPANTS = 6;
const RT_MAX_PARTICIPANTS = 14;

function snapRtParticipantCount(n) {
  if (!Number.isFinite(n)) return ROUND_TABLE_DEFAULT_PARTICIPANTS;
  n = Math.min(RT_MAX_PARTICIPANTS, Math.max(RT_MIN_PARTICIPANTS, n));
  // Nearest value of the form 4k - 2.
  return Math.round((n + 2) / 4) * 4 - 2;
}

// Canonical A5-portrait coordinate space used by every round-table canvas:
// writing area, previous-entry preview, reading view tiles, and booklet PDF
// pages all lay out chars in this logical space and scale uniformly to the
// destination canvas. Keeping a single coord system means an entry composed
// during a turn looks identical wherever it's later displayed.
const RT_WRITING_PROMPTS = [
  'What if you could hold the internet in your hand?',
  'Turn “scrolling” into a physical action.',
  'Make a notification you can touch but cannot see.',
  'What would a “like” feel like as an object?',
  'Turn an online habit into something your hands have to do.',
  'Make an object that becomes harder to use the more time you spend online.',
  'Translate an internet gesture—swipe, tap, zoom, refresh—into a physical mechanism.',
  'Imagine a search engine operated entirely by hand.',
  'Create a physical object that stores a digital memory.',
  'What happens when something instant online becomes slow and physical?'
];

// Heading on the booklet's closing page. Newlines are hard line breaks;
// each line still word-wraps if the page is too narrow for it.
const RT_THANK_YOU_TITLE =
  'Thank you for participating in From Hand to Font.\n' +
  'We hope you had splendid typographic experience!';

// Shown on the thank-you page for writers who left the credit blank.
const RT_ANONYMOUS_CREDIT = 'wish not to credit';

const RT_A5_W = 1485;   // logical pixels (A4-landscape canvas is 2970 wide)
const RT_A5_H = 2100;

const RT_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const roundTable = {
  phase: 'setup',                 // 'setup' | 'writing' | 'complete'
  participantCount: ROUND_TABLE_DEFAULT_PARTICIPANTS,
  when: '',                       // e.g. '12 September 2026 · 3:30 PM'
  currentTurn: 0,                 // 0-indexed; equals entries.length while writing
  entries: []                     // [{ chars: [{glyphKey, size, color, kernAdjust, yOffset}], credit }]
};

// Per-turn typing state — reset each turn.
let rtCurrentChars = [];
let rtCurrentCaret = 0;
let rtCurrentFontSize = 120;
// Bounds and one-press step for the round table's default font size.
const RT_FONT_SIZE_MIN = 40;
const RT_FONT_SIZE_MAX = 300;
const RT_FONT_SIZE_STEP = 10;
let rtCurrentCredit = '';       // optional participant credit for this page

// Participant credit, set in true 10pt for the printed A5 page: the
// canonical A5 logical space is RT_A5_W × RT_A5_H px for 148 × 210 mm
// (= 10 px/mm), and 1pt = 25.4/72 mm.
const RT_CREDIT_PT = 20;
const RT_CREDIT_PX = RT_CREDIT_PT * (25.4 / 72) * (RT_A5_H / 210);

// Draws the credit line at the bottom-right of an A5 page. `scale` is the
// factor between the canonical A5 logical space and the destination rect,
// so the credit stays 10pt whether it's the large composition canvas, the
// compact previous-entry preview, or a booklet PDF page.
function drawRtCredit(ctx, credit, rightX, baselineY, scale) {
  if (!credit) return;
  ctx.save();
  ctx.fillStyle = '#888888';
  ctx.textAlign = 'right';
  ctx.font = `400 ${RT_CREDIT_PX * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(credit, rightX, baselineY);
  ctx.restore();
}

// Reading-view paging: 0-indexed spread the user is currently looking at.
let rtReadingSpreadIdx = 0;
let rtSelectionStart = null;   // null = no selection; otherwise char index
let rtSelectionEnd = null;
let rtIsDragging = false;      // true between mousedown and mouseup

function hasRtSelection() {
  return rtSelectionStart !== null && rtSelectionEnd !== null &&
         rtSelectionStart !== rtSelectionEnd;
}

function getRtSelectionRange() {
  return [Math.min(rtSelectionStart, rtSelectionEnd),
          Math.max(rtSelectionStart, rtSelectionEnd)];
}

function clearRtSelection() {
  rtSelectionStart = null;
  rtSelectionEnd = null;
}

function deleteRtSelection() {
  if (!hasRtSelection()) return false;
  const [s, e] = getRtSelectionRange();
  rtCurrentChars.splice(s, e - s);
  rtCurrentCaret = s;
  clearRtSelection();
  return true;
}

// Prefills the date/time fields with the current moment, so running a
// workshop today needs no typing — but the facilitator can still set any
// date and time (e.g. when preparing a booklet after the fact).
function prefillRtWhen() {
  const now = new Date();
  let hour = now.getHours();
  const meridiem = hour < 12 ? 'AM' : 'PM';
  hour = hour % 12;
  if (hour === 0) hour = 12;

  document.getElementById('rtDay').value = now.getDate();
  document.getElementById('rtMonth').value = RT_MONTH_NAMES[now.getMonth()];
  document.getElementById('rtYear').value = now.getFullYear();
  document.getElementById('rtHour').value = hour;
  document.getElementById('rtMinute').value = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('rtMeridiem').value = meridiem;
}

// Reads the setup fields into the single line printed on the closing
// page. Blank or out-of-range values are simply left out rather than
// blocking the round table from starting.
function readRtWhen() {
  const num = (id, min, max) => {
    const v = parseInt(document.getElementById(id).value, 10);
    return (Number.isFinite(v) && v >= min && v <= max) ? v : null;
  };

  const day = num('rtDay', 1, 31);
  const month = document.getElementById('rtMonth').value;
  const year = num('rtYear', 2000, 2100);
  const hour = num('rtHour', 1, 12);
  const minute = num('rtMinute', 0, 59);
  const meridiem = document.getElementById('rtMeridiem').value;

  const datePart = [day, month, year].filter(v => v !== null && v !== '').join(' ');
  const timePart = (hour !== null && minute !== null)
    ? `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`
    : '';

  return [datePart, timePart].filter(Boolean).join('  ·  ');
}

function setupRoundTable() {
  prefillRtWhen();
  document.getElementById('rtStartBtn').addEventListener('click', startRoundTable);
  document.getElementById('rtEndNowBtn').addEventListener('click', () => {
    if (confirm('End the round table now? Remaining turns will be skipped.')) {
      enterCompletePhase();
    }
  });
  document.getElementById('rtSubmitBtn').addEventListener('click', submitTurn);
  document.getElementById('rtCreditInput').addEventListener('input', (e) => {
    rtCurrentCredit = e.target.value;
    redrawRtCurrentCanvas();
  });
  document.getElementById('rtClearBtn').addEventListener('click', () => {
    rtCurrentChars = [];
    rtCurrentCaret = 0;
    clearRtSelection();
    redrawRtCurrentCanvas();
    updateRtCurrentPlaceholder();
  });
  document.getElementById('rtExportPdfBtn').addEventListener('click', exportRoundTableBookletPdf);
  document.getElementById('rtNewRoundBtn').addEventListener('click', () => {
    resetRoundTable();
    showRtView('setup');
  });

  // Reading-view pager
  document.getElementById('rtPrevSpreadBtn').addEventListener('click', () => gotoRtSpread(-1));
  document.getElementById('rtNextSpreadBtn').addEventListener('click', () => gotoRtSpread(1));

  // Keyboard arrow keys page through spreads while the complete view is
  // active. Skip when the user is in an input field so it doesn't
  // hijack typing in the participant-count box.
  document.addEventListener('keydown', (e) => {
    if (roundTable.phase !== 'complete') return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); gotoRtSpread(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); gotoRtSpread(1); }
  });

  setupRtCurrentCanvas();
  setupRtPreviousCanvas();
  setupRtReadingCanvas();

  // Default font size — the size of *future* characters. Already-typed
  // glyphs keep their stored size so a mid-turn change doesn't reflow
  // what's been composed; those are edited with Char size instead.
  const sizeLabel = document.getElementById('rtFontSizeLabel');
  const stepRtFontSize = (delta) => {
    rtCurrentFontSize = Math.min(RT_FONT_SIZE_MAX,
                                 Math.max(RT_FONT_SIZE_MIN, rtCurrentFontSize + delta));
    sizeLabel.textContent = `${rtCurrentFontSize}px`;
    redrawRtCurrentCanvas();
  };
  // Sync the label to the default picked above (in case the HTML and JS
  // defaults ever drift apart).
  sizeLabel.textContent = `${rtCurrentFontSize}px`;
  document.getElementById('rtFontSizeUpBtn').addEventListener('click', () => {
    stepRtFontSize(RT_FONT_SIZE_STEP);
  });
  document.getElementById('rtFontSizeDownBtn').addEventListener('click', () => {
    stepRtFontSize(-RT_FONT_SIZE_STEP);
  });

  // Per-glyph controls (kerning / char size / vertical offset). Each
  // edits the glyph immediately BEFORE the caret, matching how the A4
  // book-cover and poster sections' kerning buttons behave.
  const stepFromCaret = () => {
    const target = rtCurrentChars[rtCurrentCaret - 1];
    return target ? target.size * 0.04 : 4;
  };
  document.getElementById('rtKernUpBtn').addEventListener('click', () => {
    adjustRtKernAtCaret(stepFromCaret());
  });
  document.getElementById('rtKernDownBtn').addEventListener('click', () => {
    adjustRtKernAtCaret(-stepFromCaret());
  });

  document.getElementById('rtSizeUpBtn').addEventListener('click', () => {
    scaleRtSize(CHAR_SIZE_STEP);
  });
  document.getElementById('rtSizeDownBtn').addEventListener('click', () => {
    scaleRtSize(1 / CHAR_SIZE_STEP);
  });

  // Y up = visually higher = more negative yOffset.
  document.getElementById('rtYUpBtn').addEventListener('click', () => {
    moveRtYOffset(-1);
  });
  document.getElementById('rtYDownBtn').addEventListener('click', () => {
    moveRtYOffset(1);
  });

  showRtView('setup');
}

function showRtView(name) {
  document.getElementById('rtSetupView').classList.toggle('hidden', name !== 'setup');
  document.getElementById('rtWritingView').classList.toggle('hidden', name !== 'writing');
  document.getElementById('rtCompleteView').classList.toggle('hidden', name !== 'complete');
}

function startRoundTable() {
  const input = document.getElementById('rtParticipantCount');
  const count = snapRtParticipantCount(parseInt(input.value, 10));
  input.value = count;

  roundTable.phase = 'writing';
  roundTable.participantCount = count;
  roundTable.when = readRtWhen();
  roundTable.currentTurn = 0;
  roundTable.entries = [];

  rtCurrentChars = [];
  rtCurrentCaret = 0;
  rtCurrentCredit = '';
  document.getElementById('rtCreditInput').value = '';
  clearRtSelection();

  showRtView('writing');
  // Writing view was display:none until just now — its canvases reported
  // clientWidth/Height of 0 at setup time, so the actual <canvas> bitmaps
  // are still 0×0. Re-measure now that the view is laid out. Use rAF to
  // give the browser one frame to finish layout after toggling display.
  requestAnimationFrame(() => {
    resizeRtCurrentCanvas();
    resizeRtPreviousCanvas();
    updateRtTurnLabel();
    redrawRtPreviousCanvas();
    redrawRtCurrentCanvas();
    updateRtCurrentPlaceholder();
    // Focus the typing area so user can start immediately. Belt-and-
    // suspenders: rAF + a delayed retry, because clicking the Start
    // button can leave focus in the now-hidden setup view long enough
    // that the first keypress would otherwise be swallowed.
    const frame = document.getElementById('rtCurrentFrame');
    frame.focus();
    setTimeout(() => frame.focus(), 50);
  });
}

function updateRtTurnLabel() {
  const label = document.getElementById('rtTurnLabel');
  label.textContent = `Turn ${roundTable.currentTurn + 1} of ${roundTable.participantCount}`;
}

function submitTurn() {
  if (roundTable.phase !== 'writing') return;
  // Snapshot a deep-ish copy of chars for this entry
  const entry = {
    chars: rtCurrentChars.map(c => ({ ...c })),
    credit: rtCurrentCredit.trim()
  };
  roundTable.entries.push(entry);
  roundTable.currentTurn++;

  // Reset current turn buffer. The credit is per-person, so it clears
  // along with the text before the keyboard is passed on.
  rtCurrentChars = [];
  rtCurrentCaret = 0;
  rtCurrentCredit = '';
  document.getElementById('rtCreditInput').value = '';
  clearRtSelection();

  if (roundTable.currentTurn >= roundTable.participantCount) {
    enterCompletePhase();
    return;
  }

  updateRtTurnLabel();
  // The view is already open, but a window resize between turns could
  // have invalidated dimensions. Cheap to re-check.
  resizeRtCurrentCanvas();
  resizeRtPreviousCanvas();
  redrawRtPreviousCanvas();
  redrawRtCurrentCanvas();
  updateRtCurrentPlaceholder();
  document.getElementById('rtCurrentFrame').focus();
}

function enterCompletePhase() {
  roundTable.phase = 'complete';
  showRtView('complete');
  document.getElementById('rtCompleteTitle').textContent =
    `Round table complete — ${roundTable.entries.length} entr${roundTable.entries.length === 1 ? 'y' : 'ies'}`;
  rtReadingSpreadIdx = 0;
  renderReadingView();
}

function resetRoundTable() {
  roundTable.phase = 'setup';
  roundTable.currentTurn = 0;
  roundTable.entries = [];
  roundTable.when = '';
  rtCurrentChars = [];
  rtCurrentCaret = 0;
  rtCurrentCredit = '';
  const creditInput = document.getElementById('rtCreditInput');
  if (creditInput) creditInput.value = '';
  clearRtSelection();
}

// ── Per-turn typing canvas ────────────────────────────────
// Internal canvas pixels are fixed to the canonical A5 logical space; CSS
// scales the displayed size to fit the frame, which is itself aspect-ratio
// locked to A5 portrait via .rt-a5-frame.
function resizeRtCurrentCanvas() {
  const canvas = document.getElementById('rtCurrentCanvas');
  if (!canvas) return;
  if (canvas.width !== RT_A5_W) canvas.width = RT_A5_W;
  if (canvas.height !== RT_A5_H) canvas.height = RT_A5_H;
  redrawRtCurrentCanvas();
}

function setupRtCurrentCanvas() {
  const frame = document.getElementById('rtCurrentFrame');
  const canvas = document.getElementById('rtCurrentCanvas');

  window.addEventListener('resize', resizeRtCurrentCanvas);

  // Plain click on the frame (e.g., on padding outside canvas) just focuses
  frame.addEventListener('click', () => frame.focus());

  // ── Mouse: click to place caret, drag to select ──
  // Mirrors the "Type with your font" canvas behaviour so users familiar
  // with that surface get the same interactions here.
  canvas.addEventListener('mousedown', (e) => {
    if (roundTable.phase !== 'writing') return;
    e.preventDefault();
    frame.focus();
    const pt = canvasPointFromEvent(canvas, e);
    const idx = findRtCaretAt(pt.x, pt.y);
    rtCurrentCaret = idx;
    rtSelectionStart = idx;
    rtSelectionEnd = idx;
    rtIsDragging = true;
    redrawRtCurrentCanvas();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!rtIsDragging) return;
    const pt = canvasPointFromEvent(canvas, e);
    const idx = findRtCaretAt(pt.x, pt.y);
    rtCurrentCaret = idx;
    rtSelectionEnd = idx;
    redrawRtCurrentCanvas();
  });

  // mouseup listened on window so dragging past the canvas still releases
  window.addEventListener('mouseup', () => {
    if (!rtIsDragging) return;
    rtIsDragging = false;
    if (rtSelectionStart === rtSelectionEnd) clearRtSelection();
    redrawRtCurrentCanvas();
  });

  frame.addEventListener('keydown', (e) => {
    if (roundTable.phase !== 'writing') return;
    const key = e.key;

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      e.preventDefault();
      const dir = key === 'ArrowLeft' ? -1 : 1;
      if (e.shiftKey) {
        if (rtSelectionStart === null) rtSelectionStart = rtCurrentCaret;
        rtCurrentCaret = Math.max(0, Math.min(rtCurrentChars.length, rtCurrentCaret + dir));
        rtSelectionEnd = rtCurrentCaret;
      } else {
        if (hasRtSelection()) {
          const [s, en] = getRtSelectionRange();
          rtCurrentCaret = dir < 0 ? s : en;
        } else {
          rtCurrentCaret = Math.max(0, Math.min(rtCurrentChars.length, rtCurrentCaret + dir));
        }
        clearRtSelection();
      }
      redrawRtCurrentCanvas();
      return;
    }
    if (key === 'Backspace') {
      e.preventDefault();
      if (!deleteRtSelection()) {
        if (rtCurrentCaret > 0) {
          rtCurrentChars.splice(rtCurrentCaret - 1, 1);
          rtCurrentCaret--;
        }
      }
      redrawRtCurrentCanvas();
      updateRtCurrentPlaceholder();
      return;
    }
    if (key === 'Delete') {
      e.preventDefault();
      if (!deleteRtSelection()) {
        if (rtCurrentCaret < rtCurrentChars.length) {
          rtCurrentChars.splice(rtCurrentCaret, 1);
        }
      }
      redrawRtCurrentCanvas();
      updateRtCurrentPlaceholder();
      return;
    }
    if (key === 'Enter') {
      e.preventDefault();
      deleteRtSelection();
      rtCurrentChars.splice(rtCurrentCaret, 0, {
        glyphKey: '\n',
        size: rtCurrentFontSize,
        color: '#000000',
        kernAdjust: 0,
        yOffset: 0
      });
      rtCurrentCaret++;
      redrawRtCurrentCanvas();
      return;
    }
    if (key === 'Tab' || key === 'Shift' || key === 'Meta' || key === 'Control' ||
        key === 'Alt' || key === 'CapsLock' || key.startsWith('F')) return;

    if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'a') {
      e.preventDefault();
      rtSelectionStart = 0;
      rtSelectionEnd = rtCurrentChars.length;
      rtCurrentCaret = rtCurrentChars.length;
      redrawRtCurrentCanvas();
      return;
    }

    if (key.length === 1) {
      e.preventDefault();
      // Typing replaces any active selection (standard editor behaviour).
      deleteRtSelection();
      // Ligature check on the immediately previous char
      if (ligaturesEnabled && rtCurrentCaret > 0) {
        const prev = rtCurrentChars[rtCurrentCaret - 1];
        if (prev && prev.glyphKey !== '\n' && prev.glyphKey !== ' ') {
          const prevGlyph = glyphByKey[prev.glyphKey];
          if (prevGlyph) {
            const combo = prevGlyph.chars.toLowerCase() + key.toLowerCase();
            for (const lig of LIGATURES) {
              if (lig.chars === combo && fontData[lig.key]) {
                rtCurrentChars.splice(rtCurrentCaret - 1, 1, {
                  glyphKey: lig.key,
                  size: rtCurrentFontSize,
                  color: '#000000',
                  kernAdjust: prev.kernAdjust || 0,  // inherit any kerning the user already dialed in
                  yOffset: prev.yOffset || 0
                });
                redrawRtCurrentCanvas();
                updateRtCurrentPlaceholder();
                return;
              }
            }
          }
        }
      }
      const glyphKey = resolveCharToKey(key);
      rtCurrentChars.splice(rtCurrentCaret, 0, {
        glyphKey,
        size: rtCurrentFontSize,
        color: '#000000',
        kernAdjust: 0,
        yOffset: 0
      });
      rtCurrentCaret++;
      redrawRtCurrentCanvas();
      updateRtCurrentPlaceholder();
    }
  });
}

function updateRtCurrentPlaceholder() {
  const ph = document.getElementById('rtCurrentPlaceholder');
  const hasChars = rtCurrentChars.length > 0;
  ph.classList.toggle('hidden', hasChars);
  // Block submitting an empty entry — that's almost always a sign that
  // focus didn't land on the typing area. Disabling the button forces
  // the user to click into the frame and try typing, which exposes any
  // focus problem immediately instead of producing 4 silent empty entries.
  const submitBtn = document.getElementById('rtSubmitBtn');
  if (submitBtn) submitBtn.disabled = !hasChars;
}

function redrawRtCurrentCanvas() {
  const canvas = document.getElementById('rtCurrentCanvas');
  if (!canvas || !canvas.width) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Generous A5-poster style margin (~6% of width on each side).
  const padding = Math.round(W * 0.06);
  const usableW = W - 2 * padding;

  // ── Round number label (default sans-serif) ──
  // Same placement and style as the entry number in the reading view, so
  // what the user sees while composing matches what their entry will
  // look like once the round table ends.
  const labelSize = Math.round(H * 0.030);
  const turnNum = String(roundTable.currentTurn + 1).padStart(2, '0');
  ctx.fillStyle = '#888888';
  ctx.font = `500 ${labelSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(turnNum, padding, padding + labelSize);

  // Text starts below the round number, leaving a comfortable gap.
  const textTopY = padding + labelSize * 1.5;

  // Layout chars with auto-wrap
  const layout = layoutCharsForCanvas(rtCurrentChars, 0, 0, usableW);

  // Selection highlight (rendered BEHIND glyphs so it reads as a
  // background fill the way native text editors do).
  if (hasRtSelection()) {
    const [s, e] = getRtSelectionRange();
    ctx.fillStyle = 'rgba(102, 126, 234, 0.28)';
    for (let i = s; i < e; i++) {
      const tc = rtCurrentChars[i];
      if (tc.glyphKey === '\n') continue;
      const p = layout.positions[i];
      const w = p.advance || tc.size * 0.7;
      ctx.fillRect(padding + p.x, textTopY + p.y, w, tc.size);
    }
  }

  for (let i = 0; i < layout.positions.length; i++) {
    const p = layout.positions[i];
    const tc = rtCurrentChars[i];
    if (tc.glyphKey === '\n' || tc.glyphKey === ' ') continue;
    if (fontData[tc.glyphKey]) {
      drawGlyph(ctx, tc.glyphKey, padding + p.x, textTopY + p.y, tc.size, tc.color);
    } else {
      // Same fallback as the main "Type with your font" canvas: full
      // colour sans-serif so the typist can keep going even if some
      // glyphs haven't been uploaded yet.
      ctx.fillStyle = tc.color;
      ctx.font = `${tc.size}px sans-serif`;
      const label = glyphByKey[tc.glyphKey] ? glyphByKey[tc.glyphKey].label : tc.glyphKey;
      ctx.fillText(label, padding + p.x, textTopY + p.y + tc.size * 0.8);
    }
  }

  // Participant credit, bottom-right — matches where it will sit on the
  // finished page.
  drawRtCredit(ctx, rtCurrentCredit.trim(), W - padding, H - padding, 1);

  // Caret (blink). Caret sits on the *baseline* row, ignoring any
  // per-glyph yOffset so the user can find the cursor reliably even
  // if the previous glyph was floated up or down. Hidden while a
  // selection is active — the highlight serves as the position cue.
  const frame = document.getElementById('rtCurrentFrame');
  const focused = frame === document.activeElement || frame.contains(document.activeElement);
  if (focused && !hasRtSelection() && Math.floor(Date.now() / 500) % 2 === 0) {
    const caretPos = caretPosForRt(layout, rtCurrentCaret);
    ctx.fillStyle = '#667eea';
    ctx.fillRect(padding + caretPos.x - 1, textTopY + caretPos.y, 3, caretPos.size);
  }
}

// Given a click point in canvas coordinates (the canvas is 1485×2100
// logical), find the closest caret slot among rtCurrentChars. Mirrors
// the existing main typing-canvas helper but accounts for the round-
// number label that shifts the text origin down.
function findRtCaretAt(canvasX, canvasY) {
  const canvas = document.getElementById('rtCurrentCanvas');
  if (!canvas) return 0;
  const W = canvas.width;
  const H = canvas.height;
  const padding = Math.round(W * 0.06);
  const labelSize = Math.round(H * 0.030);
  const textTopY = padding + labelSize * 1.5;
  const usableW = W - 2 * padding;

  const layout = layoutCharsForCanvas(rtCurrentChars, 0, 0, usableW);

  // Convert click to text-local coords (origin at start of layout)
  const localX = canvasX - padding;
  const localY = canvasY - textTopY;

  let bestIdx = 0;
  let bestScore = Infinity;

  // Test every possible caret slot (0..length). Same scoring as the
  // main typing canvas: prefer the row the click falls inside.
  for (let i = 0; i <= rtCurrentChars.length; i++) {
    const pos = caretPosForRt(layout, i);
    let yPenalty;
    if (localY >= pos.y && localY <= pos.y + pos.size) yPenalty = 0;
    else yPenalty = Math.abs(localY - (pos.y + pos.size / 2)) * 10;
    const score = yPenalty + Math.abs(pos.x - localX);
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function caretPosForRt(layout, caretIdx) {
  if (rtCurrentChars.length === 0) {
    return { x: 0, y: 0, size: rtCurrentFontSize };
  }
  if (caretIdx <= 0) {
    const p = layout.positions[0];
    return { x: p.x, y: p.y, size: rtCurrentChars[0].size };
  }
  if (caretIdx >= rtCurrentChars.length) {
    // Position after last char
    const last = rtCurrentChars[rtCurrentChars.length - 1];
    const lastP = layout.positions[layout.positions.length - 1];
    if (last.glyphKey === '\n') {
      return { x: 0, y: lastP.y + last.size * 1.4, size: last.size };
    }
    return { x: lastP.x + (lastP.advance || 0), y: lastP.y, size: last.size };
  }
  const p = layout.positions[caretIdx];
  return { x: p.x, y: p.y, size: rtCurrentChars[caretIdx].size };
}

// ── Previous-turn read-only canvas ────────────────────────
function resizeRtPreviousCanvas() {
  const canvas = document.getElementById('rtPreviousCanvas');
  if (!canvas) return;
  if (canvas.width !== RT_A5_W) canvas.width = RT_A5_W;
  if (canvas.height !== RT_A5_H) canvas.height = RT_A5_H;
  redrawRtPreviousCanvas();
}

function setupRtPreviousCanvas() {
  window.addEventListener('resize', resizeRtPreviousCanvas);
}

function redrawRtPreviousCanvas() {
  const canvas = document.getElementById('rtPreviousCanvas');
  const placeholder = document.getElementById('rtPreviousPlaceholder');
  if (!canvas || !canvas.width) return;

  // First turn: no previous
  if (roundTable.currentTurn === 0) {
    placeholder.classList.remove('hidden');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  placeholder.classList.add('hidden');
  const prev = roundTable.entries[roundTable.currentTurn - 1];
  // Auto-pick padding from canvas width (= 6% of A5 logical width).
  renderCharsToCanvas(canvas, prev.chars, undefined, prev.credit);
}

// Caret blink loop for round table writing
setInterval(() => {
  if (roundTable.phase === 'writing') {
    redrawRtCurrentCanvas();
  }
}, 500);

// ── Per-glyph adjustment helpers (kern / size / Y offset) ─
// Each edits the glyph immediately BEFORE the caret. Newlines are
// skipped because they have no visual extent to nudge.

function adjustRtKernAtCaret(delta) {
  if (rtCurrentCaret === 0) return;
  const target = rtCurrentChars[rtCurrentCaret - 1];
  if (!target || target.glyphKey === '\n') return;
  target.kernAdjust = (target.kernAdjust || 0) + delta;
  redrawRtCurrentCanvas();
}

// Scales every selected glyph, or just the one before the caret when
// nothing is selected. Multiplicative so a mixed-size selection keeps its
// relative proportions; the selection survives the press so the buttons
// can be held down to keep growing a word.
function scaleRtSize(factor) {
  const targets = [];
  if (hasRtSelection()) {
    const [start, end] = getRtSelectionRange();
    // Newlines are included: in an empty line their own size sets the
    // line advance, so leaving them behind would strand the spacing.
    for (let i = start; i < end; i++) targets.push(rtCurrentChars[i]);
  } else if (rtCurrentCaret > 0) {
    const target = rtCurrentChars[rtCurrentCaret - 1];
    if (target && target.glyphKey !== '\n') targets.push(target);
  }
  if (targets.length === 0) return;

  for (const target of targets) {
    if (!target) continue;
    // Clamp so glyphs never collapse to nothing.
    target.size = Math.max(20, target.size * factor);
  }
  redrawRtCurrentCanvas();
}

// Lifts or drops every selected glyph, or just the one before the caret
// when nothing is selected. `direction` is -1 for up, +1 for down.
function moveRtYOffset(direction) {
  const targets = [];
  if (hasRtSelection()) {
    const [start, end] = getRtSelectionRange();
    for (let i = start; i < end; i++) {
      const target = rtCurrentChars[i];
      // A newline has no glyph to lift — its size only sets line advance.
      if (target && target.glyphKey !== '\n') targets.push(target);
    }
  } else if (rtCurrentCaret > 0) {
    const target = rtCurrentChars[rtCurrentCaret - 1];
    if (target && target.glyphKey !== '\n') targets.push(target);
  }
  if (targets.length === 0) return;

  // One step for the whole run: scaled per glyph, a mixed-size selection
  // would shear apart instead of moving as a unit. Sizing the step off the
  // biggest glyph keeps a single-size selection identical to moving one.
  const biggest = Math.max(...targets.map(t => t.size));
  const delta = direction * Math.max(4, biggest * 0.08);
  for (const target of targets) {
    target.yOffset = (target.yOffset || 0) + delta;
  }
  redrawRtCurrentCanvas();
}

// ── Layout helper ─────────────────────────────────────────
// Lays chars out left-to-right at (startX, startY), wrapping at maxWidth.
// Returns position per char (top-left of glyph) and the final y after
// the last line. \n forces a hard newline.
//
// Per-char optional fields honoured:
//   kernAdjust — extra horizontal space inserted AFTER this glyph (the
//                pen advance is bumped by this much, so it affects the
//                spacing between this glyph and the next).
//   yOffset    — vertical pixel offset applied to this glyph only. Does
//                not move the layout cursor, so adjacent glyphs keep
//                their normal baseline; only this one floats up/down.
function layoutCharsForCanvas(chars, startX, startY, maxWidth) {
  let cx = startX;
  let cy = startY;
  const positions = [];
  let lineMaxSize = 0;

  for (const tc of chars) {
    if (tc.glyphKey === '\n') {
      positions.push({ x: cx, y: cy, advance: 0, isNewline: true });
      cx = startX;
      cy += (lineMaxSize || tc.size) * 1.4;
      lineMaxSize = 0;
      continue;
    }
    const advance = getGlyphAdvance(tc.glyphKey, tc.size);
    if (cx + advance > startX + maxWidth && cx > startX) {
      cx = startX;
      cy += (lineMaxSize || tc.size) * 1.4;
      lineMaxSize = 0;
    }
    positions.push({
      x: cx,
      y: cy + (tc.yOffset || 0),
      size: tc.size,
      advance
    });
    cx += advance + (tc.kernAdjust || 0);
    if (tc.size > lineMaxSize) lineMaxSize = tc.size;
  }

  return { positions, finalY: cy + (lineMaxSize || 0) };
}

// Render chars into a canvas, scaling to fit if needed. Used for the
// "previous entry" thumbnail — same chars data as the writing canvas,
// so we use the same 6%-of-width margin to keep their relative layouts
// in lock-step. CSS shrinks the canvas to a thumbnail size.
function renderCharsToCanvas(canvas, chars, padding, credit) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  if (padding === undefined) padding = Math.round(W * 0.06);

  // Drawn before the early-out so a credited page still shows its credit
  // even when the writer submitted no text.
  drawRtCredit(ctx, credit, W - padding, H - padding, W / RT_A5_W);

  if (!chars || chars.length === 0) return;

  const usableW = W - 2 * padding;
  const usableH = H - 2 * padding;

  const layout = layoutCharsForCanvas(chars, 0, 0, usableW);
  let layoutW = 0;
  for (const p of layout.positions) {
    const right = p.x + (p.advance || 0);
    if (right > layoutW) layoutW = right;
  }
  const layoutH = layout.finalY * 1.2;

  const scale = Math.min(1, usableW / Math.max(1, layoutW), usableH / Math.max(1, layoutH));

  for (let i = 0; i < layout.positions.length; i++) {
    const p = layout.positions[i];
    const tc = chars[i];
    if (tc.glyphKey === '\n' || tc.glyphKey === ' ') continue;
    const drawX = padding + p.x * scale;
    const drawY = padding + p.y * scale;
    const drawSize = tc.size * scale;
    if (fontData[tc.glyphKey]) {
      drawGlyph(ctx, tc.glyphKey, drawX, drawY, drawSize, tc.color);
    } else {
      ctx.fillStyle = tc.color;
      ctx.font = `${drawSize}px sans-serif`;
      const label = glyphByKey[tc.glyphKey] ? glyphByKey[tc.glyphKey].label : tc.glyphKey;
      ctx.fillText(label, drawX, drawY + drawSize * 0.8);
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  READING VIEW — A4 landscape, vertical split
// ═══════════════════════════════════════════════════════════

function setupRtReadingCanvas() {
  const canvas = document.getElementById('rtReadingCanvas');
  // Sized lazily in renderReadingView: width is one A4 landscape spread
  // (= 2 × A5 portrait), height is one row of spread per pair of entries.
  canvas.width = RT_A5_W * 2;
  canvas.height = RT_A5_H;
}

// Shared renderer for the booklet's two text-only pages — the writing
// prompts at the front and the thank-you list at the back. Draws a serif
// title (word-wrapped, so a long heading keeps its type size) above a
// numbered list with a right-aligned number column.
function renderRtListPage(ctx, title, items, x, y, w, h, padPx, subtitle) {
  const left = x + padPx;
  const right = x + w - padPx;

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  const titleSize = Math.round(h * 0.038);
  ctx.font = `500 ${titleSize}px Georgia, serif`;

  const titleLines = [];
  for (const paragraph of title.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > right - left) {
        titleLines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    titleLines.push(line);
  }

  let ty = y + h * 0.20;
  for (const titleLine of titleLines) {
    ctx.fillText(titleLine, left, ty);
    ty += titleSize * 1.3;
  }

  // Right-aligned number column so the item text lines up.
  const numColW = h * 0.032;
  const numGap = h * 0.016;
  const textLeft = left + numColW + numGap;
  const availW = right - textLeft;
  const itemFont = (size) =>
    `400 ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  // Word-wrap each item at the given size. Long prompts flow onto extra
  // lines rather than forcing the whole list down to whatever size fits
  // the longest one on a single line.
  const wrapItems = (size) => {
    ctx.font = itemFont(size);
    return items.map(text => {
      const lines = [];
      let line = '';
      for (const word of text.split(' ')) {
        const test = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(test).width > availW) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      lines.push(line);
      return lines;
    });
  };

  // Session date and time, set at the start of the round table. It sits
  // in its own band between the title and the list, clear of both.
  if (subtitle) {
    const subSize = Math.round(h * 0.022);
    ty += h * 0.030;
    ctx.fillStyle = '#888888';
    ctx.font = `400 ${subSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(subtitle, left, ty);
    ty += h * 0.020;
  }

  ty += h * 0.026;   // blank line before the list

  // Shrink until the wrapped list fits above the bottom margin (a
  // multi-line title plus a full round table would otherwise push the
  // last items off the page) and no single word overruns the margin.
  const LINE_H = 1.3;    // line advance within one item
  const ITEM_GAP = 0.8;  // extra space after each item
  const availH = (y + h - padPx) - ty;
  const listHeight = (size, lines) =>
    lines.reduce((sum, ls) => sum + ls.length * LINE_H + ITEM_GAP, 0) * size;
  const overruns = (lines) =>
    lines.some(ls => ls.some(l => ctx.measureText(l).width > availW));

  let itemSize = Math.round(h * 0.026);
  let wrapped = wrapItems(itemSize);
  while (itemSize > 8 && (listHeight(itemSize, wrapped) > availH || overruns(wrapped))) {
    itemSize -= 1;
    wrapped = wrapItems(itemSize);
  }

  for (let i = 0; i < wrapped.length; i++) {
    ctx.font = itemFont(itemSize);
    ctx.fillStyle = '#888888';
    ctx.textAlign = 'right';
    ctx.fillText(`${i + 1}.`, left + numColW, ty);
    ctx.fillStyle = '#222222';
    ctx.textAlign = 'left';
    for (const line of wrapped[i]) {
      ctx.fillText(line, textLeft, ty);
      ty += itemSize * LINE_H;
    }
    ty += itemSize * ITEM_GAP;
  }

  ctx.textAlign = 'left';
}

// ── Shared A5-page renderer ───────────────────────────────
// Renders one logical A5 page (cover / entry / credits / blank) into the rect
// (x, y, w, h) on `ctx`. All char layout happens in canonical A5 logical
// coords (RT_A5_W × RT_A5_H); a uniform scale fits it to the destination
// rect so the same composition looks proportional whether it's displayed
// in the on-screen reading view (large) or a booklet PDF page (smaller).
function renderRtA5Page(ctx, page, x, y, w, h) {
  if (!page || page.type === 'blank') return;

  const scale = Math.min(w / RT_A5_W, h / RT_A5_H);
  const padding = Math.round(RT_A5_W * 0.06);
  const padPx = padding * scale;

  // First booklet page: the writing prompts the round table can draw on,
  // rather than a title page. Kept under the 'cover' page type so the
  // booklet imposition in exportRoundTableBookletPdf stays unchanged.
  if (page.type === 'cover') {
    renderRtListPage(ctx, 'Potential writing prompts', RT_WRITING_PROMPTS,
                     x, y, w, h, padPx);
    return;
  }

  // Last booklet page: everyone who wrote, in turn order. Writers who
  // left the credit field blank are listed as anonymous rather than
  // skipped, so the numbering still matches the entry numbering.
  if (page.type === 'credits') {
    const names = roundTable.entries.map(e =>
      (e.credit && e.credit.trim()) ? e.credit.trim() : RT_ANONYMOUS_CREDIT
    );
    renderRtListPage(ctx, RT_THANK_YOU_TITLE, names, x, y, w, h, padPx,
                     roundTable.when);
    return;
  }

  if (page.type !== 'entry') return;

  // Entry number — sans-serif, top-left of the A5 page
  const numSize = Math.round(h * 0.030);
  ctx.fillStyle = '#888888';
  ctx.font = `500 ${numSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const numStr = String(page.index + 1).padStart(2, '0');
  ctx.fillText(numStr, x + padPx, y + padPx + numSize);

  drawRtCredit(ctx, page.entry.credit, x + w - padPx, y + h - padPx, scale);

  // Empty-entry placeholder (defensive)
  if (!page.entry.chars || page.entry.chars.length === 0) {
    const phSize = Math.round(h * 0.020);
    ctx.fillStyle = '#bbb';
    ctx.font = `italic ${phSize}px -apple-system, sans-serif`;
    ctx.fillText('(empty entry)', x + padPx, y + padPx + numSize + phSize * 2);
    return;
  }

  // Entry text laid out at logical A5 coords, then scaled into the
  // destination rect. Using the canonical RT_A5_W as the wrap width
  // keeps every entry's layout deterministic regardless of where it's
  // later rendered.
  const innerWLogical = RT_A5_W - padding * 2;
  const layout = layoutCharsForCanvas(page.entry.chars, 0, 0, innerWLogical);

  // Vertical start: padding + space for the entry-number row.
  const textTopLogical = padding + (numSize / scale) * 1.5;

  for (let i = 0; i < layout.positions.length; i++) {
    const p = layout.positions[i];
    const tc = page.entry.chars[i];
    if (tc.glyphKey === '\n' || tc.glyphKey === ' ') continue;
    const drawX = x + (padding + p.x) * scale;
    const drawY = y + (textTopLogical + p.y) * scale;
    const drawSize = tc.size * scale;
    if (fontData[tc.glyphKey]) {
      drawGlyph(ctx, tc.glyphKey, drawX, drawY, drawSize, tc.color);
    } else {
      ctx.fillStyle = tc.color;
      ctx.font = `${drawSize}px sans-serif`;
      const label = glyphByKey[tc.glyphKey] ? glyphByKey[tc.glyphKey].label : tc.glyphKey;
      ctx.fillText(label, drawX, drawY + drawSize * 0.8);
    }
  }
}

// Reading view shows ONE A4-landscape spread at a time. The user pages
// through the spreads with Prev/Next buttons (or arrow keys). Each spread
// shows two consecutive entries side-by-side, separated by a fold guide.
function renderReadingView() {
  const canvas = document.getElementById('rtReadingCanvas');
  const ctx = canvas.getContext('2d');

  const entries = roundTable.entries;
  const spreadCount = getRtSpreadCount();

  // Clamp the pager in case entries shrunk (e.g. after Start new round).
  if (rtReadingSpreadIdx < 0) rtReadingSpreadIdx = 0;
  if (rtReadingSpreadIdx >= spreadCount) rtReadingSpreadIdx = spreadCount - 1;

  // One spread per canvas — fixed dimensions, no vertical stacking.
  canvas.width = RT_A5_W * 2;
  canvas.height = RT_A5_H;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const s = rtReadingSpreadIdx;
  const leftIdx = s * 2;
  const rightIdx = s * 2 + 1;

  if (leftIdx < entries.length) {
    renderRtA5Page(ctx, {
      type: 'entry', entry: entries[leftIdx], index: leftIdx
    }, 0, 0, RT_A5_W, RT_A5_H);
  }
  if (rightIdx < entries.length) {
    renderRtA5Page(ctx, {
      type: 'entry', entry: entries[rightIdx], index: rightIdx
    }, RT_A5_W, 0, RT_A5_W, RT_A5_H);
  }

  // Centre fold-line guide
  ctx.strokeStyle = '#dddddd';
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(RT_A5_W, 60);
  ctx.lineTo(RT_A5_W, RT_A5_H - 60);
  ctx.stroke();
  ctx.setLineDash([]);

  updateRtReadingNav();
}

function getRtSpreadCount() {
  return Math.max(1, Math.ceil(roundTable.entries.length / 2));
}

function updateRtReadingNav() {
  const spreadCount = getRtSpreadCount();
  const prevBtn = document.getElementById('rtPrevSpreadBtn');
  const nextBtn = document.getElementById('rtNextSpreadBtn');
  const indicator = document.getElementById('rtSpreadIndicator');
  if (prevBtn) prevBtn.disabled = rtReadingSpreadIdx <= 0;
  if (nextBtn) nextBtn.disabled = rtReadingSpreadIdx >= spreadCount - 1;
  if (indicator) {
    indicator.textContent = `Spread ${rtReadingSpreadIdx + 1} / ${spreadCount}`;
  }
}

function gotoRtSpread(delta) {
  const spreadCount = getRtSpreadCount();
  const next = Math.max(0, Math.min(spreadCount - 1, rtReadingSpreadIdx + delta));
  if (next === rtReadingSpreadIdx) return;
  rtReadingSpreadIdx = next;
  renderReadingView();
}

// ═══════════════════════════════════════════════════════════
//  BOOKLET PDF EXPORT (saddle-stitch imposition)
// ═══════════════════════════════════════════════════════════
// Each PDF page = one printed side of a sheet = two booklet pages
// (left + right halves of an A4 landscape sheet). When the user
// prints these double-sided (flip on long edge), stacks the sheets
// with PDF page 1 on top, folds the stack in half, the pages read
// in order 1..N.
//
// Imposition for N booklet pages (multiple of 4), sheet k (1..N/4):
//   front: [left = N - 2(k-1),     right = 2(k-1) + 1]
//   back:  [left = 2(k-1) + 2,     right = N - 2(k-1) - 1]
// (page numbers are 1-indexed.)

async function exportRoundTableBookletPdf() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF library failed to load. Please refresh the page.');
    return;
  }
  if (roundTable.entries.length === 0) {
    alert('No entries to export.');
    return;
  }

  const btn = document.getElementById('rtExportPdfBtn');
  btn.disabled = true;
  const oldText = btn.textContent;
  btn.textContent = 'Generating PDF…';

  try {
    // Build logical pages
    const logicalPages = [
      { type: 'cover' },
      ...roundTable.entries.map((e, i) => ({ type: 'entry', entry: e, index: i }))
    ];
    // Pad BEFORE the thank-you page so it always lands on the booklet's
    // last page instead of being followed by blanks.
    while ((logicalPages.length + 1) % 4 !== 0) logicalPages.push({ type: 'blank' });
    logicalPages.push({ type: 'credits' });
    const N = logicalPages.length;
    const numSheets = N / 4;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const PAGE_W_MM = 297;
    const PAGE_H_MM = 210;

    // Render canvas DPI: 200 px/inch → ~78.74 px/cm → ~7.87 px/mm
    // Use 8 px/mm for clean numbers → 2376 × 1680
    const PX_PER_MM = 8;
    const SHEET_W_PX = PAGE_W_MM * PX_PER_MM;
    const SHEET_H_PX = PAGE_H_MM * PX_PER_MM;

    let isFirstPage = true;
    for (let s = 0; s < numSheets; s++) {
      // 1-indexed logical page numbers; convert to 0-indexed for array.
      const frontLeft  = (N - 2 * s) - 1;
      const frontRight = (2 * s + 1) - 1;
      const backLeft   = (2 * s + 2) - 1;
      const backRight  = (N - 2 * s - 1) - 1;

      // Front side
      if (!isFirstPage) doc.addPage();
      isFirstPage = false;
      const frontCanvas = renderBookletSheetSide(
        logicalPages[frontLeft], logicalPages[frontRight],
        SHEET_W_PX, SHEET_H_PX
      );
      const frontJpg = frontCanvas.toDataURL('image/jpeg', 0.92);
      doc.addImage(frontJpg, 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM);

      // Back side
      doc.addPage();
      const backCanvas = renderBookletSheetSide(
        logicalPages[backLeft], logicalPages[backRight],
        SHEET_W_PX, SHEET_H_PX
      );
      const backJpg = backCanvas.toDataURL('image/jpeg', 0.92);
      doc.addImage(backJpg, 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM);
    }

    doc.save(`round-table-booklet-${getDateString()}.pdf`);
  } catch (err) {
    console.error('PDF export failed:', err);
    alert('PDF export failed. Check console for details.');
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

// Renders one printed side of a sheet: two booklet pages side by side
// on an A4-landscape canvas, with a faint dashed fold line down the
// centre to guide the user when folding.
function renderBookletSheetSide(leftPage, rightPage, W, H) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Left half
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W / 2, H);
  ctx.clip();
  renderRtA5Page(ctx, leftPage, 0, 0, W / 2, H);
  ctx.restore();

  // Right half
  ctx.save();
  ctx.beginPath();
  ctx.rect(W / 2, 0, W / 2, H);
  ctx.clip();
  renderRtA5Page(ctx, rightPage, W / 2, 0, W / 2, H);
  ctx.restore();

  // Fold guide — two short 5mm ticks at the top and bottom of the fold
  // rather than a full-height rule, so the finished booklet isn't marked
  // down its centre. The sheet is A4 landscape (210mm tall), so the
  // px-per-mm factor comes straight off the canvas height.
  //
  // The x sits on a half-pixel so the stroke lands inside a single pixel
  // column. Centred on a whole pixel it straddles two columns at half
  // coverage each, which washes a short tick out to near-white once the
  // sheet is JPEG-compressed and printed.
  const pxPerMm = H / 210;
  const tick = 5 * pxPerMm;
  const foldX = Math.floor(W / 2) + 0.5;
  ctx.strokeStyle = '#aaaaaa';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(foldX, 0);
  ctx.lineTo(foldX, tick);
  ctx.moveTo(foldX, H - tick);
  ctx.lineTo(foldX, H);
  ctx.stroke();
  ctx.setLineDash([]);

  return canvas;
}

// (renderBookletPage was replaced by the shared renderRtA5Page helper,
// which is also used by the on-screen reading view so both surfaces stay
// in lock-step.)
