# Product Requirements Document (PRD): Hindi OCR & Date Extraction

## 1. Functional Requirements (FRs)
- **FR1 (Background OCR & Regex)**: The application must scan OCR text from document pages and extract dates formatted in both standard Arabic numerals (e.g. 15/08/2024) and Devanagari script/numerals (e.g. १५/०८/२०२४, १५ अगस्त २०२४, दिनांक: १२-०५-२४).
- **FR2 (Date Badge UI)**: The system must display the parsed date natively with a 📅 badge on the bottom-left of each document grid card in `DocumentView.svelte`.
- **FR3 (Interactive Manual Override)**: Users can tap on the date badge to open a native DatePicker dialog and update the page date manually.
- **FR4 (Chronological Page Sorting)**: Users can sort pages within a document chronologically (`date_asc`, `date_desc`) based on the extracted or edited date.

## 2. Non-Functional Requirements (NFRs)
- **NFR1 (App Footprint)**: Utilize Google Play Services dynamic ML Kit dependencies rather than bundling multi-megabyte language models inside the standalone APK.
- **NFR2 (SDK Compatibility)**: Maintain full compatibility across Android SDK 23+.
- **NFR3 (Thread Responsiveness)**: Long batch extractions must yield CPU time to the main UI thread (10ms cooperative intervals).

## 3. UX Specifications
- Display a clickable 📅 badge on each page grid card.
- Provide sorting actions in `DocumentView.svelte` menu.
