/**
 * @file src/services/sheetAccessService.js (NEW)
 * @description Sheet read/write helper functions to eliminate duplication
 */

/**
 * Get validated Famille sheet data
 * @returns {Array[]|null} Data array or null on error
 */
function getFamilySheetData() {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);

    if (!sheet) {
        logError('Famille sheet not found');
        return null;
    }

    return sheet.getDataRange().getValues();
}

/**
 * Find family row by ID
 * @param {string|number} familyId - Family ID to find
 * @returns {Object|null} {row: number, data: Array} or null if not found
 */
function findFamilyRowById(familyId) {
    const data = getFamilySheetData();

    if (!data) {
        return null;
    }

    for (let i = 1; i < data.length; i++) {
        if (data[i][OUTPUT_COLUMNS.ID] === familyId ||
            data[i][OUTPUT_COLUMNS.ID] == familyId) {
            return {
                row: i + 1, // 1-based row number
                data: data[i]
            };
        }
    }

    return null;
}

/**
 * Update a single cell in Famille sheet with error handling
 * @param {number} row - Row number (1-based)
 * @param {number} columnIndex - Column index (0-based)
 * @param {*} value - Value to set
 * @returns {boolean} Success status
 */
function updateFamilyCell(row, columnIndex, value) {
    try {
        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);

        if (!sheet) {
            logError('Famille sheet not found');
            return false;
        }

        sheet.getRange(row, columnIndex + 1).setValue(value);
        return true;
    } catch (error) {
        logError(`Failed to update cell at row ${row}, col ${columnIndex}`, error);
        return false;
    }
}

/**
 * Append comment to a family's comment field
 * @param {Sheet} sheet - Sheet object
 * @param {number} row - Row number (1-based)
 * @param {string} emoji - Emoji for the comment
 * @param {string} message - Comment message
 * @returns {boolean} Success status
 */
function appendSheetComment(sheet, row, emoji, message) {
    try {
        const existingComment = sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).getValue() || '';
        const newComment = addComment(existingComment, formatComment(emoji, message));
        sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);
        return true;
    } catch (error) {
        logError(`Failed to append comment at row ${row}`, error);
        return false;
    }
}

/**
 * Get all validated families with optional filter
 * @param {Function} [filterFn] - Optional filter function (row) => boolean
 * @returns {Array[]} Array of row data
 */
function getValidatedFamilyRows(filterFn = null) {
    const data = getFamilySheetData();

    if (!data) {
        return [];
    }

    const validatedRows = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];

        if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] !== CONFIG.STATUS.VALIDATED) {
            continue;
        }

        if (filterFn && !filterFn(row)) {
            continue;
        }

        validatedRows.push(row);
    }

    return validatedRows;
}

/**
 * Safe column value getter with null safety
 * @param {Array} row - Row data array
 * @param {number} columnIndex - Column index (0-based)
 * @param {*} [defaultValue=''] - Default value if null/undefined
 * @returns {*} Column value or default
 */
function safeGetColumn(row, columnIndex, defaultValue = '') {
    if (!row || !Array.isArray(row)) {
        return defaultValue;
    }

    if (columnIndex < 0 || columnIndex >= row.length) {
        return defaultValue;
    }

    const value = row[columnIndex];
    return (value === null || value === undefined) ? defaultValue : value;
}