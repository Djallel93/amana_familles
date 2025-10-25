/**
 * @file src/services/bulkUpdateService.js
 * @description Handle bulk family updates from spreadsheet
 */

/**
 * Get or create Bulk Update sheet with template
 */
function getOrCreateBulkUpdateSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(BULK_UPDATE_SHEET_NAME);

    if (!sheet) {
        sheet = ss.insertSheet(BULK_UPDATE_SHEET_NAME);

        // Create headers
        const headers = [
            'id', 'nom', 'prenom', 'nombre_adulte', 'nombre_enfant', 'adresse',
            'code_postal', 'ville', 'telephone', 'telephone_bis', 'email',
            'circonstances', 'ressentit', 'specificites', 'criticite', 'statut', 'commentaire'
        ];

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

        // Format header
        sheet.getRange(1, 1, 1, headers.length)
            .setBackground('#ff9800')
            .setFontColor('#ffffff')
            .setFontWeight('bold');

        // Freeze header row
        sheet.setFrozenRows(1);

        // Set column widths
        sheet.setColumnWidth(BULK_UPDATE_COLUMNS.ID + 1, 150);
        sheet.setColumnWidth(BULK_UPDATE_COLUMNS.CRITICITE + 1, 80);
        sheet.setColumnWidth(BULK_UPDATE_COLUMNS.STATUT + 1, 100);
        sheet.setColumnWidth(BULK_UPDATE_COLUMNS.COMMENTAIRE + 1, 300);

        // Auto-resize other columns
        for (let i = 2; i <= 14; i++) {
            sheet.autoResizeColumn(i);
        }

        // Add instruction note
        sheet.getRange('A2').setNote(
            '⚠️ IMPORTANT:\n' +
            '1. La colonne "id" est OBLIGATOIRE\n' +
            '2. Au moins une autre colonne doit contenir une valeur\n' +
            '3. Seules les colonnes non vides seront mises à jour\n' +
            '4. Les colonnes vides seront ignorées'
        );

        logInfo('Bulk Update sheet created');
    }

    return sheet;
}

/**
 * Process bulk update with batch limit
 */
function processBulkUpdate(batchSize = 10) {
    const sheet = getOrCreateBulkUpdateSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
        return {
            success: false,
            message: 'Aucune donnée à traiter. Collez vos mises à jour dans la feuille "Bulk Update".'
        };
    }

    // Get all data
    const data = sheet.getRange(2, 1, lastRow - 1, 17).getValues();

    // Find pending rows
    const pendingRows = [];
    data.forEach((row, index) => {
        const status = row[BULK_UPDATE_COLUMNS.STATUT];
        if (!status || status === CONFIG.BULK_STATUS.PENDING || status === '') {
            pendingRows.push({ row: row, index: index + 2 });
        }
    });

    if (pendingRows.length === 0) {
        return {
            success: true,
            message: 'Toutes les lignes ont déjà été traitées.',
            processed: 0,
            remaining: 0
        };
    }

    // Limit to batch size
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

    logInfo(`Processing ${rowsToProcess.length} family updates (batch size: ${batchSize})`);

    // Process each row
    rowsToProcess.forEach(item => {
        const { row, index } = item;
        const rowNumber = index;

        try {
            // Set status to Processing
            sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.STATUT + 1).setValue(CONFIG.BULK_STATUS.PROCESSING);
            SpreadsheetApp.flush();

            // Process the update
            const result = processBulkUpdateRow(row, sheet, rowNumber);

            if (result.success) {
                results.succeeded++;
                sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.STATUT + 1).setValue(CONFIG.BULK_STATUS.SUCCESS);
                sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(
                    `Mis à jour: ${result.updatedFields.join(', ')}`
                );
            } else {
                results.failed++;
                sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.STATUT + 1).setValue(CONFIG.BULK_STATUS.ERROR);
                sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(result.error);
                results.errors.push({ row: rowNumber, error: result.error });
            }

            results.processed++;

        } catch (error) {
            logError(`Error processing update row ${rowNumber}`, error);
            results.failed++;
            sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.STATUT + 1).setValue(CONFIG.BULK_STATUS.ERROR);
            sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(
                `Erreur système: ${error.toString()}`
            );
            results.errors.push({ row: rowNumber, error: error.toString() });
        }
    });

    logInfo('Bulk update completed', results);
    return results;
}

/**
 * Process a single bulk update row
 */
function processBulkUpdateRow(row, sheet, rowNumber) {
    const familyId = row[BULK_UPDATE_COLUMNS.ID];

    // Validate ID is provided
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
        updateData.postalCode = row[BULK_UPDATE_COLUMNS.CODE_POSTAL];
        updatedFields.push('code_postal');
    }
    if (row[BULK_UPDATE_COLUMNS.VILLE]) {
        updateData.city = row[BULK_UPDATE_COLUMNS.VILLE];
        updatedFields.push('ville');
    }
    if (row[BULK_UPDATE_COLUMNS.TELEPHONE]) {
        updateData.phone = row[BULK_UPDATE_COLUMNS.TELEPHONE];
        updatedFields.push('telephone');
    }
    if (row[BULK_UPDATE_COLUMNS.TELEPHONE_BIS]) {
        updateData.phoneBis = row[BULK_UPDATE_COLUMNS.TELEPHONE_BIS];
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

    // Check if at least one field to update
    if (updatedFields.length === 0) {
        return {
            success: false,
            error: 'Au moins un champ doit être renseigné pour la mise à jour'
        };
    }

    // Update family
    const result = updateFamilyById(familyId, updateData);

    if (result.success) {
        return {
            success: true,
            updatedFields: updatedFields
        };
    } else {
        return {
            success: false,
            error: result.error
        };
    }
}

/**
 * Clear all data from Bulk Update sheet (keep headers)
 */
function clearBulkUpdateSheet() {
    const sheet = getOrCreateBulkUpdateSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
        logInfo('Bulk Update sheet cleared');
        return {
            success: true,
            message: `${lastRow - 1} lignes supprimées`
        };
    }

    return {
        success: true,
        message: 'La feuille est déjà vide'
    };
}

/**
 * Get bulk update statistics
 */
function getBulkUpdateStatistics() {
    const sheet = getSheetByName(BULK_UPDATE_SHEET_NAME);
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

    const data = sheet.getRange(2, BULK_UPDATE_COLUMNS.STATUT + 1, lastRow - 1, 1).getValues();

    const stats = {
        total: lastRow - 1,
        pending: 0,
        processing: 0,
        success: 0,
        error: 0
    };

    data.forEach(row => {
        const status = row[0];
        if (!status || status === CONFIG.BULK_STATUS.PENDING || status === '') {
            stats.pending++;
        } else if (status === CONFIG.BULK_STATUS.PROCESSING) {
            stats.processing++;
        } else if (status === CONFIG.BULK_STATUS.SUCCESS) {
            stats.success++;
        } else if (status === CONFIG.BULK_STATUS.ERROR) {
            stats.error++;
        }
    });

    return stats;
}

/**
 * Reset processing status to pending (in case of script timeout)
 */
function resetUpdateProcessingStatus() {
    const sheet = getSheetByName(BULK_UPDATE_SHEET_NAME);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const data = sheet.getRange(2, BULK_UPDATE_COLUMNS.STATUT + 1, lastRow - 1, 1).getValues();

    let resetCount = 0;
    data.forEach((row, index) => {
        if (row[0] === CONFIG.BULK_STATUS.PROCESSING) {
            sheet.getRange(index + 2, BULK_UPDATE_COLUMNS.STATUT + 1).setValue(CONFIG.BULK_STATUS.PENDING);
            sheet.getRange(index + 2, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(
                'Réinitialisé après timeout'
            );
            resetCount++;
        }
    });

    if (resetCount > 0) {
        logInfo(`Reset ${resetCount} processing rows to pending in Bulk Update`);
    }
}