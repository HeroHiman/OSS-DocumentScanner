import { describe, expect, it } from 'vitest';
import { calculateImageDisplayBounds, mapScreenToImageCoordinates } from './textOverlay';

describe('calculateImageDisplayBounds', () => {
    it('calculates vertical letterboxing (bars on top/bottom) correctly', () => {
        // Container: 400x800 (ratio 0.5)
        // Image: 1000x1000 (ratio 1.0)
        // Container is taller than image
        const bounds = calculateImageDisplayBounds({
            containerWidth: 400,
            containerHeight: 800,
            imageWidth: 1000,
            imageHeight: 1000
        });

        expect(bounds.displayedWidth).toBe(400);
        expect(bounds.displayedHeight).toBe(400);
        expect(bounds.offsetX).toBe(0);
        expect(bounds.offsetY).toBe(200); // (800 - 400) / 2
    });

    it('calculates horizontal letterboxing (pillarboxing) correctly', () => {
        // Container: 800x400 (ratio 2.0)
        // Image: 1000x1000 (ratio 1.0)
        // Container is wider than image
        const bounds = calculateImageDisplayBounds({
            containerWidth: 800,
            containerHeight: 400,
            imageWidth: 1000,
            imageHeight: 1000
        });

        expect(bounds.displayedWidth).toBe(400);
        expect(bounds.displayedHeight).toBe(400);
        expect(bounds.offsetX).toBe(200); // (800 - 400) / 2
        expect(bounds.offsetY).toBe(0);
    });

    it('handles identical aspect ratios without offsets', () => {
        const bounds = calculateImageDisplayBounds({
            containerWidth: 500,
            containerHeight: 1000,
            imageWidth: 1000,
            imageHeight: 2000
        });

        expect(bounds.displayedWidth).toBe(500);
        expect(bounds.displayedHeight).toBe(1000);
        expect(bounds.offsetX).toBe(0);
        expect(bounds.offsetY).toBe(0);
    });

    it('handles zero or missing dimensions gracefully', () => {
        const bounds = calculateImageDisplayBounds({
            containerWidth: 0,
            containerHeight: 0,
            imageWidth: 1000,
            imageHeight: 1000
        });

        expect(bounds.offsetX).toBe(0);
        expect(bounds.offsetY).toBe(0);
    });
});

describe('mapScreenToImageCoordinates', () => {
    it('accurately maps screen coordinates and scales font size for aspect-fitted image', () => {
        // Container: 500x1000, Image: 1000x2000 (Scale 2.0x)
        const coords = mapScreenToImageCoordinates({
            screenX: 100,
            screenY: 150,
            containerWidth: 500,
            containerHeight: 1000,
            imageWidth: 1000,
            imageHeight: 2000,
            uiFontSize: 24
        });

        expect(coords.imageX).toBe(200);
        expect(coords.imageY).toBe(300);
        expect(coords.canvasFontSize).toBe(48);
    });

    it('adjusts for vertical letterboxing offset', () => {
        // Container: 400x800, Image: 1000x1000 (displayed: 400x400 at offsetY: 200, scale 2.5x)
        const coords = mapScreenToImageCoordinates({
            screenX: 50,
            screenY: 250, // 50px below the image top edge (200 + 50)
            containerWidth: 400,
            containerHeight: 800,
            imageWidth: 1000,
            imageHeight: 1000,
            uiFontSize: 20
        });

        expect(coords.imageX).toBe(125); // 50 * 2.5
        expect(coords.imageY).toBe(125); // (250 - 200) * 2.5
        expect(coords.canvasFontSize).toBe(50); // 20 * 2.5
    });

    it('clamps negative coordinates outside image display area to 0', () => {
        const coords = mapScreenToImageCoordinates({
            screenX: 10,
            screenY: 50, // inside top letterbox area (offsetY = 200)
            containerWidth: 400,
            containerHeight: 800,
            imageWidth: 1000,
            imageHeight: 1000
        });

        expect(coords.imageY).toBe(0);
    });

    it('calculates display bounds with 90 degree rotation (aspect ratio swapped)', () => {
        // Image: 1000x2000 (portrait, ratio 0.5)
        // Rotated 90 deg -> effective: 2000x1000 (landscape, ratio 2.0)
        // Container: 400x800 (ratio 0.5)
        // Container is narrower/taller than effective image -> letterboxing top/bottom
        const bounds = calculateImageDisplayBounds({
            containerWidth: 400,
            containerHeight: 800,
            imageWidth: 1000,
            imageHeight: 2000,
            rotation: 90
        });

        expect(bounds.displayedWidth).toBe(400);
        expect(bounds.displayedHeight).toBe(200); // 400 / 2.0
        expect(bounds.offsetX).toBe(0);
        expect(bounds.offsetY).toBe(300); // (800 - 200) / 2
    });

    it('calculates display bounds with 180 degree rotation (aspect ratio preserved)', () => {
        const bounds = calculateImageDisplayBounds({
            containerWidth: 400,
            containerHeight: 800,
            imageWidth: 1000,
            imageHeight: 1000,
            rotation: 180
        });

        expect(bounds.displayedWidth).toBe(400);
        expect(bounds.displayedHeight).toBe(400);
        expect(bounds.offsetX).toBe(0);
        expect(bounds.offsetY).toBe(200);
    });

    it('calculates display bounds with 270 degree rotation (aspect ratio swapped)', () => {
        const bounds = calculateImageDisplayBounds({
            containerWidth: 400,
            containerHeight: 800,
            imageWidth: 1000,
            imageHeight: 2000,
            rotation: 270
        });

        expect(bounds.displayedWidth).toBe(400);
        expect(bounds.displayedHeight).toBe(200);
        expect(bounds.offsetX).toBe(0);
        expect(bounds.offsetY).toBe(300);
    });

    it('maps screen coordinates correctly for 90 degree clockwise rotation', () => {
        // Container: 400x200, Image: 1000x2000 (effective displayed: 400x200)
        // At 90 deg CW:
        // Screen top-left (0, 0) -> Bitmap (X=0, Y=2000)
        // Screen top-right (400, 0) -> Bitmap (X=0, Y=0)
        // Screen bottom-right (400, 200) -> Bitmap (X=1000, Y=0)
        // Screen bottom-left (0, 200) -> Bitmap (X=1000, Y=2000)
        const topLeft = mapScreenToImageCoordinates({
            screenX: 0,
            screenY: 0,
            containerWidth: 400,
            containerHeight: 200,
            imageWidth: 1000,
            imageHeight: 2000,
            uiFontSize: 16,
            rotation: 90
        });

        expect(topLeft.imageX).toBe(0);
        expect(topLeft.imageY).toBe(2000);
        expect(topLeft.canvasRotation).toBe(270);
        expect(topLeft.fontScale).toBe(5); // imageHeight (2000) / displayedWidth (400)
        expect(topLeft.canvasFontSize).toBe(80); // 16 * 5

        const topRight = mapScreenToImageCoordinates({
            screenX: 400,
            screenY: 0,
            containerWidth: 400,
            containerHeight: 200,
            imageWidth: 1000,
            imageHeight: 2000,
            uiFontSize: 16,
            rotation: 90
        });

        expect(topRight.imageX).toBe(0);
        expect(topRight.imageY).toBe(0);

        const bottomRight = mapScreenToImageCoordinates({
            screenX: 400,
            screenY: 200,
            containerWidth: 400,
            containerHeight: 200,
            imageWidth: 1000,
            imageHeight: 2000,
            uiFontSize: 16,
            rotation: 90
        });

        expect(bottomRight.imageX).toBe(1000);
        expect(bottomRight.imageY).toBe(0);

        const bottomLeft = mapScreenToImageCoordinates({
            screenX: 0,
            screenY: 200,
            containerWidth: 400,
            containerHeight: 200,
            imageWidth: 1000,
            imageHeight: 2000,
            uiFontSize: 16,
            rotation: 90
        });

        expect(bottomLeft.imageX).toBe(1000);
        expect(bottomLeft.imageY).toBe(2000);
    });

    it('maps screen coordinates correctly for 180 degree rotation', () => {
        // Container: 500x1000, Image: 1000x2000
        // Screen top-left (0, 0) -> Bitmap (X=1000, Y=2000)
        // Screen bottom-right (500, 1000) -> Bitmap (X=0, Y=0)
        const topLeft = mapScreenToImageCoordinates({
            screenX: 0,
            screenY: 0,
            containerWidth: 500,
            containerHeight: 1000,
            imageWidth: 1000,
            imageHeight: 2000,
            uiFontSize: 20,
            rotation: 180
        });

        expect(topLeft.imageX).toBe(1000);
        expect(topLeft.imageY).toBe(2000);
        expect(topLeft.canvasRotation).toBe(180);
        expect(topLeft.canvasFontSize).toBe(40); // 20 * (1000 / 500)

        const bottomRight = mapScreenToImageCoordinates({
            screenX: 500,
            screenY: 1000,
            containerWidth: 500,
            containerHeight: 1000,
            imageWidth: 1000,
            imageHeight: 2000,
            uiFontSize: 20,
            rotation: 180
        });

        expect(bottomRight.imageX).toBe(0);
        expect(bottomRight.imageY).toBe(0);
    });

    it('maps screen coordinates correctly for 270 degree clockwise rotation', () => {
        // Container: 400x200, Image: 1000x2000
        // Screen top-left (0, 0) -> Bitmap (X=1000, Y=0)
        // Screen bottom-right (400, 200) -> Bitmap (X=0, Y=2000)
        const topLeft = mapScreenToImageCoordinates({
            screenX: 0,
            screenY: 0,
            containerWidth: 400,
            containerHeight: 200,
            imageWidth: 1000,
            imageHeight: 2000,
            uiFontSize: 20,
            rotation: 270
        });

        expect(topLeft.imageX).toBe(1000);
        expect(topLeft.imageY).toBe(0);
        expect(topLeft.canvasRotation).toBe(90);
        expect(topLeft.fontScale).toBe(5);

        const bottomRight = mapScreenToImageCoordinates({
            screenX: 400,
            screenY: 200,
            containerWidth: 400,
            containerHeight: 200,
            imageWidth: 1000,
            imageHeight: 2000,
            uiFontSize: 20,
            rotation: 270
        });

        expect(bottomRight.imageX).toBe(0);
        expect(bottomRight.imageY).toBe(2000);
    });

    it('supports small font sizes below 12px (e.g. 4px, 6px, 8px)', () => {
        // Container: 500x1000, Image: 1000x2000 (Scale 2.0x)
        const coords4 = mapScreenToImageCoordinates({
            screenX: 50,
            screenY: 50,
            containerWidth: 500,
            containerHeight: 1000,
            imageWidth: 1000,
            imageHeight: 2000,
            uiFontSize: 4
        });
        expect(coords4.canvasFontSize).toBe(8);

        const coords6 = mapScreenToImageCoordinates({
            screenX: 50,
            screenY: 50,
            containerWidth: 500,
            containerHeight: 1000,
            imageWidth: 1000,
            imageHeight: 2000,
            uiFontSize: 6
        });
        expect(coords6.canvasFontSize).toBe(12);

        const coords8 = mapScreenToImageCoordinates({
            screenX: 50,
            screenY: 50,
            containerWidth: 500,
            containerHeight: 1000,
            imageWidth: 1000,
            imageHeight: 2000,
            uiFontSize: 8
        });
        expect(coords8.canvasFontSize).toBe(16);
    });

    it('supports textRotation property on overlay items and burn options', async () => {
        const { burnTextToImageFile } = await import('./textOverlay');
        const emptyResult = await burnTextToImageFile({
            imagePath: '',
            text: 'Hello',
            screenX: 10,
            screenY: 10,
            textRotation: 90
        });
        expect(emptyResult.success).toBe(false);

        const blankTextResult = await burnTextToImageFile({
            imagePath: '/fake/path.jpg',
            text: '   ',
            screenX: 10,
            screenY: 10,
            textRotation: 180
        });
        expect(blankTextResult.success).toBe(false);
    });
});

describe('calculateTextBoundingBoxInImage', () => {
    it('calculates unrotated text box bounding box with margin', async () => {
        const { calculateTextBoundingBoxInImage } = await import('./textOverlay');
        const bbox = calculateTextBoundingBoxInImage({
            imageX: 100,
            imageY: 200,
            boxWidth: 300,
            boxHeight: 100,
            canvasRotation: 0,
            textRotation: 0,
            imageWidth: 1000,
            imageHeight: 1000,
            fontScale: 1
        });

        // margin = max(8, ceil(8*1)) = 8
        // minX = 100, maxX = 400 -> patchX = 92, patchWidth = 316
        // minY = 200, maxY = 300 -> patchY = 192, patchHeight = 116
        expect(bbox.patchX).toBe(92);
        expect(bbox.patchY).toBe(192);
        expect(bbox.patchWidth).toBe(316);
        expect(bbox.patchHeight).toBe(116);
    });

    it('clamps patch coordinates to image boundaries', async () => {
        const { calculateTextBoundingBoxInImage } = await import('./textOverlay');
        const bbox = calculateTextBoundingBoxInImage({
            imageX: 2,
            imageY: 3,
            boxWidth: 200,
            boxHeight: 50,
            canvasRotation: 0,
            textRotation: 0,
            imageWidth: 205,
            imageHeight: 60,
            fontScale: 1
        });

        expect(bbox.patchX).toBe(0);
        expect(bbox.patchY).toBe(0);
        expect(bbox.patchX + bbox.patchWidth).toBeLessThanOrEqual(205);
        expect(bbox.patchY + bbox.patchHeight).toBeLessThanOrEqual(60);
    });

    it('handles rotated text boxes with expanded bounding box', async () => {
        const { calculateTextBoundingBoxInImage } = await import('./textOverlay');
        const unrotated = calculateTextBoundingBoxInImage({
            imageX: 500,
            imageY: 500,
            boxWidth: 200,
            boxHeight: 100,
            canvasRotation: 0,
            textRotation: 0,
            imageWidth: 2000,
            imageHeight: 2000,
            fontScale: 1
        });

        const rotated = calculateTextBoundingBoxInImage({
            imageX: 500,
            imageY: 500,
            boxWidth: 200,
            boxHeight: 100,
            canvasRotation: 0,
            textRotation: 90,
            imageWidth: 2000,
            imageHeight: 2000,
            fontScale: 1
        });

        // When rotated 90 degrees around center, width and height of the box swap
        expect(rotated.patchWidth).toBeGreaterThan(0);
        expect(rotated.patchHeight).toBeGreaterThan(0);
        expect(rotated.patchHeight).toBe(unrotated.patchWidth);
        expect(rotated.patchWidth).toBe(unrotated.patchHeight);
    });
});

describe('restoreCleanPatch', () => {
    it('returns false when cleanPatch or coordinates are missing', async () => {
        const { restoreCleanPatch } = await import('./textOverlay');
        const res1 = await restoreCleanPatch('/path/image.jpg', {
            text: 'Hello',
            screenX: 10,
            screenY: 10,
            containerWidth: 400,
            containerHeight: 800
        });
        expect(res1).toBe(false);

        const res2 = await restoreCleanPatch('', {
            text: 'Hello',
            screenX: 10,
            screenY: 10,
            containerWidth: 400,
            containerHeight: 800,
            cleanPatch: 'mock-base64',
            patchX: 10,
            patchY: 10
        });
        expect(res2).toBe(false);
    });
});
