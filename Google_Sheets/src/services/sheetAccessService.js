/**
 * @file src/services/sheetAccessService.js
 */

/**
 * Crée la feuille Audit si elle n'existe pas et initialise les en-têtes.
 * @returns {Sheet}
 */
function getOrCreateAuditSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEETS.AUDIT);
    if (!sheet) {
        sheet = ss.insertSheet(CONFIG.SHEETS.AUDIT);
        sheet.getRange(1, 1, 1, 4).setValues([['timestamp', 'famille_id', 'source', 'message']]);
        sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
        sheet.setFrozenRows(1);
        logInfo('Feuille Audit créée');
    }
    return sheet;
}

/**
 * Écrit une ligne dans la feuille Audit (insertion en position 2 pour ordre décroissant).
 * @param {string|number} familleId
 * @param {string} source - Valeur de CONFIG.AUDIT_SOURCES
 * @param {string} message
 */
function appendSheetComment(familleId, source, message) {
    try {
        const sheet = getOrCreateAuditSheet();
        const timestamp = formatDateTime();
        sheet.insertRowAfter(1);
        sheet.getRange(2, 1, 1, 4).setValues([[timestamp, familleId, source, message]]);
    } catch (error) {
        logError(`Échec écriture audit (famille ${familleId})`, error);
    }
}

/**
 * Écrit plusieurs lignes d'audit en une seule opération (optimisé pour les syncs multi-champs).
 * @param {string|number} familleId
 * @param {string} source
 * @param {Array<string>} messages
 */
function appendSheetComments(familleId, source, messages) {
    if (!messages || messages.length === 0) return;
    try {
        const sheet = getOrCreateAuditSheet();
        const timestamp = formatDateTime();
        const rows = messages.map(msg => [timestamp, familleId, source, msg]);
        sheet.insertRowsAfter(1, rows.length);
        sheet.getRange(2, 1, rows.length, 4).setValues(rows);
    } catch (error) {
        logError(`Échec écriture audit groupé (famille ${familleId})`, error);
    }
}

/**
 * Migre le contenu de la colonne commentaire_dossier vers la feuille Audit
 * puis supprime la colonne.
 * @returns {Object} {success: boolean, migrated: number, errors: number}
 */
function migrateCommentsToAudit() {
    const familleSheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!familleSheet) return { success: false, migrated: 0, errors: 0 };

    getOrCreateAuditSheet();

    const data = familleSheet.getDataRange().getValues();
    const COMMENT_COL_INDEX = 21;
    const timestampRegex = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(.+)$/;
    const FALLBACK_TIMESTAMP = '2000-01-01 00:00:00';

    let migrated = 0;
    let errors = 0;

    for (let i = 1; i < data.length; i++) {
        const familleId = data[i][OUTPUT_COLUMNS.ID];
        const rawComment = data[i][COMMENT_COL_INDEX];

        if (!rawComment || String(rawComment).trim() === '') continue;

        const lines = String(rawComment).split('\n').map(l => l.trim()).filter(l => l.length > 0);

        try {
            const auditSheet = getOrCreateAuditSheet();
            const rows = lines.map(line => {
                const match = line.match(timestampRegex);
                const timestamp = match ? match[1] : FALLBACK_TIMESTAMP;
                const message = match ? match[2] : line;
                return [timestamp, familleId, CONFIG.AUDIT_SOURCES.MIGRATION, message];
            });

            if (rows.length > 0) {
                auditSheet.insertRowsAfter(1, rows.length);
                auditSheet.getRange(2, 1, rows.length, 4).setValues(rows);
                migrated += rows.length;
            }
        } catch (e) {
            logError(`Erreur migration commentaires famille ${familleId}`, e);
            errors++;
        }
    }

    try {
        familleSheet.deleteColumn(COMMENT_COL_INDEX + 1);
        logInfo(`Colonne commentaire_dossier supprimée`);
    } catch (e) {
        logError('Échec suppression colonne commentaire_dossier', e);
        return { success: false, migrated, errors };
    }

    logInfo(`Migration terminée: ${migrated} entrées migrées, ${errors} erreurs`);
    return { success: true, migrated, errors };
}

function getFamilySheetData() {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) {
        logError('Feuille Famille introuvable');
        return null;
    }
    return sheet.getDataRange().getValues();
}

/**
 * @returns {Object|null} {row: number, data: Array} ou null
 */
function findFamilyRowById(familyId) {
    const data = getFamilySheetData();
    if (!data) return null;
    for (let i = 1; i < data.length; i++) {
        if (data[i][OUTPUT_COLUMNS.ID] === familyId || data[i][OUTPUT_COLUMNS.ID] == familyId) {
            return { row: i + 1, data: data[i] };
        }
    }
    return null;
}

/**
 * @returns {boolean}
 */
function updateFamilyCell(row, columnIndex, value) {
    try {
        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (!sheet) {
            logError('Feuille Famille introuvable');
            return false;
        }
        sheet.getRange(row, columnIndex + 1).setValue(value);
        return true;
    } catch (error) {
        logError(`Échec mise à jour cellule ligne ${row}, col ${columnIndex}`, error);
        return false;
    }
}

/**
 * @param {Function} [filterFn]
 * @param {Array[]} [cachedData=null]
 * @returns {Array[]}
 */
function getValidatedFamilyRows(filterFn = null, cachedData = null) {
    const data = cachedData || getFamilySheetData();
    if (!data) return [];

    const validatedRows = [];
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] !== CONFIG.STATUS.VALIDATED) continue;
        if (filterFn && !filterFn(row)) continue;
        validatedRows.push(row);
    }
    return validatedRows;
}

/**
 * @param {Array} row
 * @param {number} columnIndex
 * @param {*} [defaultValue='']
 * @returns {*}
 */
function safeGetColumn(row, columnIndex, defaultValue = '') {
    if (!row || !Array.isArray(row)) return defaultValue;
    if (columnIndex < 0 || columnIndex >= row.length) return defaultValue;
    const value = row[columnIndex];
    return (value === null || value === undefined) ? defaultValue : value;
}
