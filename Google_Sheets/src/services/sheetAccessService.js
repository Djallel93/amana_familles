/**
 * @file src/services/sheetAccessService.js (UPDATED v3.0)
 * @description Helpers lecture/écriture feuille
 * CHANGE: appendSheetComment now includes comment history management (merged from addComment)
 */

/**
 * Récupère les données de la feuille Famille validée
 * @returns {Array[]|null} Tableau de données ou null en cas d'erreur
 */
function getFamilySheetData() {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);

    if (!sheet) {
        logError('Feuille Famille introuvable');
        return null;
    }

    return sheet.getDataRange().getValues();
}

/**
 * Trouve une ligne famille par ID
 * @param {string|number} familyId - ID famille à chercher
 * @returns {Object|null} {row: number, data: Array} ou null si introuvable
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
                row: i + 1,
                data: data[i]
            };
        }
    }

    return null;
}

/**
 * Met à jour une seule cellule dans la feuille Famille avec gestion d'erreur
 * @param {number} row - Numéro de ligne (1-based)
 * @param {number} columnIndex - Index de colonne (0-based)
 * @param {*} value - Valeur à définir
 * @returns {boolean} Statut succès
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
 * Ajoute un commentaire au champ commentaire d'une famille (MERGED with addComment logic)
 * @param {Sheet} sheet - Objet feuille
 * @param {number} row - Numéro de ligne (1-based)
 * @param {string} emoji - Emoji pour le commentaire
 * @param {string} message - Message du commentaire
 * @returns {boolean} Statut succès
 */
function appendSheetComment(sheet, row, emoji, message) {
    try {
        const existingComment = sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).getValue() || '';
        const newComment = formatComment(emoji, message);
        const comments = existingComment ?
            existingComment.split('\n').filter(c => c.trim()) :
            [];

        comments.unshift(newComment);
        const recentComments = comments.slice(0, 5);

        const updatedComment = recentComments.join('\n');

        sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(updatedComment);
        return true;
    } catch (error) {
        logError(`Échec ajout commentaire ligne ${row}`, error);
        return false;
    }
}

/**
 * Récupère toutes les familles validées avec filtre optionnel
 * @param {Function} [filterFn] - Fonction de filtrage optionnelle (row) => boolean
 * @param {Array[]} [cachedData=null] - Données déjà récupérées (optimisation)
 * @returns {Array[]} Tableau de données de lignes
 */
function getValidatedFamilyRows(filterFn = null, cachedData = null) {
    const data = cachedData || getFamilySheetData();

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
 * Getter sécurisé de valeur de colonne avec null safety
 * @param {Array} row - Tableau de données de ligne
 * @param {number} columnIndex - Index de colonne (0-based)
 * @param {*} [defaultValue=''] - Valeur par défaut si null/undefined
 * @returns {*} Valeur de colonne ou valeur par défaut
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