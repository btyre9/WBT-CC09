# Storyboard Authoring Kit

> **Use this doc when:** You're sitting down with learning material (PowerPoint, Content Outline, WBT Info Outline, SME notes, etc.) and need to produce a parser-ready `storyboard/course.md` for a new Porsche WBT module.
>
> **This is a focused, self-contained reference.** It pulls the authoring-relevant content out of [COURSE-RULES.md](COURSE-RULES.md), [STORYBOARD-AUTHOR-PROMPT.md](STORYBOARD-AUTHOR-PROMPT.md), [TEMPLATE-REFERENCE.md](TEMPLATE-REFERENCE.md), [NAMING-CONVENTIONS.md](NAMING-CONVENTIONS.md), and [VOICES.md](VOICES.md) so you can write a complete storyboard without jumping between files. Cross-links point to those source docs when you need more depth.
>
> **Last updated:** 2026-05-14 (adds `accordion-content`, `accordion-content-image-left`, `tab-panel`)

---

## The bar

A reviewer should be able to open any generated slide and see **finished, accurate content** — no placeholder text, no empty layout slots, no missing fields. If a slide needs hand-editing after generation, the storyboard was incomplete.

---

## 1. Module structure — the fixed sequence

Every module follows this exact order. Deviations are not allowed.

| # | Slide | Template | Naming | Notes |
|---|---|---|---|---|
| 1 | Module opener | `hero-title` | `1S01` | Always first |
| 2 | Learning objectives | `objectives` | `1S02` | Always second; 4–6 objectives |
| 3 to N | Content slides | various | `1S03` … `1S50` | 3–5 slides per objective |
| (inserted) | First KC pair | `knowledge-check` | `2KC01`, `2KC02` | Place after a logical topic group |
| more content | (continued) | various | (numbering continues) | |
| (inserted) | Second KC pair | `knowledge-check` | `2KC03`, `2KC04` | Place after the next logical group |
| second-to-last | Closing | `closing` | `1S NN` | Wrap-up before quiz |
| last | Final quiz | `final-quiz` ×10 | `3FQ01` … `3FQ10` | Player draws 5 at random |
| last+1 | Score slide | `quiz-score` | `3FQ-SCORE` | Always last |

**Hard counts** (per COURSE-RULES Q0, Q1, N1):
- **Exactly 4** `knowledge-check` slides per module
- **Exactly 10** `final-quiz` slides per module (2 questions per learning objective × 5 objectives)
- **Maximum 50** `1S*` content slides
- **Exactly 1** of each: `hero-title`, `objectives`, `closing`, `quiz-score`

**Target length:** 15–20 minutes of total VO. Maximum 30. Cut content rather than shortening narration.

---

## 2. Storyboard grammar — non-negotiable rules

### Document header (always at the top)

```
# Course: [Short module title — used in slide eyebrows and data file]
# Player-Title: [Series] - Module [N] - [Full module title]
```

Both lines required. `Player-Title` populates the player's top bar — the series name and module number aren't derivable from anything else.

Example:
```
# Course: Explaining Technical Issues to Non-Technical Customers
# Player-Title: Customer Communications - Module 4 - Explaining Technical Issues to Non-Technical Customers
```

### Slide block format

Each slide is a `## Slide NN — Title` heading followed by `Key: Value` lines.

```
## Slide 03 — The Feature/Function/Benefit Pattern

Slide-ID: 1S03
Template-ID: content-split
Slide-Title: The F/F/B Pattern
On-Screen-Text: Customers don't buy features — they buy outcomes.
Callout-Text: Always end with the benefit. Never start with it.
Image-File: 1S03.jpg
Image: Service advisor explaining a tire to a customer with hands on the tread.
Voiceover-INTRO: When you explain a repair, your customer hears your words through the filter of a single question — what does this mean for me? ...
Caption-Text: When you explain a repair, your customer hears your words through one filter.
Status: Draft
Notes: content-split chosen — single concept with supporting context.
```

### The four rules that fail silently if broken

| Rule | What it means | What happens if you violate it |
|---|---|---|
| **S1 — One field per line** | Every `Key: Value` pair gets its own line. Never put two fields on the same line. | The second field is silently dropped. The slide renders without the missing content; no error. |
| **S2 — Always specify Template-ID** | Don't rely on parser inference. Always write the exact template name. | Wrong template = wrong HTML structure = full rebuild. |
| **S3 — Include every required field** | Every template has a required-field list (see §4). Missing one produces empty layout slots. | Placeholder HTML or empty containers. |
| **S4 — Use canonical field names** | `Voiceover-INTRO`, `Voiceover-CLICK-Label`, `Item-<Label>-Body`, etc. — exact spelling, case-sensitive. | Field silently ignored. |

### Stage directions and section dividers

The parser ignores any line starting with `>>` and any line that's only `---` or whitespace. Use them freely for readability:

```
>> ── Section: Active Listening ──

>> On slide load → 1S07-INTRO.mp3 plays, then cards unlock.
```

---

## 3. Naming conventions (quick reference)

Full spec: [NAMING-CONVENTIONS.md](NAMING-CONVENTIONS.md). What you need while authoring:

### Slide IDs

| Type | Format | Examples |
|---|---|---|
| Standard | `1S` + 2-digit number | `1S01`, `1S14`, `1S50` |
| Knowledge Check | `2KC` + 2-digit number | `2KC01` … `2KC04` |
| Final Quiz | `3FQ` + 2-digit number | `3FQ01` … `3FQ10` |
| Score slide | literal | `3FQ-SCORE` |

- Always 2-digit zero-padded (`01`, not `1`)
- Uppercase prefix (`1S01`, not `1s01`)
- **Never** include the course/module code (`CC08_1S01` is wrong — folder identity carries the module)

### Image filenames (`Image-File` field value)

- One image per slide → `1S03.jpg` (mirrors the Slide-ID, no variant suffix)
- Multiple images → append a lowercase letter: `1S03a.jpg`, `1S03b.jpg`, `1S03c.jpg`
- No underscore or hyphen before the letter
- Always `.jpg`, always lowercase extension

### Audio filenames

You **never write these by hand** — the generator produces them. For reference:
```
1S01-INTRO.mp3              ← slide narration
1S01-CLICK-Feature.mp3      ← card-explore, tab-panel, accordion-content click audio
1S01-STEP-3.mp3             ← step-sequence step audio
2KC01-INTRO.mp3             ← first KC of each pair only (Rule Q0a)
3FQ-SCORE-INTRO.mp3         ← quiz score narration
```

---

## 4. Template catalog

Each entry below gives: **purpose**, **when to pick it**, **required fields**, **optional fields**, **notes**.

Templates are grouped by readiness. `Status: Standard` means the parser fully wires it; `Status: Emerging` means it's custom-built per slide from a reference implementation.

### 4.1 `hero-title` — module opener

**Status:** Standard
**Use when:** Slide 01 of every module. Always.
**Title position:** Centered (only template where the title is centered).

**Required:**
- `Slide-ID: 1S01`
- `Template-ID: hero-title`
- `Slide-Title` — main module heading
- `Hero-Subtitle` — e.g. `Module 3 of 12`
- `Image-File` — `1S01.jpg` (full-bleed hero image, premium and aspirational)
- `Image` — art direction prose
- `Voiceover-INTRO` — 3–5 sentences. Welcome + module purpose + what learner gains. **Do not** list objectives here.
- `Caption-Text` — ≤120 chars; first sentence of INTRO VO

---

### 4.2 `objectives` — learning objectives

**Status:** Standard
**Use when:** Slide 02 of every module. Always.

**Required:**
- `Slide-ID: 1S02`
- `Template-ID: objectives`
- `Slide-Title` — e.g. "What You'll Learn"
- `On-Screen-Text` — e.g. "By the end of this module, you will be able to do five things."
- `Objective-1` … `Objective-N` — verb-first ("Identify…", "Explain…", "Apply…"). 4–6 objectives.
- `Voiceover-INTRO` — one intro sentence + one sentence per objective. Each objective sentence closely echoes the `Objective-N` text for sync.
- `Caption-Text` — ≤120 chars
- `Image-File`, `Image`

**Filled post-VO (don't write by hand):**
- `VO-Cue-1` … `VO-Cue-N` — timestamps written by `npm run extract-vo-cues`
- `VO-Clear-Time` — when last objective finishes

---

### 4.3 `content-split` — single concept + image

**Status:** Standard
**Use when:** One main idea with supporting context. The most common content template.
**Avoid when:** It's a list (→ `content-bullets`), a stat (→ `content-stat`), a quote (→ `content-quote`), or interactive (→ `card-explore` / `tab-panel` / `accordion-content`).

**Required:**
- Standard slide-block headers (`Slide-ID`, `Template-ID`, `Slide-Title`)
- `On-Screen-Text` — 1–3 sentence paragraph
- `Callout-Text` — one sentence; the single most important takeaway. Anchored at the bottom.
- `Image-File`, `Image`
- `Voiceover-INTRO` — 4–7 sentences. Expand on the on-screen text; do not repeat it verbatim.
- `Caption-Text`

**Optional:**
- `Pull-Quote` — replaces `On-Screen-Text` with a large styled key-point statement. **Never use both** — Pull-Quote wins if both present.
- `Callout-Label` — 1–3 word bold label before the callout (e.g. "Remember", "Key Point")

---

### 4.4 `content-bullets` — list of parallel principles

**Status:** Standard
**Use when:** 3–6 parallel principles, steps, or components in list form.

**Required:**
- Standard slide-block headers
- `On-Screen-Text` — 1–2 sentence intro that sets up the list
- `Bullet-1` … `Bullet-N` — 3–6 bullets, complete short phrases, no leading dash
- `Image-File`, `Image`
- `Voiceover-INTRO`, `Caption-Text`

**Optional:**
- `Callout-Text`, `Callout-Label` — same as content-split

---

### 4.5 `content-stat` — single striking statistic

**Status:** Standard
**Use when:** One data point IS the slide.

**Required:**
- Standard slide-block headers
- `On-Screen-Text` — format as `<number> <label>` (e.g. `94% Customer Satisfaction`). The parser splits at the first space-after-digits boundary.
- `Image-File`, `Image`
- `Voiceover-INTRO`, `Caption-Text`

---

### 4.6 `content-quote` — atmospheric quote slide

**Status:** Standard
**Use when:** Brand voice, leadership philosophy, or motivational quote.

**Required:**
- Standard slide-block headers
- `Quote` — the quote text (one sentence or a short pair)
- `Quote-Attribution` — speaker name
- `Quote-Title` — speaker role/title
- `Image-File`, `Image`
- `Voiceover-INTRO`, `Caption-Text`

---

### 4.7 `card-explore` — 3–6 clickable cards, must visit all

**Status:** Standard
**Use when:** 3–6 parallel equally-weighted concepts, all required to advance.
**Interaction:** Cards locked during INTRO. After INTRO ends, each card clickable; clicking plays its VO, marks visited. Next unlocks after all visited.

**Required:**
- Standard slide-block headers
- `On-Screen-Text` — short intro (1 sentence) framing the cards
- `Voiceover-INTRO` — 2–4 sentences setting up the concept; ends with "Click each card to learn more" or similar
- `Caption-Text`
- For each card (N = 3–6 cards):
  - `Voiceover-CLICK-<Label>` — VO that plays on click
  - `Card-Title-<Label>` — card heading
  - `Card-Sig-<Label>` — short signature label (e.g. "Feature", "Function", "Benefit")
  - `Card-Bullets-<Label>` — pipe-separated bullets (e.g. `Bullet 1 | Bullet 2 | Bullet 3`)
  - `Card-Image-<Label>` — `1SNN<a/b/c>.jpg` (optional but recommended)

**`<Label>` rules:**
- PascalCase, no spaces
- Must match exactly across all five fields for the same card (case-sensitive)
- Card order on screen = top-to-bottom order of `Voiceover-CLICK-*` keys in storyboard

---

### 4.8 `tab-panel` — 3–5 named tabs, explore in any order

**Status:** Standard (newly promoted from Emerging, 2026-05-14)
**Use when:** 3–5 named techniques, phases, or topics. First tab is pre-active on load; learner clicks the others to mark each visited.
**Interaction:** All tabs locked during INTRO. After INTRO ends, tabs unlock; first tab counts as pre-visited. Next unlocks after all tabs visited.
**Visual:** Notebook-style outlined tabs at the top of the slide with oversized translucent watermark numbers (01, 02, etc.). Active tab outlined in red and "merges" into the panel area below.

**Required:**
- Standard slide-block headers
- `On-Screen-Text` — short intro framing the tabs
- `Voiceover-INTRO`, `Caption-Text`
- For each tab (3–5 of them):
  - `Voiceover-CLICK-<Label>` — VO that plays on tab click
  - `Item-<Label>-Body` — panel body HTML (paragraph + optional `<ul class="acc-bullets">…</ul>`). HTML is allowed and escaped only where required.

**Optional per-tab:**
- `Item-<Label>-Image` — `<filename>.jpg` from `course/assets/images/` directory. When present, the panel grid switches from full-width text to text + 4:3 image; when absent, text fills the panel.

**`<Label>` rules:** PascalCase, no spaces. Tab order on screen = top-to-bottom order of `Voiceover-CLICK-*` keys.

**Field-naming note:** The per-tab image field is `Item-<Label>-Image` — same family as `Item-<Label>-Body`. (An earlier version of COURSE-RULES Rule S9 referenced `Tab-Image-<Label>`; that doc was updated to match the parser on 2026-05-14.)

---

### 4.9 `accordion-content` — 3–5 stackable expandable rows

**Status:** Standard (new, 2026-05-14)
**Use when:** 3–5 distinct items with body content that the learner reveals one at a time.
**Interaction:** All items closed and locked during INTRO. After INTRO, items unlock; clicking one expands it (closing any other open one), plays its VO, marks it visited (green border). Next unlocks after all visited.
**Visual:** Vertically stacked items with rounded corners, oversized translucent watermark number per row (`01`, `02`, etc.), 3:4 portrait image rail on the right.

**Required:**
- Standard slide-block headers
- `On-Screen-Text` — intro framing
- `Voiceover-INTRO`, `Caption-Text`
- For each item (3–5):
  - `Voiceover-CLICK-<Label>` — VO that plays when the item is expanded
  - `Item-<Label>-Body` — body HTML (paragraph + optional `<ul class="acc-bullets">…</ul>`)
- `Image-File`, `Image` — the right-side 3:4 portrait image

---

### 4.10 `accordion-content-image-left` — mirrored accordion

**Status:** Standard (new, 2026-05-14)
**Use when:** Same use case as `accordion-content` but the visual leads the narrative. The 3:4 portrait sits on the left; the accordion column is on the right.

**Required:** Same fields as `accordion-content`. Only the visual layout flips.

---

### 4.11 `tile-explore` — 3–5 poster tiles

**Status:** Emerging
**Use when:** 3–5 concepts with strong, distinct visual identities. Each tile expands to show content.
**Required:** Refer to [TEMPLATE-REFERENCE.md](TEMPLATE-REFERENCE.md) for the per-slide field list — emerging templates are custom-built.

---

### 4.12 `step-sequence` — required sequential steps

**Status:** Emerging
**Use when:** Process or framework that must be followed in order. Each step is required.
**Per-step fields:** `Voiceover-STEP-NN` (numbered 01, 02, …) and `Step-NN-*` content fields.

---

### 4.13 `hotspot` — clickable markers on a scene

**Status:** Standard (new, 2026-05-14 — fully parser-wired)
**Use when:** 3–5 discovery points anchored to **specific locations** on a single visual. The slide is built around one image, and the content's *spatial relationship to that image* is part of what the learner needs to absorb.

**Strong fit — examples:**
- Parts identification on a vehicle (engine bay components, dashboard controls, suspension geometry)
- Fault location ("where the noise comes from", "where to look for the leak")
- Feature callouts on a Porsche model (PCCB brakes, PASM dampers, PCM screen, key fobs)
- Areas of a service bay or workshop floor that matter for a procedure
- Numbered diagrams from technical documentation — anything that ships with leader lines on a labeled image

**Selection signals in learning materials:**

If the source material includes any of these cues, hotspot is likely the right pick:

| Signal in source content | What it tells you |
|---|---|
| Phrases like "look at…", "identify the…", "locate the…" | Spatial recognition matters → hotspot |
| Numbered/lettered callouts keyed to a single image | Direct hotspot mapping |
| Leader lines pointing from labels to image locations | Direct hotspot mapping |
| Sentences like "the X is here, the Y is over here, and the Z is on the left side" | Spatial relationships are part of the content → hotspot |
| A labeled diagram or technical drawing | Almost always a hotspot candidate |
| Vehicle parts schematics, dashboard layouts, workshop layouts | Hotspot is the default |

**Avoid when** (pick a different template instead):

| If the content is… | Pick this template instead |
|---|---|
| Sequential — steps that must happen in order | `step-sequence` |
| Parallel non-spatial concepts (Feature / Function / Benefit; four pillars; types of customer) | `card-explore` |
| Named techniques or phases that can be explored in any order, not tied to a visual | `tab-panel` |
| Items that need to be matched one-to-one to targets | `drag-match` |
| A single concept with supporting image, where the image is illustrative rather than the structure | `content-split` |
| Comparison of equally-weighted distinct items with strong visual identities | `tile-explore` |

**The deciding question:** *"Would this lose meaning if I removed the image?"* If yes → hotspot. If no → one of the other interactive templates.

**Required (anticipated) fields:**
- Standard slide-block headers
- `Image-File`, `Image` — the background scene image (the foundation of the slide)
- `On-Screen-Text` — short intro framing what the learner should explore
- `Voiceover-INTRO`, `Caption-Text`
- For each hotspot (3–5 of them):
  - `Voiceover-CLICK-<Label>` — VO that plays when the marker is clicked
  - `Item-<Label>-Body` — popover/callout body HTML
  - `Item-<Label>-Pos` — marker position as `X%,Y%` relative to the image (e.g. `42%,68%`)

`<Label>` rules: PascalCase, must match exactly across `Voiceover-CLICK-*`, `Item-<Label>-Body`, and `Item-<Label>-Pos`. Marker click order is left/top → right/bottom following position values, but the storyboard order of `Voiceover-CLICK-*` keys determines the marker numbering (1, 2, 3…).

**Authoring tip — placing markers without the rendered slide:** When the image isn't yet sourced but you're writing the storyboard, estimate positions from a comparable reference image or leave `Item-<Label>-Pos: 50%,50%` and refine after the real asset arrives. The slide renders fine with stacked markers; positions are a layout concern, not a content one.

---

### 4.14 `drag-match` — match items to targets

**Status:** Emerging
**Use when:** Matching terms↔definitions, steps↔descriptions, concepts↔examples.
**Special rule:** Completion plays `bell1.mp3` (Rule A7).

---

### 4.15 `bar-chart-modal` — animated bar chart with detail

**Status:** Emerging
**Use when:** 3–4 data categories where each needs expanded explanation on click.

---

### 4.16 `video-scenario` — video player with optional pause-point quiz

**Status:** Emerging
**Use when:** Scripted scenario or recorded demonstration is the primary content.

---

### 4.17 `knowledge-check` — mid-module comprehension test

**Status:** Standard
**Use when:** Inserted in pairs at logical checkpoints; exactly 4 per module (`2KC01`–`2KC04`).
**Special rules:** See §5 Q0a (intro VO is per-pair, not per-slide) and §5 A6 (submit SFX).

**Required:**
- Standard slide-block headers (`Slide-ID: 2KC0N`, `Template-ID: knowledge-check`)
- `Question` — the question text
- `Choice-1` … `Choice-4` — exactly 4 options
- `Correct-Answer` — the index (1, 2, 3, or 4) of the correct choice
- `Review-Slide` — the `1SNN` slide ID to route to on incorrect answer
- **First KC of each pair only:**
  - `Voiceover-INTRO: Knowledge Check. Select the correct answer.` (exact wording — do not paraphrase)
  - `Caption-Text: Knowledge Check. Select the correct answer.`
- **Second KC of each pair:** Omit both `Voiceover-INTRO` and `Caption-Text`. The player loads it silent.

---

### 4.18 `final-quiz` — end-of-module scored question

**Status:** Standard
**Use when:** End-of-module assessment. Exactly 10 per module (`3FQ01`–`3FQ10`). Player draws 5 at random per attempt.

**Required:**
- Standard slide-block headers (`Slide-ID: 3FQ0N`, `Template-ID: final-quiz`)
- `Question`
- `Choice-1` … `Choice-4`
- `Correct-Answer`

**Hard rules:**
- **No VO, no captions** on `3FQ01`–`3FQ10` (silent assessment flow). Don't author `Voiceover-INTRO` or `Caption-Text`.
- Write **2 questions per learning objective** (5 objectives × 2 = 10). Pairs should approach the same objective from different angles.

---

### 4.19 `closing` — module wrap-up

**Status:** Standard
**Use when:** Last `1S*` content slide before the final quiz.

**Required:** Same as `content-split`: `Slide-Title`, `On-Screen-Text`, `Callout-Text`, `Image-File`, `Image`, `Voiceover-INTRO`, `Caption-Text`.

---

### 4.20 `quiz-score` — final results, SCORM reporting

**Status:** Standard
**Use when:** Always the last slide (`3FQ-SCORE`). One per module.

**Required:**
- `Slide-ID: 3FQ-SCORE`
- `Template-ID: quiz-score`
- `Slide-Title`
- `Voiceover-INTRO` — celebratory wrap-up message
- `Caption-Text`

---

## 5. The five hard rules

These rules govern audio behavior, KC pacing, and SFX consistency. Violating them produces deliverables that fail SCORM Cloud or feel jarring to the learner. They override anything in the template-specific sections above.

### Q0a — KC intro VO is per-pair, not per-slide

KC slides ship in back-to-back pairs (KC01+KC02, KC03+KC04). The intro plays on the **first** KC of each pair only.

**First KC:**
```
Voiceover-INTRO: Knowledge Check. Select the correct answer.
Caption-Text:    Knowledge Check. Select the correct answer.
```
Exact wording — do not paraphrase to "Let's check your understanding…" or similar. Consistency across modules matters.

**Second KC:** Omit both `Voiceover-INTRO` and `Caption-Text` entirely. The player loads it silent.

### A5 — Every VO clip must have a real caption file

Every `.mp3` in `course/assets/audio/vo/` must have a matching `.vtt` in `course/assets/captions/` with **real word-level transcribed text**, not a placeholder. This applies to INTRO, CLICK, TAB, STEP, hotspot — every clip type.

**How to generate:** always run `npm run generate-vtt -- --whisper-local`. The default mode emits one-cue placeholders that span the full clip and aren't deliverable.

### A6 — Submit-answer SFX on KC and FQ slides

`course/assets/audio/sfx/submit-answer.mp3` plays when the learner submits an answer:
- KC: fires on **Submit** button click; plays in parallel with the correct/incorrect response VO.
- FQ: fires on **answer choice** click (no separate Submit button on FQ).

This is wired in the existing templates — you don't author anything for it.

### A7 — Completion chime on drag-match

When the learner places the final correct match on a `drag-match` slide, `course/assets/audio/sfx/bell1.mp3` plays once. Wired in the template; you don't author it.

### PL5 — No regeneration after initial build without explicit instruction

Once slides have been built and are in active use or manual editing, **don't run `generate-slides --force` again unless the author explicitly instructs it for specific slides.** Regeneration overwrites all hand-edits.

When a fix is needed after build, **edit the slide HTML directly.** Regenerate only when:
- Building a new module from scratch
- The author explicitly names the slide(s) and confirms edits will be lost

---

## 6. Voiceover speaker reference

Full speaker list: [VOICES.md](VOICES.md). Configured at runtime via `WELLSAID_API_KEY` env var and `--speaker <id>` override on `generate-vo`.

**Project defaults:**

| Speaker ID | Name | Style | Used for |
|---|---|---|---|
| 122 | Lee M. | Conversational | Primary narrator — all `Voiceover-INTRO` clips |
| 106 | Jimmy J. | Narration | `basic_response.mp3` |
| 170 | Tosh M. | Conversational | `intermediate_response.mp3` |
| 128 | Zach E. | Narration | `advanced_response.mp3` |

Use Lee M. (122) unless there's a deliberate reason to differ. The interaction-clip speakers are shared assets across modules — you don't need to specify them per slide.

---

## 7. Quick-reference checklist (per-slide, while writing)

Before moving to the next slide block, every entry should pass these:

- [ ] `Slide-ID` matches the naming convention (`1S03`, `2KC02`, `3FQ07`, etc.)
- [ ] `Template-ID` is one of the templates in §4 — spelled exactly
- [ ] All **Required** fields for that template are present
- [ ] Every field is on its own line (no `Field-A: foo Field-B: bar`)
- [ ] `Voiceover-INTRO` is on its own line; matches template length guidance
- [ ] `Caption-Text` is ≤120 chars and is the first sentence of `Voiceover-INTRO`
- [ ] `Image-File` mirrors the Slide-ID (`1S03.jpg`, or `1S03a.jpg` if multiple)
- [ ] `Image` art direction is filled (always — even if `Image-File` will arrive later)
- [ ] For interactive templates (`card-explore`, `tab-panel`, `accordion-content*`, `step-sequence`): every `<Label>` is PascalCase and matches **exactly** across every field that references it
- [ ] For KC slides: first of pair has the exact intro VO; second of pair omits intro + caption
- [ ] For FQ slides: no `Voiceover-INTRO`, no `Caption-Text` (silent assessment flow)

---

## 8. Module-level checklist (before handing off the storyboard)

- [ ] Document header has both `# Course:` and `# Player-Title:`
- [ ] Slide 01 is `hero-title`, Slide 02 is `objectives`
- [ ] Exactly 4 `knowledge-check` slides, named `2KC01`–`2KC04`, arranged in two pairs at logical points
- [ ] Exactly 10 `final-quiz` slides, named `3FQ01`–`3FQ10` — 2 per objective
- [ ] One `closing` slide before the final quiz
- [ ] One `quiz-score` slide as the last entry (`3FQ-SCORE`)
- [ ] Total VO target: 15–20 minutes (max 30)
- [ ] `Status: Draft` appears on every slide that hasn't been reviewed
- [ ] `Notes:` line on every slide explains *why* that template was chosen

---

## 9. Where to look when this kit isn't enough

| Question | Source doc |
|---|---|
| Full HTML/CSS behavior of a template | [TEMPLATE-REFERENCE.md](TEMPLATE-REFERENCE.md) |
| Animation hooks and entrance patterns | [ANIMATIONS-REFERENCE.md](ANIMATIONS-REFERENCE.md) |
| Player-side rules (Next button, mute, captions, progress bar) | [PLAYER-RULES.md](PLAYER-RULES.md) |
| Pipeline commands and order of operations | [PIPELINE-REFERENCE.md](PIPELINE-REFERENCE.md), [NEW-MODULE-WORKFLOW.md](NEW-MODULE-WORKFLOW.md) |
| Full WellSaid speaker list | [VOICES.md](VOICES.md) |
| Full asset/file naming spec | [NAMING-CONVENTIONS.md](NAMING-CONVENTIONS.md) |
| Every quality-gate rule (T1–T4, I1–I6, A1–A7, S0–S9, etc.) | [COURSE-RULES.md](COURSE-RULES.md) |
| Visual design language (typography, color, spacing tokens) | [DESIGN.md](DESIGN.md) |
| Slide composition theory and layout patterns | [SLIDE-PATTERNS.md](SLIDE-PATTERNS.md) |
