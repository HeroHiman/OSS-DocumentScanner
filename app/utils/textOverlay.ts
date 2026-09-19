import { Canvas, Paint, Rect, Style } from '@nativescript-community/ui-canvas';
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
    textRotation?: number;
    cleanPatch?: string;
    patchX?: number;
    patchY?: number;
    patchWidth?: number;
    patchHeight?: number;
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
    textRotation?: number;
    hasBorder?: boolean;
}

export interface BurnTextResult {
    success: boolean;
    width: number;
    height: number;
    size: number;
    cleanPatch?: string;
    patchX?: number;
    patchY?: number;
    patchWidth?: number;
    patchHeight?: number;
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
 * Computes the axis-aligned pixel bounding box of a text box on the native image bitmap,
 * taking into account page rotation (canvasRotation: 0, 90, 180, 270) and text rotation.
 */
export function calculateTextBoundingBoxInImage({
    imageX,
    imageY,
    boxWidth,
    boxHeight,
    canvasRotation = 0,
    textRotation = 0,
    imageWidth,
    imageHeight,
    fontScale = 1
}: {
    imageX: number;
    imageY: number;
    boxWidth: number;
    boxHeight: number;
    canvasRotation?: number;
    textRotation?: number;
    imageWidth: number;
    imageHeight: number;
    fontScale?: number;
}): { patchX: number; patchY: number; patchWidth: number; patchHeight: number } {
    const normTextRotation = ((textRotation % 360) + 360) % 360;
    const radT = (normTextRotation * Math.PI) / 180;
    const cosT = Math.cos(radT);
    const sinT = Math.sin(radT);

    const normCanvasRotation = ((canvasRotation % 360) + 360) % 360;
    const radC = (normCanvasRotation * Math.PI) / 180;
    const cosC = Math.cos(radC);
    const sinC = Math.sin(radC);

    const cx = boxWidth / 2;
    const cy = boxHeight / 2;

    const corners = [
        { x: 0, y: 0 },
        { x: boxWidth, y: 0 },
        { x: boxWidth, y: boxHeight },
        { x: 0, y: boxHeight }
    ];

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of corners) {
        // 1. Rotate around box center by normTextRotation
        let rx = p.x;
        let ry = p.y;
        if (normTextRotation !== 0) {
            const dx = p.x - cx;
            const dy = p.y - cy;
            rx = dx * cosT - dy * sinT + cx;
            ry = dx * sinT + dy * cosT + cy;
        }

        // 2. Rotate around (0, 0) by canvasRotation and translate to (imageX, imageY)
        const gx = rx * cosC - ry * sinC + imageX;
        const gy = rx * sinC + ry * cosC + imageY;

        if (gx < minX) minX = gx;
        if (gx > maxX) maxX = gx;
        if (gy < minY) minY = gy;
        if (gy > maxY) maxY = gy;
    }

    const margin = Math.max(8, Math.ceil(8 * fontScale));
    const patchX = Math.max(0, Math.floor(minX - margin));
    const patchY = Math.max(0, Math.floor(minY - margin));
    const patchRight = Math.min(imageWidth, Math.ceil(maxX + margin));
    const patchBottom = Math.min(imageHeight, Math.ceil(maxY + margin));
    const patchWidth = Math.max(1, patchRight - patchX);
    const patchHeight = Math.max(1, patchBottom - patchY);

    return { patchX, patchY, patchWidth, patchHeight };
}

/**
 * Renders text (and optional border) directly onto an image bitmap file and overwrites it.
 * Also extracts a clean background patch under the text box before writing, enabling clean re-editing.
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
    textRotation = 0,
    hasBorder = false
}: BurnTextOptions): Promise<BurnTextResult> {
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
    const boxWidth = maxLineWidth + padding * 2;
    const boxHeight = lines.length * lineHeight + padding * 2;

    const normTextRotation = ((textRotation % 360) + 360) % 360;

    // Calculate bounding box and extract clean background patch before drawing text
    const bbox = calculateTextBoundingBoxInImage({
        imageX,
        imageY,
        boxWidth,
        boxHeight,
        canvasRotation,
        textRotation: normTextRotation,
        imageWidth,
        imageHeight,
        fontScale
    });

    let cleanPatch: string | undefined;
    const patchX = bbox.patchX;
    const patchY = bbox.patchY;
    const patchWidth = bbox.patchWidth;
    const patchHeight = bbox.patchHeight;

    try {
        const patchCanvas = new Canvas(patchWidth, patchHeight);
        if (__ANDROID__ && imageSource.android) {
            patchCanvas.setDensity(imageSource.android.getDensity());
        }
        const srcRect = new Rect(patchX, patchY, patchX + patchWidth, patchY + patchHeight);
        const dstRect = new Rect(0, 0, patchWidth, patchHeight);
        patchCanvas.drawBitmap(imageSource, srcRect, dstRect, null);
        const patchImage = new ImageSource(patchCanvas.getImage());
        cleanPatch = typeof patchImage.toBase64StringAsync === 'function'
            ? await patchImage.toBase64StringAsync('png')
            : patchImage.toBase64String('png');
        recycleImages(patchImage);
        patchCanvas.release();
    } catch (e) {
        DEV_LOG && console.log('Error capturing clean patch in burnTextToImageFile:', e);
    }

    // Create a new mutable Canvas with the exact image dimensions
    const canvas = new Canvas(imageWidth, imageHeight);
    if (__ANDROID__ && imageSource.android) {
        canvas.setDensity(imageSource.android.getDensity());
    }
    canvas.drawBitmap(imageSource, 0, 0, null);

    canvas.save();
    // 1. Position and orient to match the page's visual screen coordinate system
    canvas.translate(imageX, imageY);
    if (canvasRotation !== 0) {
        canvas.rotate(canvasRotation);
    }

    // 2. Rotate text around the center of the text box if textRotation is set
    if (normTextRotation !== 0) {
        canvas.translate(boxWidth / 2, boxHeight / 2);
        canvas.rotate(normTextRotation);
        canvas.translate(-boxWidth / 2, -boxHeight / 2);
    }

    if (hasBorder) {
        const borderPaint = new Paint();
        borderPaint.color = new Color(color);
        borderPaint.style = Style.STROKE;
        borderPaint.strokeWidth = Math.max(2 * fontScale, 2);
        borderPaint.setAntiAlias(true);
        canvas.drawRoundRect(0, 0, boxWidth, boxHeight, 4 * fontScale, 4 * fontScale, borderPaint);
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
            size: file.size,
            cleanPatch,
            patchX,
            patchY,
            patchWidth,
            patchHeight
        };
    }

    return { success: false, width: imageWidth, height: imageHeight, size: 0 };
}

/**
 * Overwrites the text area on an image with a stored clean background patch,
 * erasing any previously burned text overlay.
 */
export async function restoreCleanPatch(
    imagePath: string,
    overlay: TextOverlayItem
): Promise<boolean> {
    if (!imagePath || !overlay?.cleanPatch || overlay.patchX === undefined || overlay.patchY === undefined) {
        return false;
    }
    const cleanPath = imagePath.split('?')[0];
    if (!File.exists(cleanPath)) {
        return false;
    }
    try {
        const imageSource = await ImageSource.fromFile(cleanPath);
        if (!imageSource) {
            return false;
        }

        const patchImageSource = typeof ImageSource.fromBase64 === 'function'
            ? await ImageSource.fromBase64(overlay.cleanPatch)
            : ImageSource.fromBase64Sync(overlay.cleanPatch);

        if (!patchImageSource) {
            recycleImages(imageSource);
            return false;
        }

        const canvas = new Canvas(imageSource.width, imageSource.height);
        if (__ANDROID__ && imageSource.android) {
            canvas.setDensity(imageSource.android.getDensity());
        }
        canvas.drawBitmap(imageSource, 0, 0, null);
        canvas.drawBitmap(patchImageSource, overlay.patchX, overlay.patchY, null);

        const imageExportSettings = getImageExportSettings();
        const format = cleanPath.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
        const outputImage = new ImageSource(canvas.getImage());
        const saved = await outputImage.saveToFileAsync(cleanPath, format as any, imageExportSettings.imageQuality);

        recycleImages(imageSource, patchImageSource, outputImage);
        canvas.release();

        if (saved) {
            try {
                await getImagePipeline().evictFromCache(cleanPath);
                if (imagePath !== cleanPath) {
                    await getImagePipeline().evictFromCache(imagePath);
                }
            } catch (e) {}
            return true;
        }
    } catch (err) {
        DEV_LOG && console.log('restoreCleanPatch error:', err);
    }
    return false;
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
        const result = await burnTextToImageFile({
            imagePath,
            text: overlay.text,
            screenX: overlay.screenX,
            screenY: overlay.screenY,
            containerWidth: overlay.containerWidth,
            containerHeight: overlay.containerHeight,
            fontSize: overlay.fontSize,
            color: overlay.color,
            rotation: overlay.rotation !== undefined ? overlay.rotation : pageRotation,
            textRotation: overlay.textRotation ?? 0,
            hasBorder: overlay.hasBorder
        });
        if (result.success && result.cleanPatch) {
            overlay.cleanPatch = result.cleanPatch;
            overlay.patchX = result.patchX;
            overlay.patchY = result.patchY;
            overlay.patchWidth = result.patchWidth;
            overlay.patchHeight = result.patchHeight;
        }
    }
}
