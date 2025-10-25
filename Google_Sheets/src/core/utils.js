/**
 * @file src/core/utils.js
 * @description Reusable utility functions
 */

/**
 * Normalize field name by trimming whitespace
 */
function normalizeFieldName(fieldName) {
    return fieldName ? fieldName.trim() : '';
}

/**
 * Normalize phone number - remove spaces, dots, dashes
 */
function normalizePhone(phone) {
    if (!phone) return '';
    return phone.toString().replace(/[\s\.\-\(\)]/g, '');
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Validate phone number (French format)
 */
function isValidPhone(phone) {
    if (!phone) return false;
    const normalized = normalizePhone(phone);
    return /^(0[1-9]\d{8}|(\+|00)33[1-9]\d{8})$/.test(normalized);
}

/**
 * Parse form response into standardized object
 */
function parseFormResponse(headers, values) {
    const parsed = {};

    headers.forEach((header, i) => {
        const normalizedHeader = normalizeFieldName(header);
        const fieldName = COLUMN_MAP[normalizedHeader];

        if (fieldName) {
            parsed[fieldName] = values[i] || '';
        }
    });

    return parsed;
}

/**
 * Generate unique family ID
 */
function generateFamilyId() {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000);
    return `FAM_${timestamp}_${random}`;
}

/**
 * Format address for geocoding
 */
function formatAddressForGeocoding(address, postalCode, city) {
    const parts = [address, postalCode, city, 'France'].filter(p => p);
    return parts.join(', ');
}

/**
 * Log with timestamp
 */
function logInfo(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] INFO: ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

/**
 * Log error
 */
function logError(message, error = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR: ${message}`);
    if (error) {
        console.error(error);
    }
}

/**
 * Get sheet with caching
 */
function getSheetByName(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName(sheetName);
}

/**
 * Check if file exists in Drive
 */
function fileExists(fileId) {
    try {
        DriveApp.getFileById(fileId);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Get or create folder
 */
function getOrCreateFolder(parentFolder, folderName) {
    const folders = parentFolder.getFoldersByName(folderName);
    if (folders.hasNext()) {
        return folders.next();
    }
    return parentFolder.createFolder(folderName);
}

/**
 * Validate required fields
 */
function validateRequiredFields(data) {
    const errors = [];

    if (!data.lastName) errors.push('Nom de famille requis');
    if (!data.firstName) errors.push('Prénom requis');
    if (!data.phone) errors.push('Téléphone requis');
    if (!isValidPhone(data.phone)) errors.push('Numéro de téléphone invalide');
    if (data.email && !isValidEmail(data.email)) errors.push('Email invalide');
    if (!data.address) errors.push('Adresse requise');
    if (!data.postalCode) errors.push('Code postal requis');
    if (!data.city) errors.push('Ville requise');
    if (!data.nombreAdulte || isNaN(data.nombreAdulte)) errors.push('Nombre d\'adultes requis');
    if (!data.nombreEnfant || isNaN(data.nombreEnfant)) errors.push('Nombre d\'enfants requis');

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Extract file IDs from Drive URLs
 */
function extractFileIds(urlString) {
    if (!urlString) return [];

    const urls = urlString.split(',').map(u => u.trim());
    const fileIds = [];

    urls.forEach(url => {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            fileIds.push(match[1]);
        }
    });

    return fileIds;
}

/**
 * Check for duplicate family (phone + lastName)
 */
function findDuplicateFamily(phone, lastName, email = null) {
    const cache = CacheService.getScriptCache();
    const normalizedPhone = normalizePhone(phone);
    const normalizedLastName = lastName.toLowerCase().trim();

    const cacheKey = `dup_${normalizedPhone}_${normalizedLastName}`;
    const cached = cache.get(cacheKey);

    if (cached) {
        return JSON.parse(cached);
    }

    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
    if (!sheet) return null;

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowPhone = normalizePhone(row[OUTPUT_COLUMNS.TELEPHONE]);
        const rowLastName = (row[OUTPUT_COLUMNS.NOM] || '').toLowerCase().trim();
        const rowEmail = (row[OUTPUT_COLUMNS.EMAIL] || '').toLowerCase().trim();

        if ((rowPhone === normalizedPhone && rowLastName === normalizedLastName) ||
            (email && rowEmail && rowEmail === email.toLowerCase().trim())) {
            const result = {
                exists: true,
                row: i + 1,
                id: row[OUTPUT_COLUMNS.ID],
                data: row
            };

            cache.put(cacheKey, JSON.stringify(result), CONFIG.CACHE.MEDIUM);
            return result;
        }
    }

    const result = { exists: false };
    cache.put(cacheKey, JSON.stringify(result), CONFIG.CACHE.SHORT);
    return result;
}

/**
 * Retry wrapper for API calls
 */
function retryOperation(operation, maxRetries = 3) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return operation();
        } catch (e) {
            lastError = e;
            logError(`Retry ${i + 1}/${maxRetries} failed`, e);

            if (i < maxRetries - 1) {
                Utilities.sleep(1000 * (i + 1));
            }
        }
    }

    throw lastError;
}