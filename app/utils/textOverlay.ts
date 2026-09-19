import { Canvas, Paint, Style } from '@nativescript-community/ui-canvas';
import { getImagePipeline } from '@nativescript-community/ui-image';
import { Color, File, ImageSource } from '@nativescript/core';
import { getImageExportSettings } from '~/utils/constants';
import { recycleImages } from '~/utils/images';

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
    canvasRotation?: number;
    fontScale?: number;
}

export interface TextOverlayItem {
    text: string;
    screenX: number;
    screenY: number;
    containerWidth: number;
    containerHeight: number;
    fontSize?: number;
    color?: string;
    hasBorder?: boolean;
    rotation?: number;
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
    rotation?: number;
    hasBorder?: boolean;
}

/**
 * Calculates letterboxed bounds for an aspect-fit image within a given container,
 * accounting for active image rotation (0, 90, 180, 270).
 */
export function calculateImageDisplayBounds({
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight,
    rotation = 0
}: {
    containerWidth: number;
    containerHeight: number;
    imageWidth: number;
    imageHeight: number;
    rotation?: number;
}): DisplayBounds {
    if (!containerWidth || !containerHeight || !imageWidth || !imageHeight) {
        return {
            displayedWidth: containerWidth || 0,
            displayedHeight: containerHeight || 0,
            offsetX: 0,
            offsetY: 0
        };
    }

    const normRotation = ((rotation % 360) + 360) % 360;
    const isRotated90or270 = normRotation === 90 || normRotation === 270;
    const effectiveWidth = isRotated90or270 ? imageHeight : imageWidth;
    const effectiveHeight = isRotated90or270 ? imageWidth : imageHeight;

    const imageRatio = effectiveWidth / effectiveHeight;
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
 * Maps screen coordinates (e.g. from AbsoluteLayout / PanGesture) into native image bitmap pixel coordinates,
 * accounting for 0, 90, 180, 270 degree rotations.
 */
export function mapScreenToImageCoordinates({
    screenX,
    screenY,
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight,
    uiFontSize = 24,
    rotation = 0
}: {
    screenX: number;
    screenY: number;
    containerWidth: number;
    containerHeight: number;
    imageWidth: number;
    imageHeight: number;
    uiFontSize?: number;
    rotation?: number;
}): ImageCoordinates {
    const normRotation = ((rotation % 360) + 360) % 360;
    const isRotated90or270 = normRotation === 90 || normRotation === 270;

    const { displayedWidth, displayedHeight, offsetX, offsetY } = calculateImageDisplayBounds({
        containerWidth,
        containerHeight,
        imageWidth,
        imageHeight,
        rotation: normRotation
    });

    const fontScale = isRotated90or270
        ? (displayedWidth > 0 ? imageHeight / displayedWidth : 1)
        : (displayedWidth > 0 ? imageWidth / displayedWidth : 1);

    // Clamp relative coordinates within displayed image area
    const relativeX = Math.max(0, Math.min(displayedWidth, screenX - offsetX));
    const relativeY = Math.max(0, Math.min(displayedHeight, screenY - offsetY));

    const u = displayedWidth > 0 ? relativeX / displayedWidth : 0;
    const v = displayedHeight > 0 ? relativeY / displayedHeight : 0;

    let imageX: number;
    let imageY: number;
    let canvasRotation = 0;

    if (normRotation === 90) {
        imageX = v * imageWidth;
        imageY = (1 - u) * imageHeight;
        canvasRotation = 270;
    } else if (normRotation === 180) {
        imageX = (1 - u) * imageWidth;
        imageY = (1 - v) * imageHeight;
        canvasRotation = 180;
    } else if (normRotation === 270) {
        imageX = (1 - v) * imageWidth;
        imageY = u * imageHeight;
        canvasRotation = 90;
    } else {
        imageX = u * imageWidth;
        imageY = v * imageHeight;
        canvasRotation = 0;
    }

    const canvasFontSize = uiFontSize * fontScale;

    return {
        imageX,
        imageY,
        canvasFontSize,
        canvasRotation,
        fontScale
    };
}

/**
 * Renders text (and optional border) directly onto an image bitmap file and overwrites it.
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
    compressQuality,
    rotation = 0,
    hasBorder = false
}: BurnTextOptions): Promise<{ success: boolean; width: number; height: number; size: number }> {
    if (!imagePath || !text?.trim()) {
        return { success: false, width: 0, height: 0, size: 0 };
    }

    const cleanPath = imagePath.split('?')[0];
    const imageSource = await ImageSource.fromFile(cleanPath);
    if (!imageSource) {
        throw new Error(`Failed to load image from path: ${cleanPath}`);
    }

    const imageWidth = imageSource.width;
    const imageHeight = imageSource.height;

    const { imageX, imageY, canvasFontSize, canvasRotation = 0, fontScale = 1 } = mapScreenToImageCoordinates({
        screenX,
        screenY,
        containerWidth,
        containerHeight,
        imageWidth,
        imageHeight,
        uiFontSize: fontSize,
        rotation
    });

    // Create a new mutable Canvas with the exact image dimensions
    const canvas = new Canvas(imageWidth, imageHeight);
    if (__ANDROID__ && imageSource.android) {
        canvas.setDensity(imageSource.android.getDensity());
    }
    canvas.drawBitmap(imageSource, 0, 0, null);

    const paint = new Paint();
    paint.color = new Color(color);
    paint.style = Style.FILL;
    paint.textSize = canvasFontSize;
    paint.setFontWeight?.('bold');
    paint.setAntiAlias(true);

    // Text rendering: support multiple lines
    const lines = text.split('\n');
    const lineHeight = canvasFontSize * 1.2;
    let maxLineWidth = 0;
    for (let i = 0; i < lines.length; i++) {
        const w = paint.measureText(lines[i]);
        if (w > maxLineWidth) {
            maxLineWidth = w;
        }
    }
    const padding = 4 * fontScale;
    const totalTextHeight = lines.length * lineHeight;

    canvas.save();
    canvas.translate(imageX, imageY);
    if (canvasRotation !== 0) {
        canvas.rotate(canvasRotation);
    }

    if (hasBorder) {
        const borderPaint = new Paint();
        borderPaint.color = new Color(color);
        borderPaint.style = Style.STROKE;
        borderPaint.strokeWidth = Math.max(2 * fontScale, 2);
        borderPaint.setAntiAlias(true);
        canvas.drawRoundRect(0, 0, maxLineWidth + padding * 2, totalTextHeight + padding * 2, 4 * fontScale, 4 * fontScale, borderPaint);
    }

    for (let i = 0; i < lines.length; i++) {
        canvas.drawText(lines[i], padding, padding + canvasFontSize + i * lineHeight, paint);
    }

    canvas.restore();

    const imageExportSettings = getImageExportSettings();
    const quality = compressQuality !== undefined ? compressQuality : imageExportSettings.imageQuality;
    const format = cleanPath.toLowerCase().endsWith('.png') ? 'png' : 'jpg';

    const outputImage = new ImageSource(canvas.getImage());
    const saved = await outputImage.saveToFileAsync(cleanPath, format as any, quality);
    recycleImages(imageSource, outputImage);
    canvas.release();

    if (saved) {
        try {
            await getImagePipeline().evictFromCache(cleanPath);
            if (imagePath !== cleanPath) {
                await getImagePipeline().evictFromCache(imagePath);
            }
        } catch (e) {
            DEV_LOG && console.log('evictFromCache error (ignored):', e);
        }
        const file = File.fromPath(cleanPath);
        return {
            success: true,
            width: imageWidth,
            height: imageHeight,
            size: file.size
        };
    }

    return { success: false, width: imageWidth, height: imageHeight, size: 0 };
}

/**
 * Automatically re-applies stored text overlays onto an image file (e.g. after transform or recrop).
 */
export async function reapplyTextOverlays(
    imagePath: string,
    textOverlays: TextOverlayItem[],
    pageRotation: number = 0
): Promise<void> {
    if (!imagePath || !textOverlays?.length) {
        return;
    }
    for (const overlay of textOverlays) {
        if (!overlay.text || !overlay.text.trim()) {
            continue;
        }
        await burnTextToImageFile({
            imagePath,
            text: overlay.text,
            screenX: overlay.screenX,
            screenY: overlay.screenY,
            containerWidth: overlay.containerWidth,
            containerHeight: overlay.containerHeight,
            fontSize: overlay.fontSize,
            color: overlay.color,
            rotation: overlay.rotation !== undefined ? overlay.rotation : pageRotation,
            hasBorder: overlay.hasBorder
        });
    }
}
