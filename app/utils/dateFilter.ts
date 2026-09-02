import dayjs from 'dayjs';
import type { OCRDocument, OCRPage } from '~/models/OCRDocument';

/**
 * Extracts a representative timestamp from an OCRPage.
 * Fallback priority: page.createdDate -> id timestamp -> page.modifiedDate -> document.createdDate -> 0
 */
export function getPageTimestamp(page: OCRPage, document?: OCRDocument): number {
    if (page.createdDate) {
        return page.createdDate;
    }
    if (page.id) {
        const firstSegment = page.id.split('_')[0];
        const num = Number(firstSegment);
        if (!isNaN(num) && num > 1000000000000) {
            return num;
        }
    }
    if (page.modifiedDate) {
        return page.modifiedDate;
    }
    if (document?.createdDate) {
        return document.createdDate;
    }
    return 0;
}

/**
 * Filters document pages based on an inclusive date range (start of startDate to end of endDate).
 */
export function filterPagesByDateRange<T extends { page: OCRPage; document?: OCRDocument }>(
    pages: T[],
    startDate?: number | dayjs.Dayjs | null,
    endDate?: number | dayjs.Dayjs | null
): T[] {
    if (!startDate && !endDate) {
        return pages;
    }

    const startMs = startDate ? dayjs(startDate).startOf('day').valueOf() : null;
    const endMs = endDate ? dayjs(endDate).endOf('day').valueOf() : null;

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
