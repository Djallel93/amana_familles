/**
 * @file src/services/bulkUpdateService.js (ENHANCED)
 * @description Handle bulk updates with "En cours" status after update
 */

/**
 * Process single bulk update row
 */
function processBulkUpdateRow(row, sheet, rowNumber) {
    const familyId = row[BULK_UPDATE_COLUMNS.ID];

    if (!familyId) {
        return {
            success: false,
            error: 'ID famille obligatoire'
        };
    }

    // Build update data (only non-empty fields)
    const updateData = {};
    const updatedFields = [];

    if (row[BULK_UPDATE_COLUMNS.NOM]) {
        updateData.lastName = row[BULK_UPDATE_COLUMNS.NOM];
        updatedFields.push('nom');
    }
    if (row[BULK_UPDATE_COLUMNS.PRENOM]) {
        updateData.firstName = row[BULK_UPDATE_COLUMNS.PRENOM];
        updatedFields.push('prenom');
    }
    if (row[BULK_UPDATE_COLUMNS.NOMBRE_ADULTE] !== '' && row[BULK_UPDATE_COLUMNS.NOMBRE_ADULTE] !== null) {
        updateData.nombreAdulte = row[BULK_UPDATE_COLUMNS.NOMBRE_ADULTE];
        updatedFields.push('nombre_adulte');
    }
    if (row[BULK_UPDATE_COLUMNS.NOMBRE_ENFANT] !== '' && row[BULK_UPDATE_COLUMNS.NOMBRE_ENFANT] !== null) {
        updateData.nombreEnfant = row[BULK_UPDATE_COLUMNS.NOMBRE_ENFANT];
        updatedFields.push('nombre_enfant');
    }
    if (row[BULK_UPDATE_COLUMNS.ADRESSE]) {
        updateData.address = row[BULK_UPDATE_COLUMNS.ADRESSE];
        updatedFields.push('adresse');
    }
    if (row[BULK_UPDATE_COLUMNS.CODE_POSTAL]) {
        updateData.postalCode = String(row[BULK_UPDATE_COLUMNS.CODE_POSTAL]);
        updatedFields.push('code_postal');
    }
    if (row[BULK_UPDATE_COLUMNS.VILLE]) {
        updateData.city = row[BULK_UPDATE_COLUMNS.VILLE];
        updatedFields.push('ville');
    }
    if (row[BULK_UPDATE_COLUMNS.TELEPHONE]) {
        updateData.phone = String(row[BULK_UPDATE_COLUMNS.TELEPHONE]);
        updatedFields.push('telephone');
    }
    if (row[BULK_UPDATE_COLUMNS.TELEPHONE_BIS]) {
        updateData.phoneBis = String(row[BULK_UPDATE_COLUMNS.TELEPHONE_BIS]);
        updatedFields.push('telephone_bis');
    }
    if (row[BULK_UPDATE_COLUMNS.EMAIL]) {
        updateData.email = row[BULK_UPDATE_COLUMNS.EMAIL];
        updatedFields.push('email');
    }
    if (row[BULK_UPDATE_COLUMNS.CIRCONSTANCES]) {
        updateData.circonstances = row[BULK_UPDATE_COLUMNS.CIRCONSTANCES];
        updatedFields.push('circonstances');
    }
    if (row[BULK_UPDATE_COLUMNS.RESSENTIT]) {
        updateData.ressentit = row[BULK_UPDATE_COLUMNS.RESSENTIT];
        updatedFields.push('ressentit');
    }
    if (row[BULK_UPDATE_COLUMNS.SPECIFICITES]) {
        updateData.specificites = row[BULK_UPDATE_COLUMNS.SPECIFICITES];
        updatedFields.push('specificites');
    }
    if (row[BULK_UPDATE_COLUMNS.CRITICITE] !== '' && row[BULK_UPDATE_COLUMNS.CRITICITE] !== null) {
        updateData.criticite = row[BULK_UPDATE_COLUMNS.CRITICITE];
        updatedFields.push('criticite');
    }

    if (updatedFields.length === 0) {
        return {
            success: false,
            error: 'Au moins un champ doit être renseigné'
        };
    }

    // CHANGED: Force status to "En cours" after bulk update
    updateData.forceInProgress = true;

    // Update family
    const result = updateFamilyById(familyId, updateData);

    if (result.success) {
        return {
            success: true,
            updatedFields: updatedFields,
            quartierWarning: result.quartierWarning
        };
    } else {
        return {
            success: false,
            error: result.error
        };
    }
}

/**
 * Process bulk updates with batch limit
 */
function processBulkUpdate(batchSize = 10) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_UPDATE_SHEET_NAME);

    if (!sheet) {
        return {
            success: false,
            message: '❌ "Bulk Update" sheet not found. Create it first via menu.'
        };
    }

    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
        return {
            success: false,
            message: '⚠️ No data to process. Paste your updates in "Bulk Update" sheet.'
        };
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 16).getValues();

    // Find pending rows
    const pendingRows = [];
    data.forEach((row, index) => {
        const comment = row[BULK_UPDATE_COLUMNS.COMMENTAIRE];
        if (!comment || comment === '' || comment === 'En attente') {
            pendingRows.push({ row: row, index: index + 2 });
        }
    });

    if (pendingRows.length === 0) {
        return {
            success: true,
            message: '✅ All rows already processed.',
            processed: 0,
            remaining: 0
        };
    }

    const rowsToProcess = pendingRows.slice(0, batchSize);
    const results = {
        success: true,
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        remaining: pendingRows.length - rowsToProcess.length,
        errors: []
    };

    logInfo(`✏️ Processing ${rowsToProcess.length} updates (batch: ${batchSize})`);

    rowsToProcess.forEach(item => {
        const { row, index } = item;
        const rowNumber = index;

        try {
            sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue('⚙️ En cours...');
            SpreadsheetApp.flush();

            const result = processBulkUpdateRow(row, sheet, rowNumber);

            if (result.success) {
                results.succeeded++;
                let comment = `✅ Mis à jour: ${result.updatedFields.join(', ')} (Statut: En cours)`;
                if (result.quartierWarning) {
                    comment += `\n${result.quartierWarning}`;
                }
                sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(comment);
            } else {
                results.failed++;
                sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(
                    `❌ Erreur: ${result.error}`
                );
                results.errors.push({ row: rowNumber, error: result.error });
            }

            results.processed++;

        } catch (error) {
            logError(`❌ Error row ${rowNumber}`, error);
            results.failed++;
            sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(
                `❌ System error: ${error.toString()}`
            );
            results.errors.push({ row: rowNumber, error: error.toString() });
        }
    });

    logInfo('✅ Bulk update completed', results);

    if (results.succeeded > 0 || results.failed > 0) {
        notifyAdmin(
            '✏️ Bulk Update Completed',
            `Processed: ${results.processed}\nSucceeded: ${results.succeeded}\nFailed: ${results.failed}\nRemaining: ${results.remaining}\n\nNote: Toutes les familles mises à jour ont le statut "En cours"`
        );
    }

    return results;
}

/**
 * Clear all data from Bulk Update sheet (keep headers)
 */
function clearBulkUpdateSheet() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_UPDATE_SHEET_NAME);

    if (!sheet) {
        return {
            success: false,
            message: '❌ "Bulk Update" sheet not found'
        };
    }

    const lastRow = sheet.getLastRow();

    if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
        logInfo('🗑️ Bulk Update sheet cleared');
        return {
            success: true,
            message: `✅ ${lastRow - 1} rows deleted`
        };
    }

    return {
        success: true,
        message: '✅ Sheet already empty'
    };
}

/**
 * Get bulk update statistics
 */
function getBulkUpdateStatistics() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_UPDATE_SHEET_NAME);

    if (!sheet) {
        return {
            total: 0,
            pending: 0,
            processing: 0,
            success: 0,
            error: 0
        };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
        return {
            total: 0,
            pending: 0,
            processing: 0,
            success: 0,
            error: 0
        };
    }

    const data = sheet.getRange(2, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1, lastRow - 1, 1).getValues();

    const stats = {
        total: lastRow - 1,
        pending: 0,
        processing: 0,
        success: 0,
        error: 0
    };

    data.forEach(row => {
        const comment = row[0];
        if (!comment || comment === '' || comment === 'En attente') {
            stats.pending++;
        } else if (comment.includes('En cours')) {
            stats.processing++;
        } else if (comment.includes('✅') || comment.includes('Mis à jour')) {
            stats.success++;
        } else if (comment.includes('❌') || comment.includes('Erreur')) {
            stats.error++;
        }
    });

    return stats;
}

/**
 * Reset "Processing" status to "Pending"
 */
function resetUpdateProcessingStatus() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_UPDATE_SHEET_NAME);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const data = sheet.getRange(2, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1, lastRow - 1, 1).getValues();

    let resetCount = 0;
    data.forEach((row, index) => {
        if (row[0] && row[0].includes('En cours')) {
            sheet.getRange(index + 2, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(
                'En attente (reset after timeout)'
            );
            resetCount++;
        }
    });

    if (resetCount > 0) {
        logInfo(`🔄 ${resetCount} "Processing" rows reset in Bulk Update`);
    }
}

/**
 * Get or create Bulk Update sheet with proper headers
 */
function getOrCreateBulkUpdateSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(BULK_UPDATE_SHEET_NAME);

    if (!sheet) {
        sheet = ss.insertSheet(BULK_UPDATE_SHEET_NAME);

        const headers = [
            'id', 'nom', 'prenom', 'nombre_adulte', 'nombre_enfant',
            'adresse', 'code_postal', 'ville', 'telephone', 'telephone_bis',
            'email', 'circonstances', 'ressentit', 'specificites',
            'criticite', 'commentaire'
        ];

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);

        logInfo('📄 Bulk Update sheet created');
    }

    return sheet;
}