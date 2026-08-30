# SPEC: Document Page Text Editor & Canvas Burning Feature

## 1. Intent & Overview
OSS-DocumentScanner converts rasterized pages and scans into images for rendering, manipulation, and PDF generation. This feature provides a complete interactive **Text Editor** allowing users to:
1. Place and reposition text boxes directly over any document page using drag/pan gestures.
2. Customize text styling (text value, font size, text color).
3. "Burn" (permanently render) the text overlay directly onto the page's underlying bitmap image via `@nativescript-community/ui-canvas`.
4. Automatically propagate burned images to page thumbnails, zoom viewers, and subsequent PDF exports.

## 2. Architecture & Components

### 2.1. Coordinate Mapping (Screen-Space to Image-Space)
Because images are displayed within letterboxed/aspect-fitted containers across various screen DPIs and viewport dimensions, screen coordinates `(textX, textY)` must be mapped with mathematical precision into native image pixels `(finalX, finalY)`:

- **Letterbox Geometry Calculation**:
  - Image aspect ratio: $R_{img} = \frac{W_{img}}{H_{img}}$
  - Container aspect ratio: $R_{cont} = \frac{W_{cont}}{H_{cont}}$
  - If $R_{cont} > R_{img}$ (horizontal letterbox):
    - $H_{disp} = H_{cont}$
    - $W_{disp} = H_{cont} \times R_{img}$
    - $O_x = \frac{W_{cont} - W_{disp}}{2}$, $O_y = 0$
  - Else (vertical letterbox):
    - $W_{disp} = W_{cont}$
    - $H_{disp} = \frac{W_{cont}}{R_{img}}$
    - $O_x = 0$, $O_y = \frac{H_{cont} - H_{disp}}{2}$

- **Image-Space Translation**:
  - Scale factor: $S_x = \frac{W_{img}}{W_{disp}}$, $S_y = \frac{H_{img}}{H_{disp}}$
  - $X_{img} = (X_{screen} - O_x) \times S_x$
  - $Y_{img} = (Y_{screen} - O_y) \times S_y$
  - Scaled Font Size: $FS_{canvas} = FS_{ui} \times S_x$

### 2.2. Rendering Pipeline (`app/utils/textOverlay.ts`)
- Load `ImageSource` from file.
- Instantiate `@nativescript-community/ui-canvas` `Canvas` and `Paint`.
- Configure text anti-aliasing, color, and scaled font size.
- Support single and multi-line strings with line-height offsets.
- Save to disk via `ImageSource.saveToFile(...)`.
- Evict old bitmap from pipeline cache via `getImagePipeline().evictFromCache(...)`.

### 2.3. User Interface Layer (`app/components/edit/TextEditView.svelte`)
- Full-screen modal launched from `DocumentEdit.svelte`.
- Interactive page image preview with Pan gesture drag handler.
- Floating/anchored styling controls:
  - Color palette selection (Black, White, Red, Blue, Green, Yellow, Orange, Purple).
  - Font size slider/stepper.
  - In-place text editor (`TextField` / `TextView`).
- Action bar with Cancel and Save/Burn actions.

### 2.4. Document Synchronization (`app/components/edit/DocumentEdit.svelte`)
- Add `mdi-format-text` action button in the editing toolbar.
- On save, invoke `document.updatePage(currentIndex, { size: file.size }, true)` to trigger cache eviction and update all views.

## 3. Verification Plan
- Unit tests: Test coordinate transformation math, scale calculations, and multi-line boundary offsets in `tests/utils/textOverlay.test.ts`.
- Svelte diagnostics: Run `svelte-check` to verify template integrity.
- Suite test: Run `npx vitest run`.
