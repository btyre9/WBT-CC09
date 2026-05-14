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
// Objective items
// ---------------------------------------------------------------------------

function buildObjectivesHtml(slide) {
  const items = [];
  for (let i = 1; i <= 10; i++) {
    const text = slide[`Objective-${i}`];
    if (!text) break;
    const num = String(i).padStart(2, '0');
    items.push(
      `      <li class="obj-item">\n` +
      `        <span class="obj-number">${num}</span>\n` +
      `        <span class="obj-text">${escHtml(text)}</span>\n` +
      `      </li>`
    );
  }
  if (items.length === 0) {
    // Placeholder items for authoring
    for (let i = 1; i <= 3; i++) {
      const num = String(i).padStart(2, '0');
      items.push(
        `      <li class="obj-item">\n` +
        `        <span class="obj-number">${num}</span>\n` +
        `        <span class="obj-text"><!-- Objective ${i}: replace with actual objective --></span>\n` +
        `      </li>`
      );
    }
  }
  return items.join('\n');
}

// ---------------------------------------------------------------------------
// Card items (card-explore template)
// ---------------------------------------------------------------------------

function buildCardsHtml(triggers, slide) {
  const letters = ['01', '02', '03', '04', '05', '06'];
  return triggers.map((t, idx) => {
    const num   = letters[idx] || String(idx + 1).padStart(2, '0');
    const title = escHtml(slide[`Card-Title-${t.label}`] || camelToWords(t.label));
    const sig   = slide[`Card-Sig-${t.label}`] ? `        <div class="card-sig">${escHtml(slide[`Card-Sig-${t.label}`])}</div>\n` : '';
    const rawBullets = slide[`Card-Bullets-${t.label}`];
    let bodyHtml;
    if (rawBullets) {
      const lis = rawBullets.split('|').map(b => `          <li>${escHtml(b.trim())}</li>`).join('\n');
      bodyHtml = `        <ul class="card-bullets">\n${lis}\n        </ul>`;
    } else {
      bodyHtml = `        <div class="card-body"></div>`;
    }
    return (
      `      <div class="explore-card pds-card" data-card="${escAttr(t.label)}" id="card-${escAttr(t.label)}" tabindex="0" role="button" aria-label="Explore ${escAttr(title)}">\n` +
      `        <div class="card-number">${num}</div>\n` +
      `        <div class="card-title">${title}</div>\n` +
      sig +
      bodyHtml + '\n' +
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

function buildVoTimesArray(slide) {
  const times = [];
  for (let i = 1; i <= 10; i++) {
    const val = slide[`VO-Cue-${i}`];
    if (!val) break;
    times.push(parseFloat(val));
  }
  if (times.length === 0) return 'null';
  return JSON.stringify(times);
}

function buildMatchData(slide) {
  const pairs = [];
  for (let i = 1; i <= 20; i++) {
    const item   = slide[`Match-${i}-Item`];
    const target = slide[`Match-${i}-Target`];
    if (!item || !target) break;
    pairs.push({ id: String(i), item: item, target: target });
  }
  return JSON.stringify(pairs);
}

function countMatchPairs(slide) {
  let count = 0;
  for (let i = 1; i <= 20; i++) {
    if (!slide[`Match-${i}-Item`]) break;
    count++;
  }
  return count;
}

function buildTabPanelsHtml(slide, slideId) {
  const tabs = [];
  for (const [key] of Object.entries(slide)) {
    const m = key.match(/^Voiceover-TAB-(.+)$/);
    if (!m) continue;
    const label = m[1];
    tabs.push(label);
  }
  return tabs;
}

function buildTabPanelsHtmlToken(slide) {
  const tabLabels = buildTabPanelsHtml(slide, slide['Slide-ID'] || '');
  if (tabLabels.length === 0) return '';
  const items = tabLabels.map((label, idx) => {
    const num = String(idx + 1);
    return (
      `        <li data-step="${escAttr(label)}"><span>${num}</span>${escHtml(camelToWords(label))}</li>`
    );
  });
  return (
    `      <ul class="progress-list anim" aria-label="Visited steps">\n` +
    items.join('\n') + '\n' +
    `      </ul>`
  );
}

function buildTabNamesJson(slide) {
  const tabLabels = buildTabPanelsHtml(slide, slide['Slide-ID'] || '');
  return JSON.stringify(tabLabels);
}

function buildTabButtonsHtml(slide, slideId) {
  const sep = slideId.includes('_') ? '_' : '-';
  const labels = [];
  for (const [key] of Object.entries(slide)) {
    const m = key.match(/^Voiceover-TAB-(.+)$/);
    if (m) labels.push(m[1]);
  }
  return labels.map((label, i) => {
    const audioPath = `../assets/audio/vo/${slideId}${sep}TAB${sep}${label}.mp3`;
    const displayText = camelToWords(label);
    const tabindex = i === 0 ? '0' : '-1';
    return `      <button class="tab-btn" data-tab="${escAttr(label)}" data-audio="${escAttr(audioPath)}" role="tab" aria-selected="false" tabindex="${tabindex}">${escHtml(displayText)}</button>`;
  }).join('\n');
}

function buildTabBodyPanelsHtml(slide) {
  const labels = [];
  for (const [key] of Object.entries(slide)) {
    const m = key.match(/^Voiceover-TAB-(.+)$/);
    if (m) labels.push(m[1]);
  }
  return labels.map((label, i) => {
    const num = String(i + 1).padStart(2, '0');
    const body = escHtml(slide[`Tab-Body-${label}`] || '');
    return (
      `      <div class="tab-panel" id="panel-${escAttr(label)}" role="tabpanel">\n` +
      `        <span class="tab-panel__step-num" aria-hidden="true">${num}</span>\n` +
      `        <p class="tab-panel__body">${body}</p>\n` +
      `      </div>`
    );
  }).join('\n');
}

function buildTabImageMapJson(slide, slideId, defaultImagePath) {
  const sep = slideId.includes('_') ? '_' : '-';
  const labels = [];
  for (const [key] of Object.entries(slide)) {
    const m = key.match(/^Voiceover-TAB-(.+)$/);
    if (m) labels.push(m[1]);
  }
  const map = {};
  labels.forEach(label => {
    const perTab = slide[`Tab-Image-${label}`];
    map[label] = perTab ? `../assets/images/${perTab}` : defaultImagePath;
  });
  return JSON.stringify(map);
}

function buildTokens(slide, allSlides, courseTitle, templateHtml, availableImages) {
  const slideId     = slide['Slide-ID'];
  const templateId  = slide['Template-ID'];
  const slideTitle  = slide['Slide-Title'] || slideId;
  const onScreen    = slide['On-Screen-Text'] || slideTitle;
  const imageFile   = slide['Image-File'];

  // BUG 6: resolve image with fallback from available images
  const specifiedPath = imageFile ? path.resolve('course/assets/images', imageFile) : null;
  let resolvedImageFile;
  if (imageFile && specifiedPath && fs.existsSync(specifiedPath)) {
    resolvedImageFile = imageFile;
  } else if (availableImages && availableImages.length > 0) {
    const idx = allSlides.indexOf(slide) % availableImages.length;
    resolvedImageFile = availableImages[idx];
  } else {
    resolvedImageFile = 'placeholder.webp';
  }
  const imagePath = `../assets/images/${resolvedImageFile}`;
  const imageFileDisplay = imageFile || 'placeholder.webp';

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

  const tokens = {
    SLIDE_ID:       slideId,
    SLIDE_TITLE:    escHtml(slideTitle),
    ON_SCREEN_TEXT: escHtml(onScreen),
    HERO_SUBTITLE:  escHtml(heroSubtitle),
    MODULE_LABEL:   escHtml(courseTitle),
    IMAGE_PATH:     imagePath,
    // BUG 5: IMAGE_FILE token — intended filename for placeholder display
    IMAGE_FILE:     imageFileDisplay || 'placeholder.webp',
    // Stat template
    STAT_VALUE:     escHtml(statValue),
    STAT_LABEL:     escHtml(statLabel),
    // Quote template
    QUOTE_TEXT:               escHtml(quoteText),
    QUOTE_ATTRIBUTION_NAME:   escHtml(quoteAttributionName),
    QUOTE_ATTRIBUTION_TITLE:  escHtml(quoteAttributionTitle),
    // Objectives template
    OBJECTIVES_HTML: buildObjectivesHtml(slide),
    // BUG 5: VO cue tokens for objectives template
    VO_TIMES_ARRAY:  buildVoTimesArray(slide),
    VO_CLEAR_TIME:   slide['VO-Clear-Time'] ? String(parseFloat(slide['VO-Clear-Time'])) : 'null',
    // Card-explore template
    CARDS_HTML:      buildCardsHtml(clicks, slide),
    CARD_AUDIO_MAP:  buildCardAudioMap(clicks),
    TOTAL_CARDS:     String(clicks.length || 3),
    // content-split body — pull quote or plain body copy
    BODY_CONTENT_HTML: bodyContentHtml,
    // KC / FQ templates
    QUESTION_TEXT:   escHtml(slide['Question'] || ''),
    CHOICES_HTML:    buildChoicesHtml(slide, templateId),
    CORRECT_ANSWER:  String(parseInt(slide['Correct-Answer'], 10) || 1),
    REVIEW_SLIDE:    slide['Review-Slide'] || '',
    QUESTION_NUMBER: String(fqQuestionNumber(allSlides, slideId)),
    // BUG 5: drag-match tokens
    MATCH_DATA_JSON: buildMatchData(slide),
    TOTAL_PAIRS:     String(countMatchPairs(slide)),
    MATCH_COL_LEFT:  escHtml(slide['Match-Col-Left']  || 'Terms'),
    MATCH_COL_RIGHT: escHtml(slide['Match-Col-Right'] || 'Definitions'),
    // BUG 5: tab-panel tokens
    TAB_PANELS_HTML:      buildTabPanelsHtmlToken(slide),
    TAB_NAMES_JSON:       buildTabNamesJson(slide),
    // New tab-panel v2 tokens (matching CC08 reference design)
    TAB_BUTTONS_HTML:     buildTabButtonsHtml(slide, slideId),
    TAB_BODY_PANELS_HTML: buildTabBodyPanelsHtml(slide),
    TAB_IMAGE_MAP_JSON:   buildTabImageMapJson(slide, slideId, imagePath),
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

  // BUG 6: Load available images for fallback resolution
  const imagesDir = path.resolve('course/assets/images');
  let availableImages = [];
  if (fs.existsSync(imagesDir)) {
    availableImages = fs.readdirSync(imagesDir)
      .filter(f => /\.(webp|jpg|jpeg|png)$/i.test(f) && f !== 'placeholder.webp');
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
    const tokens   = buildTokens(slide, slides, courseTitle, templateHtml, availableImages);
    const rendered = renderTemplate(templateHtml, tokens);

    // Write slide file
    try {
      fs.writeFileSync(outPath, rendered, 'utf8');
      const tplLabel = templateId.padEnd(18);
      console.log(`  WRITE  ${tplLabel}  →  ${slideId}.html`);
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
