# Architecture & Architecture Decision Records (ADRs)

## Architecture Overview
The Hindi OCR & Date Extraction pipeline consists of:
1. **Core Configuration Layer**: Google Play Services ML Kit Devanagari model dependencies and manifest auto-download configurations.
2. **Extraction Engine (`app/utils/dateExtractor.ts`)**: Devanagari transliteration, multi-pattern regex matching, date validation, and async batch yielding.
3. **Model & State Layer (`app/models/OCRDocument.ts`)**: Persistence of parsed dates in `OCRPage.extra.date` and `OCRPage.extra.dateTimestamp`, plus `sortPages(order)` functionality.
4. **UI Presentation Layer (`app/components/view/DocumentView.svelte`)**: 📅 Date badge, native `DateTimePicker` integration, and menu sort actions.

---

## Architectural Decision Records (ADRs)

### ADR 1: OCR Engine & Language Support
- **Context**: Need fast, CPU-efficient, offline-capable Devanagari text recognition.
- **Decision**: Adopt Google ML Kit Text Recognition v2 Devanagari (`com.google.android.gms:play-services-mlkit-text-recognition-devanagari:16.0.1`).
- **Consequences**: Minimizes APK size by leveraging Google Play Services while providing high accuracy for handwritten Hindi text.

### ADR 2: Asynchronous Yielding Loop
- **Context**: Batch scanning 50 pages on mobile can freeze the UI thread during heavy regex evaluation and string processing.
- **Decision**: Implement cooperative micro-task yielding (`await new Promise(r => setTimeout(r, 10))`) in the batch extractor.
- **Consequences**: Guarantees silky-smooth UI rendering and zero thread starvation during large batch imports.

### ADR 3: Dynamic Model Download Manifest Configuration
- **Context**: Ensure the ML Kit Devanagari model is available when the app is installed.
- **Decision**: Inject `<meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="ocr" />` into `AndroidManifest.xml`.
- **Consequences**: Prompts Google Play Store to install the required OCR model silently during app download.
