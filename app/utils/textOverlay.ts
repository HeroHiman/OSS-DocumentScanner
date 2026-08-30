import { Canvas, Paint, Style } from '@nativescript-community/ui-canvas';
import { getImagePipeline } from '@nativescript-community/ui-image';
import { Color, File, ImageSource } from '@nativescript/core';
import { getImageExportSettings } from '~/utils/constants';

export interface DisplayBounds {
    displayedWidth: number;
    displayedHeight: number;
    offsetX: number;
    offsetY: number;
}

export interface ImageCoordinates {
    imageX: number;
    imageY: number;
    canvasFontSize: number;
}

export interface BurnTextOptions {
    imagePath: string;
    text: string;
    screenX: number;
    screenY: number;
    containerWidth: number;
    containerHeight: number;
    fontSize?: number;
    color?: string;
    compressQuality?: number;
    imageWidth?: number;
    imageHeight?: number;
}

/**
 * Calculates letterboxed bounds for an aspect-fit image within a given container.
 */
export function calculateImageDisplayBounds({
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight
}: {
    containerWidth: number;
    containerHeight: number;
    imageWidth: number;
    imageHeight: number;
}): DisplayBounds {
    if (!containerWidth || !containerHeight || !imageWidth || !imageHeight) {
        return {
            displayedWidth: containerWidth || 0,
            displayedHeight: containerHeight || 0,
            offsetX: 0,
            offsetY: 0
        };
    }

    const imageRatio = imageWidth / imageHeight;
    const containerRatio = containerWidth / containerHeight;

    let displayedWidth: number;
    let displayedHeight: number;
    let offsetX = 0;
    let offsetY = 0;

    if (containerRatio > imageRatio) {
        // Container is wider than the image -> pillarboxing (bars on left/right)
        displayedHeight = containerHeight;
        displayedWidth = containerHeight * imageRatio;
        offsetX = (containerWidth - displayedWidth) / 2;
        offsetY = 0;
    } else {
        // Container is taller than the image -> letterboxing (bars on top/bottom)
        displayedWidth = containerWidth;
        displayedHeight = containerWidth / imageRatio;
        offsetX = 0;
        offsetY = (containerHeight - displayedHeight) / 2;
    }

    return {
        displayedWidth,
        displayedHeight,
        offsetX,
        offsetY
    };
}

/**
 * Maps screen coordinates (e.g. from AbsoluteLayout / PanGesture) into native image bitmap pixel coordinates.
 */
export function mapScreenToImageCoordinates({
    screenX,
    screenY,
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight,
    uiFontSize = 24
}: {
    screenX: number;
    screenY: number;
    containerWidth: number;
    containerHeight: number;
    imageWidth: number;
    imageHeight: number;
    uiFontSize?: number;
}): ImageCoordinates {
    const { displayedWidth, displayedHeight, offsetX, offsetY } = calculateImageDisplayBounds({
        containerWidth,
        containerHeight,
        imageWidth,
        imageHeight
    });

    const scaleX = displayedWidth > 0 ? imageWidth / displayedWidth : 1;
    const scaleY = displayedHeight > 0 ? imageHeight / displayedHeight : 1;

    // Clamp relative coordinates within displayed image area
    const relativeX = Math.max(0, screenX - offsetX);
    const relativeY = Math.max(0, screenY - offsetY);

    const imageX = relativeX * scaleX;
    const imageY = relativeY * scaleY;
    const canvasFontSize = uiFontSize * scaleX;

    return {
        imageX,
        imageY,
        canvasFontSize
    };
}

/**
 * Renders text directly onto an image bitmap file and overwrites it.
 */
export async function burnTextToImageFile({
    imagePath,
    text,
    screenX,
    screenY,
    containerWidth,
    containerHeight,
    fontSize = 24,
    color = '#ff0000',
    compressQuality
}: BurnTextOptions): Promise<{ success: boolean; width: number; height: number; size: number }> {
    if (!imagePath || !text?.trim()) {
        return { success: false, width: 0, height: 0, size: 0 };
    }

    const imageSource = await ImageSource.fromFile(imagePath);
    if (!imageSource) {
        throw new Error(`Failed to load image from path: ${imagePath}`);
    }

    const imageWidth = imageSource.width;
    const imageHeight = imageSource.height;

    const { imageX, imageY, canvasFontSize } = mapScreenToImageCoordinates({
        screenX,
        screenY,
        containerWidth,
        containerHeight,
        imageWidth,
        imageHeight,
        uiFontSize: fontSize
    });

    // Create Canvas over ImageSource bitmap
    const canvas = new Canvas(imageSource);
    const paint = new Paint();
    paint.color = new Color(color);
    paint.style = Style.FILL;
    paint.textSize = canvasFontSize;
    paint.antiAlias = true;

    // Text rendering: support multiple lines
    const lines = text.split('\n');
    const lineHeight = canvasFontSize * 1.2;

    for (let i = 0; i < lines.length; i++) {
        // Draw text with baseline adjustment
        canvas.drawText(lines[i], imageX, imageY + canvasFontSize + i * lineHeight, paint);
    }

    const imageExportSettings = getImageExportSettings();
    const quality = compressQuality !== undefined ? compressQuality : imageExportSettings.imageQuality;
    const format = imagePath.toLowerCase().endsWith('.png') ? 'png' : 'jpg';

    const saved = imageSource.saveToFile(imagePath, format as any, quality);

    if (saved) {
        try {
            await getImagePipeline().evictFromCache(imagePath);
        } catch (e) {
            DEV_LOG && console.log('evictFromCache error (ignored):', e);
        }
        const file = File.fromPath(imagePath);
        return {
            success: true,
            width: imageWidth,
            height: imageHeight,
            size: file.size
        };
    }

    return { success: false, width: imageWidth, height: imageHeight, size: 0 };
}
