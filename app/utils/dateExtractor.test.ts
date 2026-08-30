import { describe, expect, it, vi } from 'vitest';
import {
    convertDevanagariNumerals,
    extractDateFromText,
    extractDatesFromPagesInBatch
} from './dateExtractor';

describe('convertDevanagariNumerals', () => {
    it('correctly maps all Devanagari numerals to Arabic digits', () => {
        expect(convertDevanagariNumerals('०१२३४५६७८९')).toBe('0123456789');
    });

    it('preserves surrounding text and punctuation', () => {
        expect(convertDevanagariNumerals('दिनांक: १५/०८/२०२४ बिल राशि: ₹५००')).toBe('दिनांक: 15/08/2024 बिल राशि: ₹500');
    });

    it('handles empty or null strings safely', () => {
        expect(convertDevanagariNumerals('')).toBe('');
    });
});

describe('extractDateFromText', () => {
    it('extracts date with Devanagari digits and slashes', () => {
        const text = 'श्री गणेशाय नमः \n बिल दिनांक: १५/०८/२०२४ \n कुल योग: ५०००';
        const result = extractDateFromText(text);

        expect(result).not.toBeNull();
        expect(result?.isoDate).toBe('2024-08-15');
        expect(result?.day).toBe(15);
        expect(result?.month).toBe(8);
        expect(result?.year).toBe(2024);
        expect(result?.formattedDate).toBe('15/08/2024');
    });

    it('extracts date with Hindi month name (अगस्त)', () => {
        const text = 'खोवा सप्लायर रसीद \n तारीख: १५ अगस्त २०२४ \n वजन: २० किलो';
        const result = extractDateFromText(text);

        expect(result).not.toBeNull();
        expect(result?.isoDate).toBe('2024-08-15');
        expect(result?.month).toBe(8);
        expect(result?.day).toBe(15);
        expect(result?.year).toBe(2024);
    });

    it('extracts date with Devanagari hyphenated format (दिनांक १२-०५-२४)', () => {
        const text = 'दूध बिल \n दिनांक: १२-०५-२४ \n दर: ६० रुपये';
        const result = extractDateFromText(text);

        expect(result).not.toBeNull();
        expect(result?.isoDate).toBe('2024-05-12');
        expect(result?.year).toBe(2024);
    });

    it('extracts date with Hindi month (जनवरी, मार्च, दिसंबर)', () => {
        const t1 = extractDateFromText('26 जनवरी 2024 गणतंत्र दिवस');
        expect(t1?.isoDate).toBe('2024-01-26');

        const t2 = extractDateFromText('10 मार्च 2023 नमकीन मसाला');
        expect(t2?.isoDate).toBe('2023-03-10');

        const t3 = extractDateFromText('31 दिसंबर 2022 खाता बंद');
        expect(t3?.isoDate).toBe('2022-12-31');
    });

    it('extracts standard English/Hinglish numeric dates (DD/MM/YYYY)', () => {
        const result = extractDateFromText('Invoice No: 103768 Date: 15/09/2024 Amount: 12000');
        expect(result).not.toBeNull();
        expect(result?.isoDate).toBe('2024-09-15');
    });

    it('extracts ISO dates (YYYY-MM-DD)', () => {
        const result = extractDateFromText('Logged on 2024-06-18 by clerk');
        expect(result).not.toBeNull();
        expect(result?.isoDate).toBe('2024-06-18');
    });

    it('returns null for text without valid dates', () => {
        expect(extractDateFromText('यह सिर्फ एक सामान्य पाठ है बिना किसी तारीख के')).toBeNull();
        expect(extractDateFromText('99/99/9999 invalid numbers')).toBeNull();
        expect(extractDateFromText('')).toBeNull();
    });
});

describe('extractDatesFromPagesInBatch', () => {
    it('processes batch of pages and reports progress asynchronously without blocking', async () => {
        const pages = [
            { text: 'पेज १ दिनांक: ०१/०१/२०२४' },
            { text: 'पेज २ तारीख: १५ फरवरी २०२४' },
            { text: 'पेज ३ बिना तारीख का विवरण' },
            { text: 'Page 4 Dt: 20/04/2024' }
        ];

        const progressSpy = vi.fn();
        const results = await extractDatesFromPagesInBatch(pages, progressSpy);

        expect(results.length).toBe(4);
        expect(results[0]?.isoDate).toBe('2024-01-01');
        expect(results[1]?.isoDate).toBe('2024-02-15');
        expect(results[2]).toBeNull();
        expect(results[3]?.isoDate).toBe('2024-04-20');

        expect(progressSpy).toHaveBeenCalledTimes(4);
        expect(progressSpy).toHaveBeenLastCalledWith(4, 4, results[3]);
    });
});
