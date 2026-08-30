# SPEC: PDF Import Freeze and OOM Resolution

## 1. Problem Statement
When importing PDF documents into OSS-DocumentScanner, the app frequently gets stuck on the "Computing..." screen or crashes due to Out-Of-Memory (OOM) errors.

### Root Causes
1. **OpenCV Edge Detection Bottleneck**: The import pipeline feeds rasterized PDF pages directly into `getJSONDocumentCornersFromFile` (OpenCV edge detector). Because PDF pages are flat and borderless, the edge detector fails or gets trapped in heavy computation loops attempting to find high-contrast perspective paper corners.
2. **Android Bitmap Memory Leak / Slow GC**: In `PDFUtils.kt`, rasterized bitmaps generated during `importPdfToTempImages` (both in `PdfRenderer` and raw byte extraction loops) are not immediately recycled (`bitmap.recycle()`), causing heap bloat on multi-page PDFs.
3. **Unbounded Render Scale**: Large dimension PDFs rendered at fixed 2.0x scale or higher allocate excessively large Bitmaps in memory, crashing devices with low memory headroom.

## 2. Technical Specification & Solution Design

### Patch 1: Bypass Auto-Crop for PDF Imports
- **Location**: `app/utils/ui/index.common.ts`
- **Logic**:
  - Separate PDF page images from regular camera/gallery images during the import pipeline.
  - For PDF images:
    - Skip `getJSONDocumentCornersFromFile` (no OpenCV edge detection).
    - Skip `ModalImportImages.svelte` (PDF pages are directly imported with full-page bounding box `[[0,0],[width,0],[width,height],[0,height]]`).
    - Preserve standard default filters/transforms (normal, magic color, contrast, brightness) based on user settings.
  - For standard photos/camera captures:
    - Retain full auto-crop edge detection and the interactive `ModalImportImages` UI.

### Patch 2: Explicit Android Bitmap Recycling
- **Location**: `plugin-nativeprocessor/platforms/android/java/com/akylas/documentscanner/utils/PDFUtils.kt`
- **Logic**:
  - In `importPdfToTempImages`:
    - Ensure every `Bitmap` generated in `importPDFImages` branch is explicitly recycled (`if (!bitmap.isRecycled) bitmap.recycle()`) after file write.
    - In `PdfRenderer` branch, ensure `renderedPage` is safely recycled on each iteration.
    - Ensure streams and page descriptors are closed cleanly in `finally` blocks.

### Patch 3: Safe Render Scale Cap
- **Locations**:
  - Android: `plugin-nativeprocessor/platforms/android/java/com/akylas/documentscanner/utils/PDFUtils.kt`
  - iOS: `plugin-nativeprocessor/platforms/ios/src/PDFUtils.swift`
- **Logic**:
  - Define `MAX_WIDTH = 1500f`.
  - Calculate `safeScale`: If `(page.width * scale) > MAX_WIDTH`, compute `safeScale = MAX_WIDTH / page.width`, otherwise use requested `scale` (default 2.0).
  - Apply the safe scale to bitmap allocation and page rendering.

## 3. Verification Plan
- Unit tests: `npx vitest run` to ensure existing PDF and image pipelines pass without regression.
- Code review: Confirm memory lifecycle, boundary conditions, and cross-platform consistency.
