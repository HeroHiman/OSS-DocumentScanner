<!-- bmad:context -->
<!-- Verified 2026-08-30 against c9a96c86. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## OSS-DocumentScanner

Open-source document scanner and card wallet mobile app. Built with TypeScript, Svelte (`@nativescript-community/svelte-native`), NativeScript 9, Android (Kotlin), iOS (Swift), and OpenCV native plugin. Planning and BMAD artifacts live in `_bmad-output/`, docs in `docs/`.

## Policy

- Corepack must be enabled for package management (`corepack enable && yarn ...`).
- Verify changes with `yarn test` before submitting.
- Never hand-edit native generated build artifacts in `platforms/` or `App_Resources/cardwallet/Android/baselineprofile/`.

## Where things are

- Import and image processing pipeline: `app/utils/ui/index.common.ts`
- Document model & database: `app/models/OCRDocument.ts`, `app/services/pdf/`
- Android native image/PDF processing: `plugin-nativeprocessor/platforms/android/java/com/akylas/documentscanner/utils/PDFUtils.kt`
- iOS native image/PDF processing: `plugin-nativeprocessor/platforms/ios/src/PDFUtils.swift`
- UI Components: `app/components/`

## Running and verifying

- `corepack enable && yarn test` — runs Vitest suite (4 test files).
- `yarn svelte-check` — runs svelte compiler validation.

## Conventions that differ from defaults

- Cross-platform file & native bridge implementations are split by platform suffix (`.common.ts`, `.android.ts`, `.ios.ts`).
- Native plugins live in sub-workspaces (`plugin-nativeprocessor`, `plugin-shared`, `plugin-zip`).

## Known pitfalls

- Never run OpenCV auto-crop / edge detection (`getJSONDocumentCornersFromFile`) on rasterized PDF pages. PDF pages are borderless, which traps OpenCV in a loop and triggers OOM.
- Always call `bitmap.recycle()` immediately after compressing/saving Bitmaps in Android Kotlin loops (`PdfRenderer`, `BitmapFactory.decodeByteArray`).
- Cap PDF rendering resolution with a safe maximum pixel width (1500px) to prevent massive memory allocations on high-resolution PDF pages.

<!-- /bmad:context -->
