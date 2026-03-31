/**
 * @file src/services/bulkImportService.js
 */

function processBulkImportRow(row, sheetRowNumber) {
    const formData = {
        lastName: row[BULK_COLUMNS.NOM],
        firstName: row[BULK_COLUMNS.PRENOM],
        nombreAdulte: parseInt(row[BULK_COLUMNS.NOMBRE_ADULTE]) || 0,
        nombreEnfant: parseInt(row[BULK_COLUMNS.NOMBRE_ENFANT]) || 0,
        address: row[BULK_COLUMNS.ADRESSE],
        postalCode: String(row[BULK_COLUMNS.CODE_POSTAL]),
        city: row[BULK_COLUMNS.VILLE],
        phone: String(row[BULK_COLUMNS.TELEPHONE]),
        phoneBis: row[BULK_COLUMNS.TELEPHONE_BIS] ? String(row[BULK_COLUMNS.TELEPHONE_BIS]) : '',
        email: row[BULK_COLUMNS.EMAIL] || '',
        circonstances: row[BULK_COLUMNS.CIRCONSTANCES] || '',
        ressentit: row[BULK_COLUMNS.RESSENTIT] || '',
        specificites: row[BULK_COLUMNS.SPECIFICITES] || '',
        criticite: parseInt(row[BULK_COLUMNS.CRITICITE]) || 0,
        langue: row[BULK_COLUMNS.LANGUE] || CONFIG.LANGUAGES.FR,
        seDeplace: parseSeDeplace(row[BULK_COLUMNS.SE_DEPLACE])
    };

    if (!formData.lastName || !formData.firstName) return { success: false, error: 'Nom et prénom requis' };
    if (!formData.address || !formData.postalCode || !formData.city) return { success: false, error: 'Adresse complète requise' };
    if (!formData.phone) return { success: false, error: 'Téléphone requis' };

    const criticite = parseInt(formData.criticite);
    if (isNaN(criticite) || criticite < CONFIG.CRITICITE.MIN || criticite > CONFIG.CRITICITE.MAX) {
        return { success: false, error: `Criticité invalide. Doit être entre ${CONFIG.CRITICITE.MIN} et ${CONFIG.CRITICITE.MAX}` };
    }

    if (!isValidPhone(formData.phone)) return { success: false, error: 'Numéro de téléphone invalide' };
    if (formData.email && !isValidEmail(formData.email)) return { success: false, error: 'Email invalide' };

    const householdValidation = validateHouseholdComposition(formData.nombreAdulte, formData.nombreEnfant);
    if (!householdValidation.isValid) return { success: false, error: householdValidation.error };

    const addressValidation = validateAddressAndGetQuartier(formData.address, formData.postalCode, formData.city);
    if (!addressValidation.isValid) return { success: false, error: `Adresse invalide: ${addressValidation.error}` };

    const duplicate = findDuplicateFamily(formData.phone, formData.lastName, formData.email);
    if (duplicate.exists) return { success: false, error: `Famille existe déjà (ID: ${duplicate.id})` };

    const familyId = generateFamilyId();
    writeToFamilySheet(formData, {
        status: CONFIG.STATUS.IN_PROGRESS,
        familyId,
        quartierId: addressValidation.quartierId,
        identityIds: [], aidesEtatIds: [], resourceIds: [],
        criticite,
        langue: formData.langue,
        seDeplace: formData.seDeplace,
        zakatElFitr: false,
        sadaqa: false
    });

    const messages = ['📥 Importé en masse'];
    if (addressValidation.quartierInvalid) messages.push(`⚠️ ${addressValidation.warning}`);
    appendSheetComments(familyId, CONFIG.AUDIT_SOURCES.IMPORT_EN_MASSE, messages);

    logInfo(`Famille importée: ${familyId} (ligne feuille: ${sheetRowNumber})`);
    return { success: true, familyId, quartierWarning: addressValidation.quartierInvalid ? addressValidation.warning : null };
}

function processBulkImport(batchSize = 10) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_IMPORT_SHEET_NAME);
    if (!sheet) return { success: false, message: '❌ Feuille "Bulk Import" introuvable.' };

    const lastRow = sheet.getLastRow();
    const FIRST_DATA_ROW = 2;
    if (lastRow < FIRST_DATA_ROW) return { success: false, message: '⚠️ Aucune donnée à traiter.' };

    const numDataRows = lastRow - FIRST_DATA_ROW + 1;
    const data = sheet.getRange(FIRST_DATA_ROW, 1, numDataRows, 17).getValues();
    const comments = sheet.getRange(FIRST_DATA_ROW, BULK_COLUMNS.COMMENTAIRE + 1, numDataRows, 1).getValues();

    const pendingRows = [];
    data.forEach((row, arrayIndex) => {
        const comment = comments[arrayIndex][0];
        const sheetRowNumber = FIRST_DATA_ROW + arrayIndex;
        if (!comment || comment === '' || comment === 'En attente' || comment.includes('En cours...')) {
            pendingRows.push({ row, sheetRowNumber, arrayIndex });
        }
    });

    if (pendingRows.length === 0) {
        return { success: true, message: '✅ Toutes les lignes ont déjà été traitées.', processed: 0, succeeded: 0, failed: 0, skipped: 0, remaining: 0, errors: [] };
    }

    const rowsToProcess = pendingRows.slice(0, batchSize);
    const results = { success: true, processed: 0, succeeded: 0, failed: 0, skipped: 0, remaining: pendingRows.length - rowsToProcess.length, errors: [] };

    rowsToProcess.forEach(item => {
        const { row, sheetRowNumber } = item;
        try {
            sheet.getRange(sheetRowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue('⚙️ En cours...');
            SpreadsheetApp.flush();

            const result = processBulkImportRow(row, sheetRowNumber);

            if (result.success) {
                results.succeeded++;
                let comment = `✅ Importée avec ID ${result.familyId}`;
                if (result.quartierWarning) comment += `\n${result.quartierWarning}`;
                sheet.getRange(sheetRowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(comment);
            } else {
                results.failed++;
                sheet.getRange(sheetRowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(`❌ Erreur: ${result.error}`);
                results.errors.push({ row: sheetRowNumber, error: result.error });
            }
            results.processed++;
        } catch (error) {
            logError(`Erreur ligne ${sheetRowNumber}`, error);
            results.failed++;
            sheet.getRange(sheetRowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(`❌ Erreur système: ${error.toString()}`);
            results.errors.push({ row: sheetRowNumber, error: error.toString() });
        }
    });

    if (results.succeeded > 0 || results.failed > 0) {
        notifyAdmin('📥 Import en masse terminé', `Traités: ${results.processed}\nRéussis: ${results.succeeded}\nÉchecs: ${results.failed}\nRestants: ${results.remaining}`);
    }

    return results;
}

function getBulkImportStatistics() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_IMPORT_SHEET_NAME);
    if (!sheet) return { total: 0, pending: 0, processing: 0, success: 0, error: 0 };

    const lastRow = sheet.getLastRow();
    const FIRST_DATA_ROW = 2;
    if (lastRow < FIRST_DATA_ROW) return { total: 0, pending: 0, processing: 0, success: 0, error: 0 };

    const numDataRows = lastRow - FIRST_DATA_ROW + 1;
    const data = sheet.getRange(FIRST_DATA_ROW, BULK_COLUMNS.COMMENTAIRE + 1, numDataRows, 1).getValues();
    const stats = { total: numDataRows, pending: 0, processing: 0, success: 0, error: 0 };

    data.forEach(row => {
        const comment = row[0];
        if (!comment || comment === '' || comment === 'En attente') stats.pending++;
        else if (comment.includes('En cours')) stats.processing++;
        else if (comment.includes('✅') || comment.includes('Importée')) stats.success++;
        else if (comment.includes('❌') || comment.includes('Erreur')) stats.error++;
    });

    return stats;
}

function clearBulkImportSheet() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_IMPORT_SHEET_NAME);
    if (!sheet) return { success: false, message: '❌ Feuille "Bulk Import" introuvable' };
    const lastRow = sheet.getLastRow();
    const FIRST_DATA_ROW = 2;
    if (lastRow >= FIRST_DATA_ROW) {
        sheet.deleteRows(FIRST_DATA_ROW, lastRow - FIRST_DATA_ROW + 1);
        return { success: true, message: `✅ ${lastRow - FIRST_DATA_ROW + 1} lignes supprimées` };
    }
    return { success: true, message: '✅ Feuille déjà vide' };
}

function resetProcessingStatus() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_IMPORT_SHEET_NAME);
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    const FIRST_DATA_ROW = 2;
    if (lastRow < FIRST_DATA_ROW) return;
    const numDataRows = lastRow - FIRST_DATA_ROW + 1;
    const data = sheet.getRange(FIRST_DATA_ROW, BULK_COLUMNS.COMMENTAIRE + 1, numDataRows, 1).getValues();
    let resetCount = 0;
    data.forEach((row, arrayIndex) => {
        if (row[0] && row[0].includes('En cours')) {
            sheet.getRange(FIRST_DATA_ROW + arrayIndex, BULK_COLUMNS.COMMENTAIRE + 1).setValue('En attente (reset après timeout)');
            resetCount++;
        }
    });
    if (resetCount > 0) logInfo(`${resetCount} lignes "En cours" réinitialisées dans Bulk Import`);
}
