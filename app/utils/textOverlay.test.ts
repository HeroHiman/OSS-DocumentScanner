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
});
