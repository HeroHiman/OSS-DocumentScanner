# OSS Document Scanner & CardWallet

[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](COPYING)
[![Android Build](https://github.com/HeroHiman/OSS-DocumentScanner/actions/workflows/build-android.yml/badge.svg)](https://github.com/HeroHiman/OSS-DocumentScanner/actions/workflows/build-android.yml)
[![Translations](https://hosted.weblate.org/widgets/oss-document-scanner/-/svg-badge.svg)](https://hosted.weblate.org/engage/oss-document-scanner/)

<div>
  <img src="fastlane/metadata/com.akylas.documentscanner/android/en-US/images/featureGraphic.png" width="48%" alt="OSS Document Scanner">
  <img src="fastlane/metadata/com.akylas.cardwallet/android/en-US/images/featureGraphic.png" width="48%" alt="OSS Card Wallet">
</div>

---

## Project Overview

**OSS Document Scanner** is an open-source, privacy-first mobile document scanner and digital card wallet for Android and iOS. Built with NativeScript, Svelte, OpenCV, and Tesseract OCR, the application runs entirely offline on-device without telemetry, user tracking, or third-party cloud requirements.

This repository maintains two production targets:
- **OSS Document Scanner** (`com.herohiman.documentscanner` / `com.akylas.documentscanner`): Comprehensive document scanning, perspective correction, filter processing, OCR text extraction, PDF generation, and in-place document editing.
- **OSS CardWallet** (`com.akylas.cardwallet`): Secure local storage and organization for loyalty cards, boarding passes, barcodes, and digital wallet items.

---

## What's New in Recent Releases

### 1. Hindi OCR & Intelligent Date Extraction
- **Native Hindi Language Model Integration**: Full optical character recognition support for Hindi (Devanagari script) alongside standard multilingual recognition using offline Tesseract models.
- **Automated Date Extraction**: Intelligent regex and locale parsing algorithms that identify and extract dates from scanned Hindi and international invoices, receipts, bills, and official documents.
- **Bi-directional Metadata Sync**: Extracted dates are automatically tagged to page metadata, stored in the SQLite database, embedded in exported PDFs, and restored when documents are re-imported.

### 2. Interactive Document Text Editor
- **On-Page Text Overlays**: Add, reposition, and format text annotations directly on document pages with precise touch controls.
- **Full Rotation & Drag Mapping**: Freely rotate text annotations at 0°, 90°, 180°, and 270°. Text blocks can be smoothly dragged and repositioned after rotation with container-level pan gesture tracking and coordinate transformation mapping.
- **Micro-Scale Typography**: Typography sizing down to 4px (below the previous 12px minimum) allows for small form notes, legal annotations, reference codes, and stamps.
- **Border Outline Controls**: Toggle bounding box borders on or off to create bordered labels or transparent text overlays.
- **Non-Destructive Restoration & Clean Erase Engine**:
  - Preserves pristine background patches (`cleanPatch`) to prevent duplicate "ghost" text when re-editing or moving text overlays.
  - Features an inpainting fallback engine that samples surrounding paper color along the perimeter to cleanly erase annotations when modifying exported or legacy PDF pages.
- **High-Resolution Canvas Burning**: Burns text annotations cleanly into native image bitmaps at full capture resolution during export.

### 3. Date Filtering, Modal Picker & Selective PDF Export
- **Custom Svelte DatePicker Modal**: A reliable, crash-free modal date picker supporting fast direct text input, standard calendars, and quick presets (*Today*, *Yesterday*, *Last 7 Days*, *This Month*).
- **Date Range PDF Filtering**: Select date intervals to export only pages scanned or dated within that specific timeframe.
- **Date Metadata Persistence in PDF**: Encodes page dates within exported PDF structures, ensuring re-imported PDFs preserve their chronological timeline.

### 4. Import & Processing Workflow Upgrades
- **Visual Progress Counter**: Real-time progress displays indicating the current image index and total count during batch photo imports.
- **Prepend Imported Images**: Option to prepend incoming scans to the front of an existing document rather than appending to the end.
- **Multi-Crop Stability**: Resolved file name collisions and cache inconsistencies during multi-crop passes, ensuring cropped segments render immediately without stale image cache artifacts.

---

## Core Features

- **Document Capture & Processing**:
  - Automatic edge detection, perspective warping, and auto-cropping via OpenCV.
  - Image enhancements: Original, Magic Color, Grayscale, Black & White, Threshold, and Whitepaper flattening.
  - Manual quad-corner adjustment with loupe magnification for pixel-perfect edge alignment.
- **OCR (Optical Character Recognition)**:
  - 100% offline, on-device OCR powered by Tesseract.
  - Multi-language recognition (English, Hindi, French, German, Spanish, and more).
  - Searchable PDF generation with embedded invisible text layers matching visual document coordinates.
- **Organization & Storage**:
  - Tagging, multi-folder hierarchies, color coding, and quick search.
  - Fast thumbnail caching and full offline SQLite persistence.
  - Optional encrypted cloud sync with Nextcloud, WebDAV, Google Drive, or local storage providers.
- **Export & Share**:
  - Export to single or multi-page PDF, JPEG, PNG, PKPass, or ZIP archives.
  - Configurable compression quality, page dimension limits, and password-protected PDF output.
- **OSS CardWallet**:
  - Barcode and QR code scanning with support for Aztec, Code 128, Data Matrix, EAN, PDF417, and QR codes.
  - Digital card balance logging, custom fields, and color customization.

---

## Project Architecture

```
OSS-DocumentScanner/
├── app/
│   ├── components/         # Svelte UI components (scanner, editor, settings, modal views)
│   │   ├── edit/           # Image editor, crop views, and TextEditView.svelte
│   │   └── modal/          # Pure Svelte DatePickerModal, tag pickers, dialogs
│   ├── models/             # Data models (OCRDocument, OCRPage, Tag, Card)
│   ├── services/           # SQLite database, PDF generation, sync engines, OCR updater
│   └── utils/              # Text overlay engine (textOverlay.ts), matrix filters, export utilities
├── plugin-nativeprocessor/ # Native OpenCV & image processing bridge (Android Kotlin & iOS Swift)
├── App_Resources/          # Platform resources, Android manifests, iOS asset catalogs
├── docs/                   # Documentation and user guides
└── fastlane/               # Store deployment scripts and metadata
```

---

## Installation & Build Instructions

### Prerequisites

1. **Node.js**: Version 20.x or higher LTS.
2. **Yarn**: Yarn 4.x via Corepack (`corepack enable && corepack prepare yarn@4.9.4 --activate`).
3. **Java Development Kit**: JDK 17 (Temurin recommended).
4. **Android SDK**: Build Tools 34+, Command-line Tools, Platform Tools, Android API 34.
5. **NativeScript CLI**:
   ```bash
   npm install -g @akylas/nativescript-cli --legacy-peer-deps
   ns package-manager set yarn2
   ```

### 1. Clone the Repository

```bash
git clone --recurse-submodules https://github.com/HeroHiman/OSS-DocumentScanner.git
cd OSS-DocumentScanner
```

### 2. Environment Configuration

Create a local environment file by sourcing `.env.ci`:

```bash
cat << 'EOF' > .env
source .env.ci
EOF
source .env
```

To configure target builds, specify:
- `APP_ID`: `com.herohiman.documentscanner` (or `com.akylas.cardwallet`)
- `APP_BUILD_PATH`: `build/documentscanner` (or `build/cardwallet`)
- `APP_RESOURCES`: `App_Resources/documentscanner` (or `App_Resources/cardwallet`)

### 3. Native Libraries (OpenCV & Tesseract)

Download the precompiled native libraries:

- **Android**:
  Download `android.zip` from the [release dev_resources](https://github.com/ossappscollective/OSS-DocumentScanner/releases/download/dev_resources/android.zip) and extract it to the project root:
  ```bash
  mkdir -p /tmp/dev_resources
  curl -fL -o /tmp/dev_resources/android.zip https://github.com/ossappscollective/OSS-DocumentScanner/releases/download/dev_resources/android.zip
  unzip -o -q /tmp/dev_resources/android.zip -d .
  rm -rf /tmp/dev_resources
  ```
- **iOS**:
  Download `ios.zip` from the release resources and extract to the project root.

### 4. Install Dependencies

```bash
corepack enable
yarn install
```

### 5. Running the Application

Connect an Android physical device or start an emulator:

```bash
# Run Android build with development logs
ns run android --env.devlog

# Run iOS build (macOS required)
ns run ios --env.devlog
```

---

## Verification & Testing

Run unit tests and type verification before committing changes:

```bash
# Run Vitest test suite
yarn test

# Run Svelte component validation
yarn svelte-check
```

---

## Usage Guide

### Scanning Documents
1. Tap the **Camera** button to open the scanner.
2. Align your document within the frame; the automatic edge detection algorithm will locate page corners.
3. Review corner handles or adjust manually using the corner loupe.
4. Select desired color filters (e.g. *Whitepaper*, *Black & White*, *Color*).

### Using the Text Editor
1. Open any scanned page and select **Edit Text** from the page options.
2. Tap the text box to enter annotations or labels.
3. Use the **Size Slider** to adjust font size (supports micro-typography down to 4px).
4. Tap the **Rotation Button** to cycle text angle (0°, 90°, 180°, 270°). Drag smoothly to any position on the canvas.
5. Tap the **Border Button** to toggle bounding box outlines on or off.
6. Tap the **Trash Can** icon to cleanly remove existing text overlays without leaving background residue.
7. Tap the **Checkmark** to save and burn the updated text into the document image.

### OCR & Date Extraction
1. Open a document and tap **OCR**.
2. Select your desired language model (including **Hindi** or standard languages).
3. The app extracts text and automatically detects invoice/document dates.
4. Extracted dates can be filtered from the main list or used to generate targeted date-range PDF exports.

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Verify all tests pass with `yarn test` and `yarn svelte-check`.
3. Submit a pull request detailing the changes and rationale.

Translations can be contributed directly on [Weblate](https://hosted.weblate.org/engage/oss-document-scanner/).

---

## License

This project is licensed under the **GNU General Public License v3.0** (GPL-3.0). See [COPYING](COPYING) for full details.
