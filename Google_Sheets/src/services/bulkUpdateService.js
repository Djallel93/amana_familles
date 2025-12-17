/**
 * @file src/services/bulkUpdateService.js (FIXED)
 * @description Handle bulk updates with proper row tracking
 */

/**
 * Process single bulk update row
 * @param {Array} row - Row data
 * @param {Sheet} sheet - Bulk Update sheet
 * @param {number} rowNumber - ACTUAL row number in sheet (1-based)
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
        updateData.nombreAdulte = parseInt(row[BULK_UPDATE_COLUMNS.NOMBRE_ADULTE]);
        updatedFields.push('nombre_adulte');
    }
    if (row[BULK_UPDATE_COLUMNS.NOMBRE_ENFANT] !== '' && row[BULK_UPDATE_COLUMNS.NOMBRE_ENFANT] !== null) {
        updateData.nombreEnfant = parseInt(row[BULK_UPDATE_COLUMNS.NOMBRE_ENFANT]);
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
    if (row[BULK_UPDATE_COLUMNS.SE_DEPLACE] !== '' && row[BULK_UPDATE_COLUMNS.SE_DEPLACE] !== null) {
        updateData.seDeplace = parseSeDeplace(row[BULK_UPDATE_COLUMNS.SE_DEPLACE]);
        updatedFields.push('se_deplace');
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
        updateData.criticite = parseInt(row[BULK_UPDATE_COLUMNS.CRITICITE]);
        updatedFields.push('criticite');
    }
    if (row[BULK_UPDATE_COLUMNS.LANGUE]) {
        updateData.langue = row[BULK_UPDATE_COLUMNS.LANGUE];
        updatedFields.push('langue');
    }

    if (updatedFields.length === 0) {
        return {
            success: false,
            error: 'Au moins un champ doit être renseigné'
        };
    }

    // Force status to "En cours" after bulk update
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
 * Process bulk updates with batch limit (FIXED ROW TRACKING)
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

    // Row 1: Headers
    // Row 2+: Data
    if (lastRow <= 1) {
        return {
            success: false,
            message: '⚠️ No data to process. Paste your updates in "Bulk Update" sheet starting from row 2.'
        };
    }

    // Get data starting from row 2
    const dataStartRow = 2;
    const numDataRows = lastRow - 1;
    const data = sheet.getRange(dataStartRow, 1, numDataRows, 18).getValues();
    const comments = sheet.getRange(dataStartRow, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1, numDataRows, 1).getValues();

    // Find pending rows
    const pendingRows = [];
    data.forEach((row, index) => {
        const comment = comments[index][0];
        const actualRowNumber = dataStartRow + index;

        if (!comment || comment === '' || comment === 'En attente' || comment.includes('En cours...')) {
            pendingRows.push({
                row: row,
                sheetRowNumber: actualRowNumber,
                dataIndex: index
            });
        }
    });

    if (pendingRows.length === 0) {
        return {
            success: true,
            message: '✅ All rows already processed.',
            processed: 0,
            succeeded: 0,
            failed: 0,
            remaining: 0,
            errors: []
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
        const { row, sheetRowNumber } = item;

        try {
            sheet.getRange(sheetRowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue('⚙️ En cours...');
            SpreadsheetApp.flush();

            const result = processBulkUpdateRow(row, sheet, sheetRowNumber);

            if (result.success) {
                results.succeeded++;
                let comment = `✅ Mis à jour: ${result.updatedFields.join(', ')}`;
                if (result.quartierWarning) {
                    comment += `\n${result.quartierWarning}`;
                }
                sheet.getRange(sheetRowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(comment);
            } else {
                results.failed++;
                sheet.getRange(sheetRowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(
                    `❌ Erreur: ${result.error}`
                );
                results.errors.push({ row: sheetRowNumber, error: result.error });
            }

            results.processed++;

        } catch (error) {
            logError(`❌ Error row ${sheetRowNumber}`, error);
            results.failed++;
            sheet.getRange(sheetRowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(
                `❌ System error: ${error.toString()}`
            );
            results.errors.push({ row: sheetRowNumber, error: error.toString() });
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

    const dataStartRow = 2;
    const numDataRows = lastRow - 1;
    const data = sheet.getRange(dataStartRow, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1, numDataRows, 1).getValues();

    const stats = {
        total: numDataRows,
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

    const dataStartRow = 2;
    const numDataRows = lastRow - 1;
    const data = sheet.getRange(dataStartRow, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1, numDataRows, 1).getValues();

    let resetCount = 0;
    data.forEach((row, index) => {
        if (row[0] && row[0].includes('En cours')) {
            const actualRow = dataStartRow + index;
            sheet.getRange(actualRow, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(
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
            'email', 'se_deplace', 'circonstances', 'ressentit', 'specificites',
            'criticite', 'langue', 'commentaire'
        ];

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

        // Format headers
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setBackground('#1a73e8');
        headerRange.setFontColor('#ffffff');
        headerRange.setFontWeight('bold');
        headerRange.setHorizontalAlignment('center');

        sheet.setFrozenRows(1);

        // Set column widths
        sheet.setColumnWidth(1, 80); // id
        sheet.setColumnWidths(2, 3, 150); // nom, prenom, nombre_adulte
        sheet.setColumnWidth(4, 100); // nombre_enfant
        sheet.setColumnWidth(5, 250); // adresse
        sheet.setColumnWidths(6, 2, 100); // code_postal, ville
        sheet.setColumnWidths(8, 2, 150); // telephone, telephone_bis
        sheet.setColumnWidth(10, 150); // email
        sheet.setColumnWidth(11, 80); // se_deplace
        sheet.setColumnWidths(12, 3, 200); // circonstances, ressentit, specificites
        sheet.setColumnWidth(15, 80); // criticite
        sheet.setColumnWidth(16, 100); // langue
        sheet.setColumnWidth(17, 300); // commentaire

        logInfo('📄 Bulk Update sheet created');
    }

    return sheet;
}