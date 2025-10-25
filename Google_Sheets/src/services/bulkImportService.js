/**
 * @file src/services/bulkImportService.js
 * @description Handle bulk family imports from spreadsheet
 */

/**
 * Get or create Bulk Import sheet with template
 */
function getOrCreateBulkImportSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(BULK_IMPORT_SHEET_NAME);

    if (!sheet) {
        sheet = ss.insertSheet(BULK_IMPORT_SHEET_NAME);

        // Create headers
        const headers = [
            'nom', 'prenom', 'nombre_adulte', 'nombre_enfant', 'adresse',
            'code_postal', 'ville', 'telephone', 'telephone_bis', 'email',
            'circonstances', 'ressentit', 'specificites', 'statut', 'commentaire'
        ];

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

        // Format header
        sheet.getRange(1, 1, 1, headers.length)
            .setBackground('#1a73e8')
            .setFontColor('#ffffff')
            .setFontWeight('bold');

        // Freeze header row
        sheet.setFrozenRows(1);

        // Set column widths
        sheet.setColumnWidth(BULK_COLUMNS.STATUT + 1, 100);
        sheet.setColumnWidth(BULK_COLUMNS.COMMENTAIRE + 1, 300);

        // Auto-resize other columns
        for (let i = 1; i <= 13; i++) {
            sheet.autoResizeColumn(i);
        }

        logInfo('Bulk Import sheet created');
    }

    return sheet;
}

/**
 * Process bulk import with batch limit
 */
function processBulkImport(batchSize = 10) {
    const sheet = getOrCreateBulkImportSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
        return {
            success: false,
            message: 'Aucune donnée à importer. Collez vos familles dans la feuille "Bulk Import".'
        };
    }

    // Get all data
    const data = sheet.getRange(2, 1, lastRow - 1, 15).getValues();

    // Find pending rows
    const pendingRows = [];
    data.forEach((row, index) => {
        const status = row[BULK_COLUMNS.STATUT];
        if (!status || status === CONFIG.BULK_STATUS.PENDING || status === '') {
            pendingRows.push({ row: row, index: index + 2 }); // +2 for header and 0-based
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

    logInfo(`Processing ${rowsToProcess.length} families (batch size: ${batchSize})`);

    // Process each row
    rowsToProcess.forEach(item => {
        const { row, index } = item;
        const rowNumber = index;

        try {
            // Set status to Processing
            sheet.getRange(rowNumber, BULK_COLUMNS.STATUT + 1).setValue(CONFIG.BULK_STATUS.PROCESSING);
            SpreadsheetApp.flush(); // Force update

            // Process the family
            const result = processBulkImportRow(row, sheet, rowNumber);

            if (result.success) {
                results.succeeded++;
                sheet.getRange(rowNumber, BULK_COLUMNS.STATUT + 1).setValue(CONFIG.BULK_STATUS.SUCCESS);
                sheet.getRange(rowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(
                    `Importé: ${result.familyId}`
                );
            } else {
                results.failed++;
                sheet.getRange(rowNumber, BULK_COLUMNS.STATUT + 1).setValue(CONFIG.BULK_STATUS.ERROR);
                sheet.getRange(rowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(result.error);
                results.errors.push({ row: rowNumber, error: result.error });
            }

            results.processed++;

        } catch (error) {
            logError(`Error processing row ${rowNumber}`, error);
            results.failed++;
            sheet.getRange(rowNumber, BULK_COLUMNS.STATUT + 1).setValue(CONFIG.BULK_STATUS.ERROR);
            sheet.getRange(rowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(
                `Erreur système: ${error.toString()}`
            );
            results.errors.push({ row: rowNumber, error: error.toString() });
        }
    });

    logInfo('Bulk import completed', results);

    return results;
}

/**
 * Process a single bulk import row
 */
function processBulkImportRow(row, sheet, rowNumber) {
    // Parse row data
    const formData = {
        lastName: row[BULK_COLUMNS.NOM] || '',
        firstName: row[BULK_COLUMNS.PRENOM] || '',
        nombreAdulte: row[BULK_COLUMNS.NOMBRE_ADULTE] || 0,
        nombreEnfant: row[BULK_COLUMNS.NOMBRE_ENFANT] || 0,
        address: row[BULK_COLUMNS.ADRESSE] || '',
        postalCode: row[BULK_COLUMNS.CODE_POSTAL] || '',
        city: row[BULK_COLUMNS.VILLE] || '',
        phone: row[BULK_COLUMNS.TELEPHONE] || '',
        phoneBis: row[BULK_COLUMNS.TELEPHONE_BIS] || '',
        email: row[BULK_COLUMNS.EMAIL] || '',
        circonstances: row[BULK_COLUMNS.CIRCONSTANCES] || '',
        ressentit: row[BULK_COLUMNS.RESSENTIT] || '',
        specificites: row[BULK_COLUMNS.SPECIFICITES] || ''
    };

    // Validate required fields
    const fieldValidation = validateRequiredFields(formData);
    if (!fieldValidation.isValid) {
        return {
            success: false,
            error: fieldValidation.errors.join(', ')
        };
    }

    // Validate address
    const addressValidation = validateAddressAndGetQuartier(
        formData.address,
        formData.postalCode,
        formData.city
    );

    if (!addressValidation.isValid) {
        return {
            success: false,
            error: `Adresse invalide: ${addressValidation.error}`
        };
    }

    // Check for duplicates
    const duplicate = findDuplicateFamily(
        formData.phone,
        formData.lastName,
        formData.email
    );

    if (duplicate.exists) {
        return {
            success: false,
            error: `Doublon détecté: ${duplicate.id}`
        };
    }

    // Create family record
    const familyId = writeToFamilySheet(formData, {
        status: CONFIG.STATUS.VALIDATED,
        familyId: generateFamilyId(),
        quartierId: addressValidation.quartierId,
        quartierName: addressValidation.quartierName
    });

    // Sync contact
    const contactData = {
        id: familyId,
        nom: formData.lastName,
        prenom: formData.firstName,
        email: formData.email,
        telephone: formData.phone,
        phoneBis: formData.phoneBis,
        adresse: formData.address
    };

    syncFamilyContact(contactData);

    return {
        success: true,
        familyId: familyId
    };
}

/**
 * Clear all data from Bulk Import sheet (keep headers)
 */
function clearBulkImportSheet() {
    const sheet = getOrCreateBulkImportSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
        logInfo('Bulk Import sheet cleared');
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
 * Get bulk import statistics
 */
function getBulkImportStatistics() {
    const sheet = getSheetByName(BULK_IMPORT_SHEET_NAME);
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

    const data = sheet.getRange(2, BULK_COLUMNS.STATUT + 1, lastRow - 1, 1).getValues();

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
function resetProcessingStatus() {
    const sheet = getSheetByName(BULK_IMPORT_SHEET_NAME);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const data = sheet.getRange(2, BULK_COLUMNS.STATUT + 1, lastRow - 1, 1).getValues();

    let resetCount = 0;
    data.forEach((row, index) => {
        if (row[0] === CONFIG.BULK_STATUS.PROCESSING) {
            sheet.getRange(index + 2, BULK_COLUMNS.STATUT + 1).setValue(CONFIG.BULK_STATUS.PENDING);
            sheet.getRange(index + 2, BULK_COLUMNS.COMMENTAIRE + 1).setValue(
                'Réinitialisé après timeout'
            );
            resetCount++;
        }
    });

    if (resetCount > 0) {
        logInfo(`Reset ${resetCount} processing rows to pending`);
    }
}