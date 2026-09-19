---
title: 'Text Editor Rotation Alignment, Transform Preservation, Re-editing & Border Controls'
type: 'bugfix'
created: '2026-09-19'
status: 'completed'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 
1. When an image has an active page rotation in the editor, opening the Text Editor modal resets the preview to 0° rotation instead of honoring the rotated position.
2. Applying document enhancements/transforms (such as "whitepaper") re-crops the page from the original source image, overwriting `page.imagePath` and permanently wiping out all previously added text overlays.
3. Users cannot easily re-edit previously added text on a page, cannot reduce the text size below 12px, and cannot choose whether to include or remove a border around the text.

**Approach:**
1. Pass `imageRotation={item?.rotation ?? 0}` to the preview image in `TextEditView.svelte`, account for rotation in aspect ratio and letterbox calculations, and map screen text coordinates into raw bitmap coordinates with matching canvas rotation when burning text.
2. Persist text overlay metadata (`page.extra.textOverlays`) during text editing, and automatically re-apply all saved text overlays onto the newly generated `page.imagePath` whenever page transforms or crops are updated.
3. Support full re-editing of existing text overlays in `TextEditView.svelte` (re-populating text, position, size, color, border; cleanly re-cropping from `sourceImagePath` before re-burning).
4. Extend the font size slider range down to 4px (allowing sizes below 12px for fine print).
5. Add a border toggle allowing users to add or remove the text border in both the editor UI and the burned bitmap output.

## Boundaries & Constraints

**Always:**
- Keep text placement visually identical between `TextEditView` and `DocumentEdit` / PDF export at any rotation (0°, 90°, 180°, 270°).
- Re-apply text overlays automatically whenever page transforms change (`whitepaper`, `enhance`, `color`).
- Keep Vitest suite 100% passing and zero Svelte check errors.
- Support font sizes from 4px to 72px.

**Ask First:**
- N/A

**Never:**
- Never mutate or overwrite the uncropped raw `page.sourceImagePath` with burned text.
- Never crash or corrupt image rendering if a page has no text overlays.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rotated Page Text Editing | Page with `rotation = 90` opened in Text Editor | Preview displays rotated 90°; text placed by user is burned in matching orientation; appears horizontal in viewer | Gracefully clamp coordinates within rotated display bounds |
| Whitepaper Transform After Text | Page with burned text has "whitepaper" transform toggled | Image is transformed to whitepaper and text overlay is automatically re-burned on top | If re-burn fails, keep clean transformed image and log warning |
| Re-editing Existing Text | Text Editor opened on page with existing text overlay | Text, font size, color, border toggle, and position pre-populate; saving re-crops clean base and burns updated text without ghosting | Fallback to default if overlay data is malformed |
| Text Size Below 12px | User drags slider below 12px (e.g. 6px or 8px) | Text preview and burned bitmap render scaled text at the chosen small font size (down to 4px) | Minimum font size clamped at 4px |
| Border Toggle (Add / Remove) | User toggles border option on or off | If ON, border rectangle is rendered in preview and burned to bitmap; if OFF, no border is rendered or burned | Default border state preserved on re-edit |
| Text Removal | User clears text in Text Editor and saves | Base image is restored without text, and `page.extra.textOverlays` is cleared | Cleanly re-generate from `sourceImagePath` |

</frozen-after-approval>

## Code Map

- `app/utils/textOverlay.ts` -- Update `calculateImageDisplayBounds` and `mapScreenToImageCoordinates` to handle 0°, 90°, 180°, 270° rotations. Update `burnTextToImageFile` to rotate canvas text and draw optional border rectangle when `hasBorder` is true. Add `reapplyTextOverlays` helper.
- `app/components/edit/TextEditView.svelte` -- Pass `imageRotation` to preview `<image>`. Pre-populate state from `item.extra?.textOverlays`. Support font size min 4px. Add border toggle button/control. Re-crop clean base from `item.sourceImagePath` on re-edit before burning, and persist `extra.textOverlays`.
- `app/models/OCRDocument.ts` -- In `updatePageTransforms` and `updatePageCrop`, re-apply `page.extra.textOverlays` after `cropDocumentFromFile` overwrites `page.imagePath`.
- `app/utils/textOverlay.test.ts` -- Add unit tests for 0°, 90°, 180°, 270° display bounds, coordinate mapping, small font sizes, and border options.

## Tasks & Acceptance

**Execution:**
- [x] `app/utils/textOverlay.ts` -- Add rotation support to coordinate mapping, bounds calculations, canvas text drawing, optional border rendering, and `reapplyTextOverlays` -- Ensure rotation math, border drawing, and transform persistence functions exist
- [x] `app/models/OCRDocument.ts` -- In `updatePageTransforms` and `updatePageCrop`, re-apply text overlays from `page.extra.textOverlays` onto `page.imagePath` -- Prevent text loss on transform changes
- [x] `app/components/edit/TextEditView.svelte` -- Display rotated image, pre-populate existing overlays, support font sizes down to 4px, add border toggle, re-crop clean base on re-edit, and save `textOverlays` in `page.extra` -- Fix rotation reset, enable clean re-editing, and provide border and small font controls
- [x] `app/utils/textOverlay.test.ts` -- Add comprehensive unit tests covering coordinate mapping across all 4 rotation angles, small font sizes, and border flags -- Validate rotation mathematics and options

**Acceptance Criteria:**
- Given a document page rotated by 90°, when opening the Text Editor, then the image appears in its rotated orientation, and text placed on it renders right-side up in both the editor and document viewer.
- Given a document page with burned text, when the user selects "whitepaper" (or any enhancement), then the whitepaper transform is applied and the text remains visible and intact.
- Given a document page with existing text, when opening Text Editor, then the existing text, position, color, size, and border are loaded, and changes can be saved cleanly without ghosting.
- Given the Text Editor font size slider, users can set font sizes below 12px (down to 4px).
- Given the Text Editor border toggle, users can add or remove the text border, and the border is burned to the image only when enabled.

## Design Notes

- Rotated coordinate transformation for displayed bounds:
  - When `rotation % 180 !== 0`, effective displayed image dimensions are swapped: `displayedW = H`, `displayedH = W`.
  - Normalized coordinates $(u, v) \in [0, 1]$ on the rotated display map to raw bitmap pixels:
    - 0°: $X = u \cdot W$, $Y = v \cdot H$, canvas angle = 0°
    - 90°: $X = v \cdot W$, $Y = (1 - u) \cdot H$, canvas angle = 270°
    - 180°: $X = (1 - u) \cdot W$, $Y = (1 - v) \cdot H$, canvas angle = 180°
    - 270°: $X = (1 - v) \cdot W$, $Y = u \cdot H$, canvas angle = 90°
- Border rendering:
  - When `hasBorder` is true, calculate text bounds (width = max line width + padding, height = total lines height + padding) and draw a stroke rectangle around the text using the selected color (or border color) before or after text drawing.
- Non-destructive re-editing:
  - `page.extra.textOverlays` stores `{ text, screenX, screenY, containerWidth, containerHeight, fontSize, color, hasBorder, rotation }`.
  - On re-edit or remove, `cropDocumentFromFile` generates clean `page.imagePath` from `page.sourceImagePath`, then updated overlay is applied.

## Verification

**Commands:**
- `corepack enable && yarn test` -- expected: all unit tests pass
- `npx svelte-check --compiler-warnings "a11y-no-onchange:ignore,a11y-label-has-associated-control:ignore,a11y-autofocus:ignore,illegal-attribute-character:ignore"` -- expected: 0 errors
