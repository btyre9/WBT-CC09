# Porsche WBT Template — Update Log

## 2026-03-12

### Player UI
- **Top title bar** — Added `.top-title` span (text: `Module Title` placeholder) to the right of the Menu button in both `course/index.html` and `course/player/index.html`. Replace `Module Title` with the actual course name when starting a new module.
- **Audio timer** — Added `#audio-timer` element to the right of the progress bar in both player HTML files. Displays elapsed audio time in `M:SS` format.
- **Porsche wordmark margin** — Added `margin-left: 36px` to `.bottom-logo svg` in both player HTML files to shift the wordmark further right.
- **runtime.js** — Updated `syncAudioProgress()` to read `#audio-timer` and update the time display on each audio tick.

### Final Quiz Slides
- **Submit SFX** — All 10 FQ question slides (`FQ-CC02-001` through `FQ-CC02-010`) now play `../assets/audio/sfx/submit-answer.mp3` when the user clicks an answer choice (at the top of `onChoiceClick()`, after the answered guard).
- **SFX asset** — Added `course/assets/audio/sfx/submit-answer.mp3`.

### SCORM Packaging
- **`imsmanifest.xml`** — Created `course/imsmanifest.xml` (SCORM 1.2). Uses `XXXX` placeholder identifiers — replace with the actual course code (e.g. `CC02`) before packaging. Mastery score set to `80`.
- **sync-output.js** — Added step 6: copies `course/imsmanifest.xml` → `output/course/imsmanifest.xml` on every sync.

---

## New Module Checklist

When starting a new module from this template:

- [ ] Replace `XXXX` in `course/imsmanifest.xml` with the course code (e.g. `CC03`)
- [ ] Update `Module Title` in `imsmanifest.xml` (both `<title>` tags)
- [ ] Update `Module Title` in `course/index.html` (`#course-title` span)
- [ ] Update `Module Title` in `course/player/index.html` (`#course-title` span)
- [ ] Update `<title>` tag in `course/player/index.html`
- [ ] Rename slide files from `CC02` → new course code
- [ ] Update `course/data/course.data.json` with slide list and titles
