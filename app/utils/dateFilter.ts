import dayjs from 'dayjs';
import type { OCRDocument, OCRPage } from '~/models/OCRDocument';

/**
 * Parses any date representation (number, timestamp in seconds or ms, ISO string, or formatted string) to ms timestamp.
 */
export function parseDateToTimestamp(value: any): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    if (typeof value === 'number' && !isNaN(value) && value > 0) {
        // If in seconds (< 10 billion), convert to ms
        return value < 10000000000 ? value * 1000 : value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        // 8-digit numeric string: YYYYMMDD (e.g. 20260226)
        if (trimmed.length === 8 && /^\d{8}$/.test(trimmed)) {
            const y = parseInt(trimmed.substring(0, 4), 10);
            const m = parseInt(trimmed.substring(4, 6), 10) - 1;
            const d = parseInt(trimmed.substring(6, 8), 10);
            const dt = dayjs().year(y).month(m).date(d).startOf('day');
            if (dt.isValid()) {
                return dt.valueOf();
            }
        }
        const num = Number(trimmed);
        if (!isNaN(num) && num > 0) {
            return num < 10000000000 ? num * 1000 : num;
        }

        // Try matching DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
        const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
        if (dmyMatch) {
            const p1 = parseInt(dmyMatch[1], 10);
            const p2 = parseInt(dmyMatch[2], 10);
            const year = parseInt(dmyMatch[3], 10);
            let day = p1;
            let month = p2 - 1;
            if (p1 <= 12 && p2 > 12) {
                // MM/DD/YYYY
                month = p1 - 1;
                day = p2;
            }
            const dt = dayjs().year(year).month(month).date(day).startOf('day');
            if (dt.isValid()) {
                return dt.valueOf();
            }
        }

        // Try matching YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
        const ymdMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
        if (ymdMatch) {
            const year = parseInt(ymdMatch[1], 10);
            const month = parseInt(ymdMatch[2], 10) - 1;
            const day = parseInt(ymdMatch[3], 10);
            const dt = dayjs().year(year).month(month).date(day).startOf('day');
            if (dt.isValid()) {
                return dt.valueOf();
            }
        }

        const d = dayjs(trimmed);
        if (d.isValid()) {
            return d.valueOf();
        }
        const parsed = Date.parse(trimmed);
        if (!isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
        return value.getTime();
    }
    if (dayjs.isDayjs(value) && value.isValid()) {
        return value.valueOf();
    }
    return null;
}

/**
 * Extracts a representative timestamp from an OCRPage.
 * Fallback priority:
 * 1. page.extra.dateTimestamp / date / extractedDate (user/OCR document date)
 * 2. document.extra.dateTimestamp / date
 * 3. page.createdDate
 * 4. page.id timestamp prefix (e.g. 1725264000000_0)
 * 5. page.modifiedDate
 * 6. document.createdDate
 * 7. document.modifiedDate
 */
export function getPageTimestamp(page: OCRPage, document?: OCRDocument): number {
    if (!page) {
        return 0;
    }

    // 1. Check page.extra
    let pageExtra: any = page.extra;
    if (typeof pageExtra === 'string') {
        try {
            pageExtra = JSON.parse(pageExtra);
        } catch (e) {}
    }
    if (pageExtra) {
        const extraTimestamp =
            parseDateToTimestamp(pageExtra.dateTimestamp) ||
            parseDateToTimestamp(pageExtra.date) ||
            parseDateToTimestamp(pageExtra.extractedDate);
        if (extraTimestamp) {
            return extraTimestamp;
        }
    }

    // 2. Check document.extra
    let docExtra: any = document?.extra;
    if (typeof docExtra === 'string') {
        try {
            docExtra = JSON.parse(docExtra);
        } catch (e) {}
    }
    if (docExtra) {
        const extraTimestamp =
            parseDateToTimestamp(docExtra.dateTimestamp) ||
            parseDateToTimestamp(docExtra.date) ||
            parseDateToTimestamp(docExtra.extractedDate);
        if (extraTimestamp) {
            return extraTimestamp;
        }
    }

    // 3. Check page.createdDate
    const pageCreated = parseDateToTimestamp(page.createdDate);
    if (pageCreated) {
        return pageCreated;
    }

    // 4. Check page.id timestamp prefix (e.g. "1725264000000_0")
    if (page.id) {
        const firstSegment = page.id.split('_')[0];
        const num = parseDateToTimestamp(firstSegment);
        if (num && num > 1000000000000) {
            return num;
        }
    }

    // 5. Check page.modifiedDate
    const pageModified = parseDateToTimestamp(page.modifiedDate);
    if (pageModified) {
        return pageModified;
    }

    // 6. Check document.createdDate
    const docCreated = parseDateToTimestamp(document?.createdDate);
    if (docCreated) {
        return docCreated;
    }

    // 7. Check document.modifiedDate
    const docModified = parseDateToTimestamp(document?.modifiedDate);
    if (docModified) {
        return docModified;
    }

    return 0;
}

/**
 * Filters document pages based on an inclusive date range (start of startDate to end of endDate).
 */
export function filterPagesByDateRange<T extends { page: OCRPage; document?: OCRDocument }>(
    pages: T[],
    startDate?: number | string | dayjs.Dayjs | null,
    endDate?: number | string | dayjs.Dayjs | null
): T[] {
    if (!startDate && !endDate) {
        return pages;
    }

    const startVal = startDate ? parseDateToTimestamp(startDate) : null;
    const endVal = endDate ? parseDateToTimestamp(endDate) : null;

    const startMs = startVal ? dayjs(startVal).startOf('day').valueOf() : null;
    const endMs = endVal ? dayjs(endVal).endOf('day').valueOf() : null;

    return pages.filter(({ page, document }) => {
        const timestamp = getPageTimestamp(page, document);
        if (!timestamp) {
            return false;
        }
        if (startMs !== null && timestamp < startMs) {
            return false;
        }
        if (endMs !== null && timestamp > endMs) {
            return false;
        }
        return true;
    });
}
