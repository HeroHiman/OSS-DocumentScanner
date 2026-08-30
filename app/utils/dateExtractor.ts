export interface ExtractedDateResult {
    isoDate: string; // YYYY-MM-DD
    timestamp: number; // Unix epoch ms
    formattedDate: string; // DD/MM/YYYY
    rawMatch: string;
    day: number;
    month: number;
    year: number;
    confidence: number; // 0 to 1
}

export const DEVANAGARI_DIGITS_MAP: Record<string, string> = {
    '०': '0',
    '१': '1',
    '२': '2',
    '३': '3',
    '४': '4',
    '५': '5',
    '६': '6',
    '७': '7',
    '८': '8',
    '९': '9'
};

export const HINDI_MONTHS_MAP: Record<string, number> = {
    // Standard Hindi / Hinglish month names
    जनवरी: 1,
    जन: 1,
    jan: 1,
    january: 1,
    फरवरी: 2,
    फ़रवरी: 2,
    फर: 2,
    feb: 2,
    february: 2,
    मार्च: 3,
    mar: 3,
    march: 3,
    अप्रैल: 4,
    अप्रेल: 4,
    apr: 4,
    april: 4,
    मई: 5,
    may: 5,
    जून: 6,
    jun: 6,
    june: 6,
    जुलाई: 7,
    jul: 7,
    july: 7,
    अगस्त: 8,
    अग: 8,
    aug: 8,
    august: 8,
    सितम्बर: 9,
    सितंबर: 9,
    सित: 9,
    sep: 9,
    september: 9,
    अक्टूबर: 10,
    अक्तूबर: 10,
    अक्टू: 10,
    अक्टु: 10,
    oct: 10,
    october: 10,
    नवम्बर: 11,
    नवंबर: 11,
    नव: 11,
    nov: 11,
    november: 11,
    दिसम्बर: 12,
    दिसंबर: 12,
    दिस: 12,
    dec: 12,
    december: 12,

    // Traditional Devanagari lunar calendar months
    चैत्र: 3,
    वैशाख: 4,
    ज्येष्ठ: 5,
    आषाढ़: 6,
    श्रावण: 7,
    सावन: 7,
    भाद्रपद: 8,
    भादों: 8,
    आश्विन: 9,
    कार्तिक: 10,
    मार्गशीर्ष: 11,
    अग्रहायण: 11,
    पौष: 12,
    पूस: 12,
    माघ: 1,
    फाल्गुन: 2
};

/**
 * Transliterates all Devanagari numerals (०-९) into standard Arabic digits (0-9).
 */
export function convertDevanagariNumerals(text: string): string {
    if (!text) return '';
    return text.replace(/[०-९]/g, (char) => DEVANAGARI_DIGITS_MAP[char] || char);
}

/**
 * Parses month string (Devanagari, English, or numeric) to a 1-12 integer.
 */
function parseMonth(monthStr: string): number | null {
    if (!monthStr) return null;
    const cleanStr = monthStr.trim().toLowerCase();

    // Check if numeric
    const num = parseInt(cleanStr, 10);
    if (!isNaN(num) && num >= 1 && num <= 12) {
        return num;
    }

    // Check Devanagari / text month map
    if (HINDI_MONTHS_MAP[cleanStr]) {
        return HINDI_MONTHS_MAP[cleanStr];
    }

    // Check prefix substring match (e.g. सित -> 9)
    for (const [key, val] of Object.entries(HINDI_MONTHS_MAP)) {
        if (cleanStr.startsWith(key) || key.startsWith(cleanStr)) {
            return val;
        }
    }

    return null;
}

/**
 * Normalizes year (e.g. 24 -> 2024).
 */
function normalizeYear(yearNum: number): number {
    if (yearNum < 100) {
        return yearNum <= 50 ? 2000 + yearNum : 1900 + yearNum;
    }
    return yearNum;
}

/**
 * Validates day, month, year values against calendar constraints.
 */
function isValidDate(day: number, month: number, year: number): boolean {
    if (year < 1970 || year > 2099) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    const daysInMonth = new Date(year, month, 0).getDate();
    return day <= daysInMonth;
}

/**
 * Formats day, month, year into canonical ISO and timestamp structures.
 */
function buildDateResult(day: number, month: number, year: number, rawMatch: string, confidence = 0.9): ExtractedDateResult {
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    const isoDate = `${year}-${pad(month)}-${pad(day)}`;
    const formattedDate = `${pad(day)}/${pad(month)}/${year}`;
    const timestamp = new Date(year, month - 1, day, 12, 0, 0).getTime();

    return {
        isoDate,
        timestamp,
        formattedDate,
        rawMatch,
        day,
        month,
        year,
        confidence
    };
}

/**
 * Extracts dates from text with comprehensive support for Devanagari script, Hindi months, and Hinglish formats.
 */
export function extractDateFromText(text: string): ExtractedDateResult | null {
    if (!text || typeof text !== 'string') {
        return null;
    }

    // 1. First transliterate Devanagari digits to standard digits
    const normalizedText = convertDevanagariNumerals(text);

    // 2. Look for date expressions with explicit prefixes (दिनांक, तारीख, मिति, Date, Dt)
    const prefixedRegex = /(?:दिनांक|तारीख|तारीख़|मिति|date|dt)[ :.-]*([0-9]{1,2})[\/\-.| ]+([0-9]{1,2}|[^\s\d\/\-.|,]+)[\/\-.| ]+([0-9]{2,4})/gi;
    let match = prefixedRegex.exec(normalizedText);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseMonth(match[2]);
        const year = normalizeYear(parseInt(match[3], 10));
        if (month !== null && isValidDate(day, month, year)) {
            return buildDateResult(day, month, year, match[0], 0.98);
        }
    }

    // 3. Look for textual month patterns (e.g. 15 अगस्त 2024, 12 March 2024, 25-नवंबर-24)
    const textMonthRegex = /\b([0-9]{1,2})[\s\-.\/]+([^\s\d\/\-.|,]+)[\s\-.\/]+([0-9]{2,4})\b/g;
    while ((match = textMonthRegex.exec(normalizedText)) !== null) {
        const day = parseInt(match[1], 10);
        const month = parseMonth(match[2]);
        const year = normalizeYear(parseInt(match[3], 10));
        if (month !== null && isValidDate(day, month, year)) {
            return buildDateResult(day, month, year, match[0], 0.95);
        }
    }

    // 4. Standard numeric date patterns (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YY)
    const standardNumericRegex = /\b([0-3]?[0-9])[\/\-.|]([0-1]?[0-9])[\/\-.|]((?:20|19)?[0-9]{2})\b/g;
    while ((match = standardNumericRegex.exec(normalizedText)) !== null) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const year = normalizeYear(parseInt(match[3], 10));
        if (isValidDate(day, month, year)) {
            return buildDateResult(day, month, year, match[0], 0.88);
        }
    }

    // 5. ISO / Year-first patterns (YYYY/MM/DD, YYYY-MM-DD)
    const yearFirstRegex = /\b((?:20|19)[0-9]{2})[\/\-.|]([0-1]?[0-9])[\/\-.|]([0-3]?[0-9])\b/g;
    while ((match = yearFirstRegex.exec(normalizedText)) !== null) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        if (isValidDate(day, month, year)) {
            return buildDateResult(day, month, year, match[0], 0.85);
        }
    }

    return null;
}

/**
 * Asynchronously processes an array of items (e.g. OCR pages) in batch,
 * cooperatively yielding CPU execution every 10ms to prevent locking the UI thread.
 */
export async function extractDatesFromPagesInBatch<T extends { ocrData?: { text?: string }; text?: string }>(
    pages: T[],
    onProgress?: (current: number, total: number, result: ExtractedDateResult | null) => void
): Promise<(ExtractedDateResult | null)[]> {
    const results: (ExtractedDateResult | null)[] = [];
    const total = pages.length;

    for (let i = 0; i < total; i++) {
        const text = pages[i]?.ocrData?.text || pages[i]?.text || '';
        const dateResult = extractDateFromText(text);
        results.push(dateResult);

        if (onProgress) {
            onProgress(i + 1, total, dateResult);
        }

        // Cooperative yield to keep UI responsive
        await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return results;
}
