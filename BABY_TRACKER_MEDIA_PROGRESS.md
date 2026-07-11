# BabyTracker — Media Experience Progress

Scope: yearly album (`שנה ראשונה`), milestone photo upload, GIF/video/ZIP export.
Mobile-first (Hebrew RTL). Desktop is secondary.

## Bugs found

1. **Milestone photo upload fails (HTTP 400).** Confirmed in Supabase storage/API logs:
   `POST 400 /storage/v1/object/milestones/<childId>/5.jpg` (Android device, twice).
   `SELECT`/`GET` on the same child return 200, so RLS and family/child matching are
   fine — the rejection is at the storage **mime-validation** layer.
2. **Video & GIF transitions felt laggy.** Video used a fixed 20-step `setTimeout`
   loop (30 ms/step) redrawing two 1080² images — frame-rate-dependent, janky on
   mobile. GIF had **no** transitions at all (hard cuts) and encoded synchronously,
   freezing the tab.
3. **Images overflow / render sideways.** Phone photos with EXIF orientation were
   uploaded raw; the browser's orientation handling was inconsistent, so portrait
   photos could render rotated → wrong aspect → spilling out of the frame.
4. **Captioned vs non-captioned looked wrong.** One fixed 34%-tall gradient band was
   always drawn regardless of content; the ZIP renderer used *different* geometry
   than the preview/GIF/video, so the preview did not match the export.
5. **Captions clipped silently.** `wrapCanvasText` dropped overflow words past
   `maxLines` with **no ellipsis** — the caption was truncated with no visual cue.

## Root cause

- **Upload 400:** the `milestones` bucket only allows `image/jpeg | image/png |
  image/webp` (verified via `storage.buckets`), but `pickMilestonePhoto` uploaded the
  **raw picked file with its original MIME type** to a hardcoded `.jpg` path. Any
  HEIC/HEIF (iPhone), gif, or otherwise-mismatched type is rejected → 400. Even
  "accepted" types had a content-type/extension mismatch.
- **Laggy transitions:** fixed-step `setTimeout` animation + no GIF transitions +
  synchronous GIF encoding on the main thread.
- **Overflow:** EXIF orientation not baked into the pixels before use.
- **Layout / clipping:** fixed band height, two divergent renderers, and lossy text
  wrapping.

## Fix summary

- **Upload:** re-encode every picked photo through a canvas to a **real JPEG** before
  upload (`processMilestoneImage`), baking in EXIF orientation and bounding the
  longest edge to 3000 px (plenty for the 2100 px print export). Upload now always
  sends `contentType: 'image/jpeg'` to the `.jpg` path → matches the bucket allowlist.
- **One compositor:** `drawAlbumFrame` is now the single source of truth for the live
  preview, GIF, video, **and** ZIP → the preview matches the export exactly.
- **Content-aware band:** `computeAlbumBand` (pure, unit-tested) sizes the lower band
  to the actual text — no band for a bare photo, short band for month-only, taller
  band for captions — capped at 62% so it never covers the important part of the photo.
- **No clipped captions:** `wrapCanvasText` now appends `…` whenever words are cut.
- **Smooth transitions:** time-based `crossfadeCanvases` (elapsed-time alpha + ease,
  ~16 ms tick, survives a backgrounded tab) for the video; GIF now streams a smooth
  dissolve (`GIF_TRANSITION_FRAMES`) and yields between frames so the tab stays
  responsive. Video bitrate tuned 12→8 Mbps for mobile encoders.
- **Clear upload states:** `processing → uploading → success ✓ / error` in the sheet.

## Files changed

- `src/lib/imageUpload.js` — `processMilestoneImage` (canvas re-encode → JPEG,
  orientation-aware `loadBitmap`, 3000 px cap); `uploadMilestonePhoto` forces
  `image/jpeg`; `pickMilestonePhoto` = pick + process.
- `src/lib/albumExport.js` — `computeAlbumBand` (new, exported); rewritten
  `drawAlbumFrame` (content-aware layout, unified); `renderPage` (ZIP) now uses
  `drawAlbumFrame`; `crossfadeCanvases` (new); `wrapCanvasText` ellipsis fix;
  video loop uses crossfade + 8 Mbps; GIF streams dissolves.
- `src/lib/albumConstants.js` — added `GIF_TRANSITION_FRAMES`; removed dead
  `TRANSITION_STEPS`, `CANVAS_FRAME_WIDTH`.
- `src/pages/AlbumPage.jsx` — phased upload flow (`pickImage` +
  `processMilestoneImage`) with processing/uploading/success states; preview
  slideshow now cross-fades like the export; cleaned imports.
- `src/__tests__/albumExport.test.js` — new tests for `computeAlbumBand` (12) and
  `wrapCanvasText` (Hebrew, long, truncation/ellipsis).

## Completed tasks

- [x] Root-caused the upload 400 from Supabase logs + bucket config.
- [x] Fixed upload: canvas re-encode → JPEG, EXIF orientation baked, size bounded.
- [x] Mobile upload flow: clear processing / uploading / success / error states.
- [x] Images stay in frame + aspect preserved (cover-fit + orientation bake).
- [x] Distinct captioned vs non-captioned layouts (content-aware band).
- [x] Captions never clipped (dynamic band height + ellipsis on overflow).
- [x] Smooth, time-based video transitions.
- [x] GIF transitions (smooth dissolve) + responsive, streaming encode.
- [x] Preview matches export (one shared compositor across preview/GIF/video/ZIP).
- [x] Album refreshes after save (`upsertPhoto` → refetch — unchanged, confirmed).

## Verification results

Real album UI is behind Google auth, so the media modules were driven directly in a
real browser via a temporary harness (since deleted) + pixel analysis.

- **Build:** `npm run build` clean.
- **Unit tests:** `npm run test:run` → **75 passed** (incl. 16 new album tests).
- **Upload re-encode (browser):** 4032×3024 **PNG** `IMG_1234.PNG` →
  **3000×2250 `image/jpeg`**, aspect preserved, bounded to 3000 px. ✓ (fixes the 400)
- **Compositor (pixel analysis):**
  - Full-bleed (no caption/month/date): **band 0, zero text pixels** ✓
  - Month-only: short single-row band ✓
  - Captioned: taller band, month + caption; long Hebrew caption renders extra
    lines with the month pinned to the bottom ✓
  - Preview (320 px) vs export (900 px): **identical band ratio 0.225 vs 0.222** →
    preview matches export ✓
  - Gold frame + B&W effect composite correctly ✓
- **Video transition:** real `crossfadeCanvases` sampled mid-run → genuine red↔blue
  **blends** over ~600 ms, ends fully on the next frame (smooth, not a hard cut) ✓
- **GIF export (end-to-end):** 3 mixed photos → valid **`image/gif`** (136 KB),
  progress [1,2,3] ✓
- **Video export (end-to-end):** 2 photos → valid **`video/mp4` (avc1)**, phases
  loading→rendering→recording, ~5.3 s ✓
- **Console:** no errors during any run.

## Remaining tasks / notes for the next agent

- **Live end-to-end on a real device** (couldn't sign in with Google here): confirm a
  real HEIC iPhone photo and a large Android photo upload, save, and appear in the
  grid; confirm the on-device video/GIF look. All underlying modules are verified.
- **GIF size:** `GIF_TRANSITION_FRAMES = 4` × 12 months is smooth but adds frames; if
  a full 12-photo GIF gets too big for WhatsApp, drop it to 3 or 2.
- No infra change was needed. If you ever want defense-in-depth, the `milestones`
  bucket could also allow more mimes, but the client now always sends JPEG.
- Harness (`album-harness.html`) was deleted; a `baby-tracker-dev` entry was added to
  `C:\CodingProjects\.claude\launch.json` (parent workspace, not this repo) to run the
  dev server via the preview tools.
