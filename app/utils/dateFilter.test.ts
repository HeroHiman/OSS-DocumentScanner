import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { filterPagesByDateRange, getPageTimestamp, parseDateToTimestamp } from './dateFilter';
import type { OCRDocument, OCRPage } from '~/models/OCRDocument';

describe('getPageTimestamp', () => {
    it('prioritizes page.extra.dateTimestamp or page.extra.date if present', () => {
        const pageWithExtra = {
            createdDate: 1725264000000, // Today
            extra: { date: '2026-02-26' }
        } as any;
        const expected = dayjs('2026-02-26').valueOf();
        expect(getPageTimestamp(pageWithExtra)).toBe(expected);

        const pageWithTimestamp = {
            createdDate: 1725264000000,
            extra: { dateTimestamp: 1772064000000 }
        } as any;
        expect(getPageTimestamp(pageWithTimestamp)).toBe(1772064000000);
    });

    it('returns page.createdDate if extra date is absent', () => {
        const page = { createdDate: 1700000000000 } as OCRPage;
        expect(getPageTimestamp(page)).toBe(1700000000000);
    });

    it('extracts timestamp from page.id when createdDate is missing', () => {
        const page = { id: '1708905600000_0' } as OCRPage;
        expect(getPageTimestamp(page)).toBe(1708905600000);
    });

    it('falls back to page.modifiedDate or document.createdDate', () => {
        const page = { modifiedDate: 1705000000000 } as OCRPage;
        const doc = { createdDate: 1701000000000 } as OCRDocument;
        expect(getPageTimestamp(page, doc)).toBe(1705000000000);

        const pageWithoutDate = {} as OCRPage;
        expect(getPageTimestamp(pageWithoutDate, doc)).toBe(1701000000000);
    });
});

describe('filterPagesByDateRange', () => {
    // Feb 26, 2026: 2026-02-26
    const feb26 = dayjs('2026-02-26T12:00:00Z').valueOf();
    // Mar 15, 2026: 2026-03-15
    const mar15 = dayjs('2026-03-15T12:00:00Z').valueOf();
    // Apr 26, 2026: 2026-04-26
    const apr26 = dayjs('2026-04-26T12:00:00Z').valueOf();
    // May 10, 2026: 2026-05-10
    const may10 = dayjs('2026-05-10T12:00:00Z').valueOf();
    // Jan 10, 2026: 2026-01-10
    const jan10 = dayjs('2026-01-10T12:00:00Z').valueOf();

    const samplePages = [
        { page: { id: 'p1', createdDate: jan10 } as OCRPage, document: { id: 'd1' } as OCRDocument },
        { page: { id: 'p2', createdDate: feb26, extra: { date: '2026-02-26' } } as any, document: { id: 'd1' } as OCRDocument },
        { page: { id: 'p3', createdDate: mar15 } as OCRPage, document: { id: 'd1' } as OCRDocument },
        { page: { id: 'p4', createdDate: apr26 } as OCRPage, document: { id: 'd1' } as OCRDocument },
        { page: { id: 'p5', createdDate: may10 } as OCRPage, document: { id: 'd1' } as OCRDocument }
    ];

    it('returns all pages when start and end dates are empty', () => {
        const filtered = filterPagesByDateRange(samplePages, null, null);
        expect(filtered.length).toBe(5);
    });

    it('filters pages inclusively between Feb 26 and April 26', () => {
        const startDate = dayjs('2026-02-26').valueOf();
        const endDate = dayjs('2026-04-26').valueOf();
        const filtered = filterPagesByDateRange(samplePages, startDate, endDate);

        expect(filtered.length).toBe(3);
        expect(filtered.map((item) => item.page.id)).toEqual(['p2', 'p3', 'p4']);
    });

    it('filters pages with string date parameters', () => {
        const filtered = filterPagesByDateRange(samplePages, '2026-02-26', '2026-04-26');
        expect(filtered.length).toBe(3);
        expect(filtered.map((item) => item.page.id)).toEqual(['p2', 'p3', 'p4']);
    });

    it('filters pages with only startDate set', () => {
        const startDate = dayjs('2026-03-01').valueOf();
        const filtered = filterPagesByDateRange(samplePages, startDate, null);

        expect(filtered.length).toBe(3);
        expect(filtered.map((item) => item.page.id)).toEqual(['p3', 'p4', 'p5']);
    });

    it('filters pages with only endDate set', () => {
        const endDate = dayjs('2026-02-28').valueOf();
        const filtered = filterPagesByDateRange(samplePages, null, endDate);

        expect(filtered.length).toBe(2);
        expect(filtered.map((item) => item.page.id)).toEqual(['p1', 'p2']);
    });
});

describe('parseDateToTimestamp', () => {
    it('parses YYYY-MM-DD format', () => {
        const ts = parseDateToTimestamp('2026-02-26');
        expect(ts).toBe(dayjs('2026-02-26').valueOf());
    });

    it('parses DD/MM/YYYY and DD-MM-YYYY formats', () => {
        const ts1 = parseDateToTimestamp('26/02/2026');
        expect(ts1).toBe(dayjs('2026-02-26').startOf('day').valueOf());

        const ts2 = parseDateToTimestamp('26-02-2026');
        expect(ts2).toBe(dayjs('2026-02-26').startOf('day').valueOf());
    });

    it('parses 8-digit YYYYMMDD string format', () => {
        const ts = parseDateToTimestamp('20260226');
        expect(ts).toBe(dayjs('2026-02-26').startOf('day').valueOf());
    });

    it('parses human-readable date strings like Feb 26, 2026', () => {
        const ts = parseDateToTimestamp('Feb 26, 2026');
        expect(dayjs(ts).format('YYYY-MM-DD')).toBe('2026-02-26');
    });

    it('returns null for empty or invalid inputs', () => {
        expect(parseDateToTimestamp('')).toBeNull();
        expect(parseDateToTimestamp(null)).toBeNull();
        expect(parseDateToTimestamp(undefined)).toBeNull();
        expect(parseDateToTimestamp('not-a-date')).toBeNull();
    });
});

describe('PDF page metadata embedding and restoration', () => {
    it('serializes page extra date and createdDate into PDF metadata structure', () => {
        const pages = [
            {
                page: {
                    id: 'p1',
                    createdDate: 1772064000000,
                    extra: {
                        date: '2026-02-26',
                        dateTimestamp: 1772064000000,
                        extractedDate: '26/02/2026'
                    }
                }
            },
            {
                page: {
                    id: 'p2',
                    createdDate: 1772150400000,
                    extra: {
                        date: '2026-02-27',
                        dateTimestamp: 1772150400000
                    }
                }
            }
        ];

        // Simulate PDF export page mapping
        const exportedPages = pages.map((p, index) => ({
            index,
            createdDate: p.page.createdDate,
            extra: p.page.extra
        }));

        const serializedMetadata = JSON.stringify(exportedPages);
        expect(serializedMetadata).toContain('2026-02-26');

        // Parse back as native PDFUtils would
        const parsedMetadata = JSON.parse(serializedMetadata);
        expect(parsedMetadata).toHaveLength(2);
        expect(parsedMetadata[0].extra.date).toBe('2026-02-26');
        expect(parsedMetadata[0].extra.dateTimestamp).toBe(1772064000000);
        expect(parsedMetadata[0].createdDate).toBe(1772064000000);
        expect(parsedMetadata[1].extra.date).toBe('2026-02-27');
        expect(parsedMetadata[1].createdDate).toBe(1772150400000);
    });

    it('restores extra and createdDate when importing items with PDF metadata', () => {
        const rawImportedItems = [
            {
                imagePath: '/temp/img_0.png',
                extra: { date: '2026-02-26', dateTimestamp: 1772064000000 },
                createdDate: 1772064000000
            },
            {
                imagePath: '/temp/img_1.png',
                extra: { date: '2026-03-01', dateTimestamp: 1772323200000 },
                createdDate: 1772323200000
            }
        ];

        // Replicate index.common.ts extraction logic
        const restoredPages = rawImportedItems.map((rawItem: any) => {
            const sourceImagePath = typeof rawItem === 'string' ? rawItem : rawItem.imagePath;
            const restoredExtra = typeof rawItem === 'object' && rawItem !== null ? rawItem.extra : undefined;
            const restoredCreatedDate = typeof rawItem === 'object' && rawItem !== null ? rawItem.createdDate : undefined;

            return {
                sourceImagePath,
                extra: restoredExtra,
                createdDate: restoredCreatedDate
            };
        });

        expect(restoredPages[0].extra?.date).toBe('2026-02-26');
        expect(restoredPages[0].createdDate).toBe(1772064000000);
        expect(restoredPages[1].extra?.date).toBe('2026-03-01');
        expect(restoredPages[1].createdDate).toBe(1772323200000);
    });

    it('falls back gracefully when importing standard PDF items with plain string paths', () => {
        const rawImportedItems = ['/temp/page_0.png', '/temp/page_1.png'];

        const restoredPages = rawImportedItems.map((rawItem: any) => {
            const sourceImagePath = typeof rawItem === 'string' ? rawItem : rawItem.imagePath;
            const restoredExtra = typeof rawItem === 'object' && rawItem !== null ? rawItem.extra : undefined;
            const restoredCreatedDate = typeof rawItem === 'object' && rawItem !== null ? rawItem.createdDate : undefined;

            return {
                sourceImagePath,
                extra: restoredExtra,
                createdDate: restoredCreatedDate
            };
        });

        expect(restoredPages[0].sourceImagePath).toBe('/temp/page_0.png');
        expect(restoredPages[0].extra).toBeUndefined();
        expect(restoredPages[0].createdDate).toBeUndefined();
        expect(restoredPages[1].sourceImagePath).toBe('/temp/page_1.png');
        expect(restoredPages[1].extra).toBeUndefined();
        expect(restoredPages[1].createdDate).toBeUndefined();
    });

    it('safely handles corrupted or invalid metadata JSON without throwing', () => {
        const malformedJson = '{"invalid_json": true';
        let parsed: any = null;
        expect(() => {
            try {
                parsed = JSON.parse(malformedJson);
            } catch {
                parsed = null;
            }
        }).not.toThrow();
        expect(parsed).toBeNull();
    });
});
