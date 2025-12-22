/**
 * @file src/core/utils.js (REFACTORED v4.0)
 * @description Core utilities - address parsing, phone/email validation, logging
 * Uses shared helper functions from new services
 */

/**
 * Parse address into components (CANONICAL - used everywhere)
 * @param {string} fullAddress - Full address string
 * @returns {Object} {street, postalCode, city, country}
 */
function parseAddressComponents(fullAddress) {
    if (!fullAddress) {
        return { street: '', postalCode: '', city: '', country: 'France' };
    }

    const parts = fullAddress
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);

    if (parts.length === 0) {
        return { street: '', postalCode: '', city: '', country: 'France' };
    }

    if (parts.length === 1) {
        return { street: parts[0], postalCode: '', city: '', country: 'France' };
    }

    const street = parts[0];
    const secondPart = parts[1];
    const postalCodeMatch = secondPart.match(/\b(\d{5})\b/);
    const postalCode = postalCodeMatch ? postalCodeMatch[1] : '';
    const city = postalCode ? secondPart.replace(postalCode, '').trim() : secondPart;
    const country = parts.length >= 3 ? parts[parts.length - 1] : 'France';

    return { street, postalCode, city, country };
}

/**
 * Format address components into clean string (NO trailing comma)
 * @param {string} street - Street address
 * @param {string} postalCode - Postal code
 * @param {string} city - City name
 * @returns {string} Formatted address
 */
function formatAddressFromComponents(street, postalCode, city) {
    const parts = [];

    if (street && street.trim()) {
        parts.push(street.trim());
    }

    const cityPart = [];
    if (postalCode && postalCode.trim()) {
        cityPart.push(postalCode.trim());
    }
    if (city && city.trim()) {
        cityPart.push(city.trim());
    }

    if (cityPart.length > 0) {
        parts.push(cityPart.join(' '));
    }

    return parts.join(', ');
}

/**
 * Format address for geocoding (adds France)
 * @param {string} address - Street address
 * @param {string} postalCode - Postal code
 * @param {string} city - City name
 * @returns {string} Full address with France
 */
function formatAddressForGeocoding(address, postalCode, city) {
    const formatted = formatAddressFromComponents(address, postalCode, city);
    return formatted ? `${formatted}, France` : 'France';
}

/**
 * Normalize French phone number to +33 X XX XX XX XX format
 * @param {string} phone - Phone number to normalize
 * @returns {string} Normalized phone number
 */
function normalizePhone(phone) {
    if (!phone) return '';

    let cleaned = String(phone).trim().replace(/\D/g, '');

    if (!cleaned) return '';

    let localNumber = '';

    if (cleaned.startsWith('0033')) {
        localNumber = cleaned.substring(4);
    } else if (cleaned.startsWith('33') && cleaned.length >= 11) {
        localNumber = cleaned.substring(2);
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
        localNumber = cleaned.substring(1);
    } else if (cleaned.length === 9 && !cleaned.startsWith('0')) {
        localNumber = cleaned;
    } else if (cleaned.length === 10 && cleaned.startsWith('0')) {
        localNumber = cleaned.substring(1);
    } else {
        logWarning(`Non-standard phone format: ${phone} -> ${cleaned}`);

        if (cleaned.length >= 9) {
            localNumber = cleaned.slice(-9);
        } else {
            return cleaned;
        }
    }

    if (localNumber.length !== 9) {
        logWarning(`Invalid phone (must be 9 digits): ${phone}`);

        if (localNumber.length > 9) {
            localNumber = localNumber.slice(-9);
        } else {
            return cleaned;
        }
    }

    const firstDigit = localNumber[0];
    if (!/[1-9]/.test(firstDigit)) {
        logWarning(`Invalid phone - first digit must be 1-9: ${phone}`);
        return cleaned;
    }

    return `+33 ${localNumber[0]} ${localNumber.substring(1, 3)} ${localNumber.substring(3, 5)} ${localNumber.substring(5, 7)} ${localNumber.substring(7, 9)}`;
}

/**
 * Validate French phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} Is valid
 */
function isValidPhone(phone) {
    if (!phone) return false;

    const digitsOnly = String(phone).replace(/\D/g, '');

    if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
        return /^0[1-9]\d{8}$/.test(digitsOnly);
    } else if (digitsOnly.startsWith('33') && digitsOnly.length === 11) {
        return /^33[1-9]\d{8}$/.test(digitsOnly);
    } else if (digitsOnly.startsWith('0033') && digitsOnly.length === 13) {
        return /^0033[1-9]\d{8}$/.test(digitsOnly);
    } else if (digitsOnly.length === 9 && /^[1-9]/.test(digitsOnly[0])) {
        return true;
    }

    return false;
}

/**
 * Normalize field name (trim + apostrophes)
 * @param {string} fieldName - Field name to normalize
 * @returns {string} Normalized field name
 */
function normalizeFieldName(fieldName) {
    if (!fieldName) return '';

    return fieldName
        .trim()
        .replace(/[\u2018\u2019]/g, "'");
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid
 */
function isValidEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Parse form response to standardized object
 * @param {Array} headers - Header row
 * @param {Array} values - Values row
 * @returns {Object} Parsed form data
 */
function parseFormResponse(headers, values) {
    const parsed = {};

    headers.forEach((header, i) => {
        const normalizedHeader = normalizeFieldName(header.trim());
        const fieldName = COLUMN_MAP[normalizedHeader];

        if (fieldName) {
            logInfo(`Field: "${fieldName}" = "${values[i]}"`);
            parsed[fieldName] = values[i] ?? '';
        }
    });

    return parsed;
}

/**
 * Log with timestamp and emoji (uses formatDateTime)
 * @param {string} message - Log message
 * @param {*} [data=null] - Optional data to log
 */
function logInfo(message, data = null) {
    console.log(`[${formatDateTime()}] ℹ️ INFO: ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

/**
 * Log warning with timestamp
 * @param {string} message - Warning message
 * @param {*} [data=null] - Optional data to log
 */
function logWarning(message, data = null) {
    console.warn(`[${formatDateTime()}] ⚠️ WARN: ${message}`);
    if (data) {
        console.warn(JSON.stringify(data, null, 2));
    }
}

/**
 * Log error with timestamp
 * @param {string} message - Error message
 * @param {*} [error=null] - Optional error object
 */
function logError(message, error = null) {
    console.error(`[${formatDateTime()}] ❌ ERROR: ${message}`);
    if (error) {
        console.error(error);
    }
}

/**
 * Get sheet by name
 * @param {string} sheetName - Sheet name
 * @returns {Sheet|null} Sheet object or null
 */
function getSheetByName(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName(sheetName);
}

/**
 * Check if Drive file exists
 * @param {string} fileId - File ID
 * @returns {boolean} File exists
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
 * @param {Folder} parentFolder - Parent folder
 * @param {string} folderName - Folder name
 * @returns {Folder} Folder object
 */
function getOrCreateFolder(parentFolder, folderName) {
    const folders = parentFolder.getFoldersByName(folderName);

    if (folders.hasNext()) {
        return folders.next();
    }

    return parentFolder.createFolder(folderName);
}

/**
 * Extract file IDs from Drive URLs
 * @param {string} urlString - Comma-separated URLs
 * @returns {Array<string>} Array of file IDs
 */
function extractFileIds(urlString) {
    if (!urlString) return [];

    const urls = urlString.split(',').map(u => u.trim());
    const fileIds = [];

    urls.forEach(url => {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
            url.match(/id=([a-zA-Z0-9_-]+)/);

        if (match && match[1]) {
            fileIds.push(match[1]);
        }
    });

    return fileIds;
}

/**
 * Find duplicate family (phone + name or email)
 * @param {string} phone - Phone number
 * @param {string} lastName - Last name
 * @param {string} [email=null] - Optional email
 * @returns {Object} {exists: boolean, row?: number, id?: string, data?: Array}
 */
function findDuplicateFamily(phone, lastName, email = null) {
    try {
        const normalizedPhone = normalizePhone(phone).replace(/[\s\(\)]/g, '');
        const normalizedLastName = lastName.toLowerCase().trim();

        const cacheKey = `dup_${normalizedPhone}_${normalizedLastName}`;
        const cached = getCached(cacheKey);

        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                logWarning('Error parsing cache, ignored', e);
            }
        }

        const data = getFamilySheetData();

        if (!data) {
            logWarning('Famille sheet not found for duplicate check');
            return { exists: false };
        }

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (!row || row.length === 0) continue;

            const rowPhone = normalizePhone(String(row[OUTPUT_COLUMNS.TELEPHONE] || ''))
                .replace(/[\s\(\)]/g, '');
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

                setCached(cacheKey, JSON.stringify(result), CONFIG.CACHE.MEDIUM);
                return result;
            }
        }

        const result = { exists: false };
        setCached(cacheKey, JSON.stringify(result), CONFIG.CACHE.SHORT);

        return result;

    } catch (error) {
        logError('Error in findDuplicateFamily', error);
        return { exists: false };
    }
}

/**
 * Retry operation wrapper
 * @param {Function} operation - Operation to retry
 * @param {number} [maxRetries=3] - Max retry attempts
 * @returns {*} Operation result
 */
function retryOperation(operation, maxRetries = 3) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return operation();
        } catch (e) {
            lastError = e;
            logError(`Attempt ${i + 1}/${maxRetries} failed`, e);

            if (i < maxRetries - 1) {
                Utilities.sleep(1000 * (i + 1));
            }
        }
    }

    throw lastError;
}

/**
 * Notify admin by email
 * @param {string} subject - Email subject
 * @param {string} message - Email message
 */
function notifyAdmin(subject, message) {
    try {
        const config = getScriptConfig();
        const adminEmail = config.adminEmail;

        if (!adminEmail) {
            logWarning('Admin email not configured');
            return;
        }

        const emailBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a73e8; color: white; padding: 15px; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🔔 ${subject}</h2>
        </div>
        <div class="content">
            <p>${message.replace(/\n/g, '<br>')}</p>
            <hr>
            <p><strong>Timestamp:</strong> ${formatDateTime()}</p>
        </div>
        <div class="footer">
            <p>📦 Système de Gestion des Familles - Notification automatique</p>
        </div>
    </div>
</body>
</html>`;

        MailApp.sendEmail({
            to: adminEmail,
            subject: `[Gestion Familles] ${subject}`,
            htmlBody: emailBody
        });

        logInfo(`Email sent to admin: ${subject}`);

    } catch (error) {
        logError('Failed to send admin email', error);
    }
}

/**
 * Build URL with query parameters
 * @param {string} baseUrl - Base URL
 * @param {string} action - Action parameter
 * @param {Object} params - Additional parameters
 * @returns {string} Complete URL
 */
function buildUrlWithParams(baseUrl, action, params) {
    const queryParams = ['action=' + encodeURIComponent(action)];

    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            queryParams.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
    });

    return baseUrl + '?' + queryParams.join('&');
}

/**
 * Get last empty row in sheet
 * @param {Sheet} sheet - Sheet object
 * @returns {number} Last empty row number
 */
function getLastEmptyRow(sheet) {
    const data = sheet.getDataRange().getValues();

    for (let i = data.length - 1; i >= 0; i--) {
        const rowIsEmpty = data[i].every(cell => cell === '' || cell === null);

        if (!rowIsEmpty) {
            return i + 2;
        }
    }

    return 1;
}

/**
 * Check if consent is refused
 * @param {Object} formData - Form data
 * @returns {boolean} Consent is refused
 */
function isConsentRefused(formData) {
    const consent = formData.personalDataProtection || '';

    const isRefused = CONFIG.REFUSAL_PHRASES.some(phrase =>
        consent.toLowerCase().includes(phrase.toLowerCase())
    );

    if (isRefused) {
        logInfo('Submission ignored: consent refused');
    }

    return isRefused;
}