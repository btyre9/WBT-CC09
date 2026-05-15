#!/usr/bin/env node
/**
 * generate-slides.js
 * Reads storyboard/course.md and generates production-ready HTML slide files.
 *
 * Usage:
 *   node scripts/generate-slides.js [--storyboard storyboard/course.md] [--force]
 *
 * Outputs:
 *   course/slides/{SLIDE_ID}.html        — one per slide (skipped if exists, unless --force)
 *   course/data/course.data.json         — rewrites slides[] + quiz; preserves meta
 *   course/data/kc-review.json           — KC slide ID → review slide array map
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    storyboard: path.join('storyboard', 'course.md'),
    slidesDir:  path.join('course', 'slides'),
    dataDir:    path.join('course', 'data'),
    templatesDir: path.join('scripts', 'templates'),
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--storyboard') args.storyboard  = argv[++i];
    if (argv[i] === '--slides-dir') args.slidesDir   = argv[++i];
    if (argv[i] === '--force')      args.force        = true;
  }
  return args;
}

// ---------------------------------------------------------------------------
// Image catalog — reads the JPEG library and exposes aspect ratios so the
// parser can pick a contextually appropriate fallback image when a slide
// doesn't specify Image-File or specifies a not-yet-created production image.
// ---------------------------------------------------------------------------

// Read width/height from a JPEG file by walking SOF markers in the header.
// Returns { width, height, ratio } or null if the file isn't a parseable JPEG.
function getJpegDimensions(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xFF) return null;
      const marker = buf[i + 1];
      // SOF markers (0xC0–0xCF), excluding DHT (0xC4), JPG (0xC8), DAC (0xCC)
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        const height = buf.readUInt16BE(i + 5);
        const width  = buf.readUInt16BE(i + 7);
        return { width, height, ratio: width / height };
      }
      const segLen = buf.readUInt16BE(i + 2);
      i += 2 + segLen;
    }
    return null;
  } catch (_) {
    return null;
  }
}

function loadImageCatalog(imagesDir) {
  if (!fs.existsSync(imagesDir)) return [];
  const files = fs.readdirSync(imagesDir).filter(f => {
    if (!/\.jpe?g$/i.test(f) || /^placeholder\./i.test(f)) return false;
    // Draft placeholders should come from descriptive catalog assets, not
    // from final production slide names like 1S03.jpg or 1S03a.jpg.
    if (/^(?:1S\d{2}[a-z]?|2KC\d{2}|3FQ\d{2}|3FQ-SCORE)\.jpe?g$/i.test(f)) return false;
    return true;
  });
  return files
    .map(filename => {
      const dim = getJpegDimensions(path.join(imagesDir, filename));
      return dim ? { filename, ...dim } : null;
    })
    .filter(Boolean);
}

// Preferred aspect ratio per template. Templates not listed default to 4:3.
//   16:9 ≈ 1.78  wide hero/background
//   4:3  ≈ 1.33  default content/inline
//   3:4  ≈ 0.75  portrait rail
const TEMPLATE_PREFERRED_RATIO = {
  'hero-title':                     16/9,
  'hero-title-left':                16/9,
  'hotspot':                        16/9,
  'video-scenario':                 16/9,
  'content-stat':                   16/9,
  'closing':                        16/9,
  'accordion-content':              4/5,
  'accordion-content-image-left':   4/5,
  'tab-panel':                      4/3,
  'card-explore':                   4/3,
  'tile-explore':                   4/3,
  'content-split':                  4/3,
  'content-bullets':                4/3,
  'content-quote':                  4/3,
  'learning-objectives':            3/4,
  'step-sequence':                  4/3,
  'bar-chart-modal':                4/3,
};

const MAIN_IMAGE_TEMPLATES = new Set([
  'hero-title',
  'hero-title-left',
  'hotspot',
  'video-scenario',
  'content-stat',
  'closing',
  'accordion-content',
  'accordion-content-image-left',
  'content-split',
  'content-bullets',
  'content-quote',
  'learning-objectives',
  'knowledge-check',
  'step-sequence',
  'bar-chart-modal',
]);

const IMAGE_SLOT_RATIO = {
  'card-explore:card': 1,
  'tab-panel:item': 4/3,
};

// Pick an image from the catalog whose ratio is closest to the template's
// preferred ratio. The choice is intentionally random within the closest
// matches so regenerated draft slides get visual variety while staying close
// to the shape the template needs.
function pickImageForTemplate(catalog, templateId, slotKey) {
  if (!catalog.length) return null;
  const preferred = IMAGE_SLOT_RATIO[slotKey] || TEMPLATE_PREFERRED_RATIO[templateId] || (4 / 3);
  // Sort by closeness to preferred ratio
  const sorted = catalog.slice().sort((a, b) =>
    Math.abs(a.ratio - preferred) - Math.abs(b.ratio - preferred)
  );
  // Take the top-3 closest matches (or all if fewer) and pick one randomly.
  // The pool of 3 gives variety while still respecting aspect ratio.
  const poolSize = Math.min(3, sorted.length);
  const pool     = sorted.slice(0, poolSize);
  return pool[Math.floor(Math.random() * pool.length)];
}

function resolveImagePath(slide, imageField, templateId, imageCatalog, options = {}) {
  const imageFile = slide[imageField];
  const imagesDir = path.resolve('course', 'assets', 'images');

  if (imageFile && fs.existsSync(path.join(imagesDir, imageFile))) {
    return `../assets/images/${imageFile}`;
  }

  const picked = imageCatalog && imageCatalog.length
    ? pickImageForTemplate(imageCatalog, templateId, options.slotKey)
    : null;

  if (picked) {
    slide._autoPickedImages = slide._autoPickedImages || [];
    slide._autoPickedImages.push({
      field: imageField,
      requested: imageFile || null,
      ...picked,
    });
    return `../assets/images/${picked.filename}`;
  }

  if (imageFile) {
    slide._missingImages = slide._missingImages || [];
    slide._missingImages.push({ field: imageField, requested: imageFile });
    return `../assets/images/${imageFile}`;
  }

  return '../assets/images/placeholder.jpg';
}

// ---------------------------------------------------------------------------
// Parse storyboard/course.md
// ---------------------------------------------------------------------------

function parseCourseMd(mdPath) {
  const text  = fs.readFileSync(mdPath, 'utf8');
  const lines = text.split('\n');

  let courseTitle = 'Untitled Course';
  const slides    = [];
  let current     = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === '---') continue;

    // Course title line: "# Course: Module Name"
    const courseTitleMatch = line.match(/^#\s+Course:\s*(.+)$/i);
    if (courseTitleMatch) {
      courseTitle = courseTitleMatch[1].trim();
      continue;
    }

    // Slide heading: "## Slide 01 — Title"
    if (line.startsWith('## ')) {
      if (current) slides.push(current);
      current = { _heading: line.slice(3).trim() };
      continue;
    }

    if (!current) continue;

    // Stage directions (ignored)
    if (line.startsWith('>>')) continue;

    // Key: Value lines
    const colon = line.indexOf(':');
    if (colon > 0) {
      const key   = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim();
      if (current[key] !== undefined) {
        // Continuation — append
        current[key] += ' ' + value;
      } else {
        current[key] = value;
      }
    }
  }

  if (current) slides.push(current);

  // Normalise slide entries
  slides.forEach((slide, idx) => {
    slide['Slide-ID']    = slide['Slide-ID']    || `slide_${String(idx + 1).padStart(2, '0')}`;
    slide['Template-ID'] = slide['Template-ID'] || 'content-split';
    slide['Slide-Title'] = slide['Slide-Title'] || slide._heading || `Slide ${idx + 1}`;
  });

  return { courseTitle, slides };
}

// ---------------------------------------------------------------------------
// Build audio VO path from Slide-ID
// Returns path relative to the SLIDE file (e.g. "../assets/audio/vo/SLD_XX01_001_INTRO.mp3")
// and player path (no leading ../) used in course.data.json
// ---------------------------------------------------------------------------

function resolveAudioPaths(slideId) {
  // Detect separator from the slide ID:
  //   underscore format: SLD_CC02_001 → SLD_CC02_001_INTRO.mp3
  //   hyphen format:     SLD-CC02-001 → SLD-CC02-001-INTRO.mp3
  const sep      = slideId.includes('_') ? '_' : '-';
  const fileName = slideId + sep + 'INTRO.mp3';
  return {
    slidePath:  '../assets/audio/vo/' + fileName,
    playerPath: 'assets/audio/vo/'    + fileName,
  };
}

// ---------------------------------------------------------------------------
// Extract CLICK trigger labels from a slide's Voiceover-CLICK-* keys
// Returns [ { label: "CardOne", audioSlide: "../assets/audio/..." }, ... ]
// ---------------------------------------------------------------------------

function extractClickTriggers(slide, slideId) {
  const sep      = slideId.includes('_') ? '_' : '-';
  const triggers = [];
  for (const [key] of Object.entries(slide)) {
    const m = key.match(/^Voiceover-CLICK-(.+)$/);
    if (!m) continue;
    const label = m[1];
    triggers.push({
      label,
      audioPath: `../assets/audio/vo/${slideId}${sep}CLICK${sep}${label}.mp3`,
    });
  }
  return triggers;
}

// ---------------------------------------------------------------------------
// Learning-objectives items (learning-objectives template — Slide 02 of every module)
//   - Each objective is a <div> with a unique element id so the script can
//     animate them individually via GSAP and time-based emphasis cues.
//   - OBJECTIVES_IDS_JS emits a JS array literal of those element ids.
//   - VO_CUE_TIMES_JS emits a JS array of per-objective cue times (seconds
//     from INTRO audio start). Missing cues become Infinity so the
//     animation never fires for that objective until VO-Cue-N is written
//     (by `npm run extract-vo-cues`).
// ---------------------------------------------------------------------------
function collectObjectives(slide) {
  const items = [];
  for (let i = 1; i <= 10; i++) {
    const text = slide[`Objective-${i}`];
    if (!text) break;
    items.push({ n: i, text });
  }
  return items;
}

function objectiveElementId(slideId, n) {
  return `obj-${slideId}-${String(n).padStart(2, '0')}`;
}

function buildLearningObjectivesHtml(slide, slideId) {
  const items = collectObjectives(slide);
  if (!items.length) {
    return '        <!-- No Objective-N fields found in storyboard for this slide. -->';
  }
  return items.map(({ n, text }) => {
    const id  = objectiveElementId(slideId, n);
    const num = String(n).padStart(2, '0');
    return (
      `        <div class="anim-scale-up" id="${id}"\n` +
      `          style="display: flex; align-items: flex-start; gap: 20px; color: white;">\n` +
      `          <span style="flex-shrink: 0; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid #D5001C; font-size: 18px; font-weight: 700; color: #D5001C;">${num}</span>\n` +
      `          <span style="font-size: 22px; line-height: 32px; font-weight: 400;">${escHtml(text)}</span>\n` +
      `        </div>`
    );
  }).join('\n');
}

function buildObjectivesIdsJs(slide, slideId) {
  const items = collectObjectives(slide);
  if (!items.length) return '[]';
  return '[' + items.map(({ n }) => `'${objectiveElementId(slideId, n)}'`).join(', ') + ']';
}

function buildVoCueTimesJs(slide) {
  const items = collectObjectives(slide);
  if (!items.length) return '[]';
  // Missing cues become Infinity so the cue never fires (rather than 0,
  // which would fire immediately on slide load).
  const values = items.map(({ n }) => {
    const raw = slide[`VO-Cue-${n}`];
    if (raw === undefined || raw === '' || raw === 'null') return 'Infinity';
    const num = parseFloat(raw);
    return Number.isFinite(num) ? num.toFixed(2) : 'Infinity';
  });
  return '[' + values.join(', ') + ']';
}

// ---------------------------------------------------------------------------
// Card items (card-explore template)
// ---------------------------------------------------------------------------

function buildCardsHtml(triggers, slide, imageCatalog) {
  const letters = ['01', '02', '03', '04', '05', '06'];
  return triggers.map((t, idx) => {
    const num   = letters[idx] || String(idx + 1).padStart(2, '0');
    const title = camelToWords(t.label);
    const imageField = `Card-Image-${t.label}`;
    const imagePath = resolveImagePath(slide, imageField, 'card-explore', imageCatalog, { slotKey: 'card-explore:card' });
    return (
      `      <div class="explore-card pds-card" data-card="${escAttr(t.label)}" id="card-${escAttr(t.label)}" tabindex="0" role="button" aria-label="Explore ${escAttr(title)}">\n` +
      `        <figure class="card-media"><img src="${escAttr(imagePath)}" alt=""></figure>\n` +
      `        <div class="card-number">${num}</div>\n` +
      `        <div class="card-title">${escHtml(title)}</div>\n` +
      `        <div class="card-body"><!-- Add card detail content here --></div>\n` +
      `        <div class="card-chip">Explore &rarr;</div>\n` +
      `      </div>`
    );
  }).join('\n');
}

function buildCardAudioMap(triggers) {
  const entries = triggers.map(t => `  '${t.label}': '${t.audioPath}'`);
  return '{\n' + entries.join(',\n') + '\n}';
}

// ---------------------------------------------------------------------------
// Accordion items (accordion-content template)
// Per-item body comes from `Item-<Label>-Body` storyboard fields; if absent,
// emits a placeholder comment so the author can fill in by editing the slide.
// Inline HTML is allowed in the body field (e.g. <ul class="acc-bullets">).
// ---------------------------------------------------------------------------

function buildAccordionItemsHtml(triggers, slide) {
  if (!triggers.length) return '<!-- No Voiceover-CLICK-<Label> fields found in storyboard for this slide. -->';
  return triggers.map((t, idx) => {
    const num   = String(idx + 1).padStart(2, '0');
    const label = camelToWords(t.label);
    const bodyField = slide[`Item-${t.label}-Body`];
    const body = bodyField
      ? bodyField
      : `<p><!-- Body for ${label}: add Item-${t.label}-Body to course.md, or edit this slide directly. --></p>`;
    return (
      `    <article class="acc-item" data-item="${escAttr(t.label)}" role="listitem">\n` +
      `      <button class="acc-header" type="button" aria-expanded="false" aria-controls="body-${escAttr(t.label)}">\n` +
      `        <span class="acc-number">${num}</span>\n` +
      `        <span class="acc-label">${escHtml(label)}</span>\n` +
      `        <span class="acc-chev" aria-hidden="true">\n` +
      `          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>\n` +
      `        </span>\n` +
      `      </button>\n` +
      `      <div class="acc-body-wrap">\n` +
      `        <div class="acc-body" id="body-${escAttr(t.label)}" role="region">\n` +
      `          <div class="acc-body-inner">\n` +
      `            ${body}\n` +
      `          </div>\n` +
      `        </div>\n` +
      `      </div>\n` +
      `    </article>`
    );
  }).join('\n');
}

// ---------------------------------------------------------------------------
// Hotspot markers + popovers (hotspot template)
// Generates two HTML chunks from the same Voiceover-CLICK-<Label> triggers:
//   - markers: <button class="hotspot"> elements positioned via Item-<Label>-Pos
//   - popovers: <aside class="popover"> blocks with body content
// Per-hotspot storyboard fields:
//   Voiceover-CLICK-<Label>   (required — VO trigger + audio path)
//   Item-<Label>-Body         (required — popover body HTML)
//   Item-<Label>-Pos          (required — "X%,Y%" marker position on background)
//   Item-<Label>-Title        (optional — popover heading; falls back to camelToWords(label))
//   Item-<Label>-Eyebrow      (optional — small red category label above title)
//   Item-<Label>-Side         (optional — "left"|"right"; auto-derived from X%
//                              when omitted: X > 50% → popover opens left,
//                              X ≤ 50% → popover opens right)
// ---------------------------------------------------------------------------

function parseHotspotPos(posStr) {
  // Accepts "30%,42%" or "30,42" or "30% , 42%" — returns { x: "30%", y: "42%", xNum: 30 }
  if (!posStr) return { x: '50%', y: '50%', xNum: 50 };
  const parts = String(posStr).split(',').map(s => s.trim());
  const x = parts[0] || '50%';
  const y = parts[1] || '50%';
  const xNum = parseFloat(String(x).replace('%', '')) || 50;
  return {
    x: /%$/.test(x) ? x : (x + '%'),
    y: /%$/.test(y) ? y : (y + '%'),
    xNum,
  };
}

function buildHotspotMarkersHtml(triggers, slide) {
  if (!triggers.length) return '      <!-- No Voiceover-CLICK-<Label> fields found in storyboard for this slide. -->';
  const checkSvg =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12 10 17 19 7"></polyline></svg>`;
  return triggers.map((t, idx) => {
    const num   = String(idx + 1).padStart(2, '0');
    const label = camelToWords(t.label);
    const pos   = parseHotspotPos(slide[`Item-${t.label}-Pos`]);
    return (
      `      <button class="hotspot" type="button" data-hs="${escAttr(t.label)}" aria-label="${escAttr(label)} — open detail" style="--hs-x: ${pos.x}; --hs-y: ${pos.y};">\n` +
      `        <span class="hotspot-dot">\n` +
      `          <span class="hotspot-number">${num}</span>\n` +
      `          <span class="hotspot-check" aria-hidden="true">${checkSvg}</span>\n` +
      `        </span>\n` +
      `      </button>`
    );
  }).join('\n');
}

function buildHotspotPopoversHtml(triggers, slide) {
  if (!triggers.length) return '';
  return triggers.map((t, idx) => {
    const num     = String(idx + 1).padStart(2, '0');
    const label   = camelToWords(t.label);
    const pos     = parseHotspotPos(slide[`Item-${t.label}-Pos`]);
    const bodyField = slide[`Item-${t.label}-Body`];
    const body = bodyField
      ? bodyField
      : `<p><!-- Body for ${label}: add Item-${t.label}-Body to course.md, or edit this slide directly. --></p>`;
    const titleOverride = slide[`Item-${t.label}-Title`];
    const title    = titleOverride ? titleOverride : label;
    const eyebrow  = slide[`Item-${t.label}-Eyebrow`] || '';
    const sideOverride = slide[`Item-${t.label}-Side`];
    // Auto-derive side from X position if not specified
    const side = sideOverride
      ? sideOverride
      : (pos.xNum > 50 ? 'left' : 'right');
    const eyebrowMarkup = eyebrow
      ? `        <div class="popover-eyebrow">${num} &middot; ${escHtml(eyebrow)}</div>\n`
      : `        <div class="popover-eyebrow">${num}</div>\n`;
    return (
      `      <aside class="popover" data-popover="${escAttr(t.label)}" data-side="${side}" role="dialog" aria-label="${escAttr(label)} — detail" style="--hs-x: ${pos.x}; --hs-y: ${pos.y};" hidden>\n` +
      `        <button class="popover-close" type="button" aria-label="Close">\n` +
      `          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>\n` +
      `        </button>\n` +
      eyebrowMarkup +
      `        <h2 class="popover-title">${escHtml(title)}</h2>\n` +
      `        <div class="popover-body">\n` +
      `          ${body}\n` +
      `        </div>\n` +
      `      </aside>`
    );
  }).join('\n');
}

// ---------------------------------------------------------------------------
// Tab-panel items (tab-panel template)
// Generates two HTML chunks from the same Voiceover-CLICK-<Label> triggers:
//   - tabs: <button class="tab"> elements with number, label, visited check
//   - panels: <section class="panel"> elements with body content
// First tab/panel is pre-marked `is-active visited` so the slide loads with
// one tab already showing — visited count starts at 1.
// Panel body comes from `Item-<Label>-Body` storyboard field (same convention
// as accordion-content); HTML is allowed.
// ---------------------------------------------------------------------------

function buildTabPanelTabsHtml(triggers) {
  if (!triggers.length) return '<!-- No Voiceover-CLICK-<Label> fields found in storyboard for this slide. -->';
  const checkSvg =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12 10 17 19 7"></polyline></svg>`;
  return triggers.map((t, idx) => {
    const num    = String(idx + 1).padStart(2, '0');
    const label  = camelToWords(t.label);
    const isFirst = idx === 0;
    const cls    = isFirst ? 'tab is-active visited' : 'tab';
    const ariaSelected = isFirst ? 'true' : 'false';
    return (
      `      <button class="${cls}" type="button" role="tab" aria-selected="${ariaSelected}" data-tab="${escAttr(t.label)}" aria-controls="panel-${escAttr(t.label)}">\n` +
      `        <span class="tab-number">${num}</span>\n` +
      `        <span class="tab-label">${escHtml(label)}</span>\n` +
      `        <span class="tab-check" aria-hidden="true">${checkSvg}</span>\n` +
      `      </button>`
    );
  }).join('\n');
}

function buildTabPanelPanelsHtml(triggers, slide, imageCatalog) {
  if (!triggers.length) return '';
  return triggers.map((t, idx) => {
    const label = camelToWords(t.label);
    const isFirst = idx === 0;
    const cls    = isFirst ? 'panel is-active' : 'panel';
    const hidden = isFirst ? '' : ' hidden=""';
    const bodyField = slide[`Item-${t.label}-Body`];
    const body = bodyField
      ? bodyField
      : `<p><!-- Body for ${label}: add Item-${t.label}-Body to course.md, or edit this slide directly. --></p>`;
    // Optional per-panel image — Item-<Label>-Image: <filename in assets/images/>
    const imageFile = slide[`Item-${t.label}-Image`];
    const gridClass = imageFile ? 'panel-grid has-media' : 'panel-grid';
    const imagePath = imageFile
      ? resolveImagePath(slide, `Item-${t.label}-Image`, 'tab-panel', imageCatalog, { slotKey: 'tab-panel:item' })
      : null;
    const mediaHtml = imageFile
      ? `\n          <figure class="panel-media">\n            <img src="${escAttr(imagePath)}" alt="">\n          </figure>`
      : '';
    return (
      `      <section class="${cls}" id="panel-${escAttr(t.label)}" data-panel="${escAttr(t.label)}" role="tabpanel"${hidden}>\n` +
      `        <div class="${gridClass}">\n` +
      `          <div class="panel-text">\n` +
      `            ${body}\n` +
      `          </div>${mediaHtml}\n` +
      `        </div>\n` +
      `      </section>`
    );
  }).join('\n');
}

// ---------------------------------------------------------------------------
// Choice items (KC / FQ templates)
// ---------------------------------------------------------------------------

function buildChoicesHtml(slide, templateId) {
  if (templateId === 'knowledge-check') {
    return buildKCChoicesHtml(slide);
  }
  // final-quiz and others: numeric data-choice format
  const choiceClass = templateId === 'final-quiz' ? 'fq-choice' : 'kc-choice';
  const letterClass = templateId === 'final-quiz' ? 'fq-choice-letter' : 'kc-choice-letter';
  const textClass   = templateId === 'final-quiz' ? 'fq-choice-text' : 'kc-choice-text';
  const letters     = ['A', 'B', 'C', 'D'];
  const items       = [];

  for (let i = 1; i <= 4; i++) {
    const text = slide[`Choice-${i}`] || `Choice ${i}`;
    items.push(
      `      <div class="${choiceClass}" data-choice="${i}" role="button" tabindex="0">\n` +
      `        <span class="${letterClass}">${letters[i - 1]}</span>\n` +
      `        <span class="${textClass}">${escHtml(text)}</span>\n` +
      `      </div>`
    );
  }
  return items.join('\n');
}

// KC choices: .option-row format with data-correct="true" on the correct item.
// JS in the template shuffles rows and re-assigns A–D labels at runtime.
function buildKCChoicesHtml(slide) {
  const letters    = ['A', 'B', 'C', 'D'];
  const correctIdx = (parseInt(slide['Correct-Answer'], 10) || 1) - 1; // 0-based
  const items      = [];

  for (let i = 0; i < 4; i++) {
    const text      = slide[`Choice-${i + 1}`] || `Choice ${i + 1}`;
    const correct   = i === correctIdx ? ' data-correct="true"' : '';
    items.push(
      `      <div class="option-row"${correct} data-value="${letters[i]}" role="radio" aria-checked="false" tabindex="0">\n` +
      `        <div class="option-row__letter">${letters[i]}</div>\n` +
      `        <span class="option-row__text">${escHtml(text)}</span>\n` +
      `      </div>`
    );
  }
  return items.join('\n');
}

// ---------------------------------------------------------------------------
// Stat value / label split
// e.g. "94% Customer Satisfaction" → { value: "94%", label: "Customer Satisfaction" }
// e.g. "Service excellence starts here" → { value: slide title, label: text }
// ---------------------------------------------------------------------------

function splitStat(onScreenText, slideTitle) {
  if (!onScreenText) return { value: slideTitle, label: '' };
  const m = onScreenText.match(/^(\d[\d,.%×x]*)\s+(.+)$/);
  if (m) return { value: m[1], label: m[2] };
  return { value: onScreenText, label: '' };
}

// ---------------------------------------------------------------------------
// FQ question number (count FQ slides seen so far, excluding SCORE slide)
// ---------------------------------------------------------------------------

function fqQuestionNumber(allSlides, currentSlideId) {
  let count = 0;
  for (const s of allSlides) {
    const id = s['Slide-ID'] || '';
    if (!/^FQ[_-]/i.test(id)) continue;
    if (/[_-]SCORE$/i.test(id)) continue;
    count++;
    if (id === currentSlideId) break;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Template rendering
// ---------------------------------------------------------------------------

function renderTemplate(html, tokens) {
  return html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(tokens, key) ? tokens[key] : match;
  });
}

// ---------------------------------------------------------------------------
// Build token map for a slide
// ---------------------------------------------------------------------------

function buildTokens(slide, allSlides, courseTitle, templateHtml, imageCatalog) {
  const slideId     = slide['Slide-ID'];
  const templateId  = slide['Template-ID'];
  const slideTitle  = slide['Slide-Title'] || slideId;
  const onScreen    = slide['On-Screen-Text'] || slideTitle;

  // Image fallback: for templates with a main image slot, use an existing
  // Image-File when it exists; otherwise choose a catalog image whose aspect
  // ratio fits the template. This lets draft storyboards use production-style
  // names like 1S01.jpg before those final assets exist.
  const imagePath = MAIN_IMAGE_TEMPLATES.has(templateId)
    ? resolveImagePath(slide, 'Image-File', templateId, imageCatalog)
    : '';

  const { value: statValue, label: statLabel } = splitStat(onScreen, slideTitle);
  const clicks = extractClickTriggers(slide, slideId);

  // content-quote tokens
  const quoteText            = slide['Quote']              || onScreen;
  const quoteAttributionName = slide['Quote-Attribution']  || '<!-- Attribution name -->';
  const quoteAttributionTitle= slide['Quote-Title']        || '<!-- Attribution title / role -->';

  // hero-title subtitle: explicit field or second | segment of On-Screen-Text
  const onScreenParts = (slide['On-Screen-Text'] || '').split('|');
  const heroSubtitle  = slide['Hero-Subtitle'] || (onScreenParts[1] ? onScreenParts[1].trim() : '');

  // Pull-Quote: optional field — if present, replaces body copy in content-split with a pc-pull-quote
  const pullQuoteText = slide['Pull-Quote'];
  let bodyContentHtml;
  if (pullQuoteText) {
    bodyContentHtml = `<pc-pull-quote class="anim-fade-right" style="--anim-delay: 0.35s;" text="${escAttr(pullQuoteText)}"></pc-pull-quote>`;
  } else {
    bodyContentHtml = `<p class="pds-body anim-fade-right" style="--anim-delay: 0.35s;">${escHtml(onScreen)}</p>`;
  }

  // Intro paragraph above the objectives list. Falls back to On-Screen-Text
  // (matches the doc example which uses On-Screen-Text for the
  // "By the end of this module..." sentence).
  const introText = slide['Intro-Text'] || onScreen;

  const tokens = {
    SLIDE_ID:       slideId,
    SLIDE_TITLE:    escHtml(slideTitle),
    ON_SCREEN_TEXT: escHtml(onScreen),
    HERO_SUBTITLE:  escHtml(heroSubtitle),
    MODULE_LABEL:   escHtml(courseTitle),
    IMAGE_PATH:     imagePath,
    // Stat template
    STAT_VALUE:     escHtml(statValue),
    STAT_LABEL:     escHtml(statLabel),
    // Quote template
    QUOTE_TEXT:               escHtml(quoteText),
    QUOTE_ATTRIBUTION_NAME:   escHtml(quoteAttributionName),
    QUOTE_ATTRIBUTION_TITLE:  escHtml(quoteAttributionTitle),
    // learning-objectives template
    OBJECTIVES_HTML:    buildLearningObjectivesHtml(slide, slideId),
    INTRO_TEXT:         escHtml(introText),
    OBJECTIVES_IDS_JS:  buildObjectivesIdsJs(slide, slideId),
    VO_CUE_TIMES_JS:    buildVoCueTimesJs(slide),
    // Card-explore template
    CARDS_HTML:      templateId === 'card-explore' ? buildCardsHtml(clicks, slide, imageCatalog) : '',
    CARD_AUDIO_MAP:  buildCardAudioMap(clicks),
    TOTAL_CARDS:     String(clicks.length || 3),
    // Accordion-content template (reuses CARD_AUDIO_MAP + TOTAL_CARDS for VO)
    ACCORDION_ITEMS_HTML: buildAccordionItemsHtml(clicks, slide),
    // Tab-panel template (also reuses CARD_AUDIO_MAP + TOTAL_CARDS)
    TAB_PANEL_TABS_HTML:   buildTabPanelTabsHtml(clicks),
    TAB_PANEL_PANELS_HTML: templateId === 'tab-panel' ? buildTabPanelPanelsHtml(clicks, slide, imageCatalog) : '',
    // Hotspot template (also reuses CARD_AUDIO_MAP + TOTAL_CARDS)
    HOTSPOT_MARKERS_HTML:  buildHotspotMarkersHtml(clicks, slide),
    HOTSPOT_POPOVERS_HTML: buildHotspotPopoversHtml(clicks, slide),
    // content-split body — pull quote or plain body copy
    BODY_CONTENT_HTML: bodyContentHtml,
    // KC / FQ templates
    QUESTION_TEXT:   escHtml(slide['Question'] || ''),
    CHOICES_HTML:    buildChoicesHtml(slide, templateId),
    CORRECT_ANSWER:  String(parseInt(slide['Correct-Answer'], 10) || 1),
    REVIEW_SLIDE:    slide['Review-Slide'] || '',
    QUESTION_NUMBER: String(fqQuestionNumber(allSlides, slideId)),
  };

  return tokens;
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function camelToWords(str) {
  // "CardOne" → "Card One" | "BatteryOverview" → "Battery Overview"
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Validate storyboard
  const sbPath = path.resolve(args.storyboard);
  if (!fs.existsSync(sbPath)) {
    console.error(`Error: storyboard not found — ${sbPath}`);
    console.error('Run: npm run import-storyboard -- --docx <file.docx>');
    process.exit(1);
  }

  console.log(`\nGenerating slides from: ${path.basename(sbPath)}`);
  console.log('─'.repeat(60));

  const { courseTitle, slides } = parseCourseMd(sbPath);
  console.log(`Course: ${courseTitle}  |  Slides: ${slides.length}\n`);

  // Load image catalog once — used to auto-pick aspect-ratio-appropriate
  // images for slides that don't specify Image-File.
  const imagesDir = path.resolve('course', 'assets', 'images');
  const imageCatalog = loadImageCatalog(imagesDir);
  if (imageCatalog.length) {
    console.log(`Image catalog: ${imageCatalog.length} images indexed from ${path.relative('.', imagesDir)}\n`);
  } else {
    console.log(`Image catalog: empty — slides without Image-File will reference placeholder.jpg\n`);
  }

  // Ensure output directories exist
  fs.mkdirSync(path.resolve(args.slidesDir), { recursive: true });
  fs.mkdirSync(path.resolve(args.dataDir),   { recursive: true });

  let written = 0;
  let skipped = 0;
  let errors  = 0;

  // Collect KC review map and FQ question IDs while iterating
  const kcReviewMap = {};
  const fqQuestionIds = [];

  for (const slide of slides) {
    const slideId    = slide['Slide-ID'];
    const templateId = slide['Template-ID'];
    const outPath    = path.resolve(args.slidesDir, slideId + '.html');

    // Track KC review map
    if (/^KC[_-]/i.test(slideId) && slide['Review-Slide']) {
      kcReviewMap[slideId] = [slide['Review-Slide']];
    }

    // Track FQ question slides (not SCORE)
    if (/^FQ[_-]/i.test(slideId) && !/[_-]SCORE$/i.test(slideId)) {
      fqQuestionIds.push(slideId);
    }

    // Skip if exists and not forced
    if (!args.force && fs.existsSync(outPath)) {
      console.log(`  SKIP   ${slideId}.html  (exists — use --force to overwrite)`);
      skipped++;
      continue;
    }

    // Load template
    const templatePath = path.resolve(args.templatesDir, templateId + '.html');
    if (!fs.existsSync(templatePath)) {
      console.warn(`  WARN   ${slideId} — template not found: ${templateId}.html — using content-split`);
      const fallbackPath = path.resolve(args.templatesDir, 'content-split.html');
      if (!fs.existsSync(fallbackPath)) {
        console.error(`  ERROR  ${slideId} — fallback template also missing`);
        errors++;
        continue;
      }
    }

    let templateHtml;
    try {
      const tplFile = fs.existsSync(templatePath)
        ? templatePath
        : path.resolve(args.templatesDir, 'content-split.html');
      templateHtml = fs.readFileSync(tplFile, 'utf8');
    } catch (err) {
      console.error(`  ERROR  ${slideId} — could not read template: ${err.message}`);
      errors++;
      continue;
    }

    // Build tokens and render
    const tokens   = buildTokens(slide, slides, courseTitle, templateHtml, imageCatalog);
    const rendered = renderTemplate(templateHtml, tokens);

    // Write slide file
    try {
      fs.writeFileSync(outPath, rendered, 'utf8');
      const tplLabel = templateId.padEnd(18);
      console.log(`  WRITE  ${tplLabel}  →  ${slideId}.html`);
      if (slide._autoPickedImages) {
        for (const pick of slide._autoPickedImages) {
          const r = pick.ratio.toFixed(2);
          const requested = pick.requested ? ` for missing ${pick.field}=${pick.requested}` : ` for ${pick.field}`;
          console.log(`         auto-image: ${pick.filename} (${pick.width}×${pick.height}, ratio ${r})${requested}`);
        }
      }
      if (slide._missingImages) {
        for (const missing of slide._missingImages) {
          console.warn(`         WARN image missing and no catalog fallback available: ${missing.field}=${missing.requested}`);
        }
      }
      written++;
    } catch (err) {
      console.error(`  ERROR  ${slideId} — write failed: ${err.message}`);
      errors++;
    }
  }

  // ── Update course.data.json ───────────────────────────────────────────────

  const dataPath = path.resolve(args.dataDir, 'course.data.json');
  let existing   = { meta: {}, slides: [] };
  if (fs.existsSync(dataPath)) {
    try { existing = JSON.parse(fs.readFileSync(dataPath, 'utf8')); }
    catch (_) {}
  }

  // Preserve meta; update module title if meta.title is placeholder
  if (!existing.meta) existing.meta = {};
  if (!existing.meta.title || existing.meta.title === 'Module Title Here') {
    existing.meta.title = courseTitle;
  }

  // Build slides array
  existing.slides = slides.map(slide => {
    const slideId = slide['Slide-ID'];
    const entry = {
      id:       slideId,
      title:    slide['Slide-Title'] || slideId,
      audio_vo: resolveAudioPaths(slideId).playerPath,
    };
    return entry;
  });

  // Build quiz section
  existing.quiz = {
    final_quiz: {
      passing_score: existing.quiz?.final_quiz?.passing_score ?? 80,
      questions: fqQuestionIds,
    }
  };

  fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  console.log(`\n✓ course.data.json  (${slides.length} slides, ${fqQuestionIds.length} FQ questions)`);

  // ── Write kc-review.json ──────────────────────────────────────────────────

  const kcPath = path.resolve(args.dataDir, 'kc-review.json');
  fs.writeFileSync(kcPath, JSON.stringify(kcReviewMap, null, 2) + '\n', 'utf8');
  const kcCount = Object.keys(kcReviewMap).length;
  console.log(`✓ kc-review.json    (${kcCount} KC slide${kcCount !== 1 ? 's' : ''})`);

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log('\n' + '─'.repeat(60));
  console.log(`Written: ${written}  |  Skipped: ${skipped}  |  Errors: ${errors}`);

  if (written > 0) {
    console.log('\nNext steps:');
    console.log('  1. Review generated slides in course/slides/');
    console.log('  2. Fill in placeholder content (card bodies, body copy, images)');
    console.log('  3. npm run start-player  →  http://localhost:8080');
  }

  if (errors > 0) process.exit(1);
}

main().catch(err => { console.error(err.message); process.exit(1); });
