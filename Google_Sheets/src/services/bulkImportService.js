/**
 * @file src/services/bulkImportService.js (FIXED ROW TRACKING)
 * @description Complete bulk import service with correct row numbering
 * Row 1: Headers
 * Row 2+: Data (starts here)
 */

/**
 * Process single bulk import row
 * @param {Array} row - Row data
 * @param {Sheet} sheet - Bulk Import sheet
 * @param {number} sheetRowNumber - ACTUAL row number in sheet (1-based, should be >= 2)
 */
function processBulkImportRow(row, sheet, sheetRowNumber) {
    // Extract data from row
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

    // Validate required fields
    if (!formData.lastName || !formData.firstName) {
        return {
            success: false,
            error: 'Nom et prénom requis'
        };
    }

    if (!formData.address || !formData.postalCode || !formData.city) {
        return {
            success: false,
            error: 'Adresse complète requise (adresse, code postal, ville)'
        };
    }

    if (!formData.phone) {
        return {
            success: false,
            error: 'Téléphone requis'
        };
    }

    // Validate criticite
    const criticite = parseInt(formData.criticite);
    if (isNaN(criticite) || criticite < CONFIG.CRITICITE.MIN || criticite > CONFIG.CRITICITE.MAX) {
        return {
            success: false,
            error: `Criticité invalide. Doit être entre ${CONFIG.CRITICITE.MIN} et ${CONFIG.CRITICITE.MAX}`
        };
    }

    // Validate phone
    if (!isValidPhone(formData.phone)) {
        return {
            success: false,
            error: 'Numéro de téléphone invalide'
        };
    }

    // Validate email if provided
    if (formData.email && !isValidEmail(formData.email)) {
        return {
            success: false,
            error: 'Email invalide'
        };
    }

    // Validate household composition
    const householdValidation = validateHouseholdComposition(formData.nombreAdulte, formData.nombreEnfant);
    if (!householdValidation.isValid) {
        return {
            success: false,
            error: householdValidation.error
        };
    }

    // Validate address and get quartier
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

    let quartierWarning = null;
    if (addressValidation.quartierInvalid) {
        quartierWarning = addressValidation.warning;
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
            error: `Famille existe déjà (ID: ${duplicate.id})`
        };
    }

    // Generate new family ID
    const familyId = generateFamilyId();

    // Set status to "En cours" after bulk import
    const status = CONFIG.STATUS.IN_PROGRESS;
    let comment = `📥 ${new Date().toLocaleString('fr-FR')} Importé en masse`;

    if (quartierWarning) {
        comment += `\n⚠️ ${quartierWarning}`;
    }

    // Write to Famille sheet
    writeToFamilySheet(formData, {
        status: status,
        comment: comment,
        familyId: familyId,
        quartierId: addressValidation.quartierId,
        quartierName: addressValidation.quartierName,
        identityIds: [],
        aidesEtatIds: [],
        resourceIds: [],
        criticite: criticite,
        langue: formData.langue,
        seDeplace: formData.seDeplace,
        zakatElFitr: false,
        sadaqa: false
    });

    logInfo(`✅ Famille importée avec statut "En cours": ${familyId} (Ligne feuille: ${sheetRowNumber})`, { criticite });

    return {
        success: true,
        familyId: familyId,
        quartierWarning: quartierWarning
    };
}

/**
 * Process bulk import with batch limit
 * FIXED: Correct row tracking starting from row 2
 */
function processBulkImport(batchSize = 10) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_IMPORT_SHEET_NAME);

    if (!sheet) {
        return {
            success: false,
            message: '❌ "Bulk Import" sheet not found. Create it first via menu.'
        };
    }

    const lastRow = sheet.getLastRow();

    // Row 1: Headers
    // Row 2+: Data
    const DATA_START_ROW = 2;

    if (lastRow < DATA_START_ROW) {
        return {
            success: false,
            message: '⚠️ No data to process. Paste your data in "Bulk Import" sheet starting from row 2.'
        };
    }

    // Get data starting from row 2 (skip header row 1)
    const numDataRows = lastRow - DATA_START_ROW + 1; // +1 because lastRow is inclusive
    const dataRange = sheet.getRange(DATA_START_ROW, 1, numDataRows, 17);
    const data = dataRange.getValues();

    // Get comment column for all data rows
    const commentRange = sheet.getRange(DATA_START_ROW, BULK_COLUMNS.COMMENTAIRE + 1, numDataRows, 1);
    const comments = commentRange.getValues();

    // Find pending rows (not yet processed)
    const pendingRows = [];
    data.forEach((row, dataIndex) => {
        const comment = comments[dataIndex][0];
        const actualRowNumber = DATA_START_ROW + dataIndex; // Calculate actual sheet row number

        // Only process if not already processed successfully
        if (!comment || comment === '' || comment === 'En attente' || comment.includes('En cours...')) {
            pendingRows.push({
                row: row,
                sheetRowNumber: actualRowNumber,
                dataIndex: dataIndex
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
            skipped: 0,
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

    logInfo(`📥 Processing ${rowsToProcess.length} imports (batch: ${batchSize}, starting from row 2)`);

    rowsToProcess.forEach(item => {
        const { row, sheetRowNumber } = item;

        try {
            // Set processing status
            sheet.getRange(sheetRowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue('⚙️ En cours...');
            SpreadsheetApp.flush();

            const result = processBulkImportRow(row, sheet, sheetRowNumber);

            if (result.success) {
                results.succeeded++;
                let comment = `✅ Importée avec ID ${result.familyId}`;
                if (result.quartierWarning) {
                    comment += `\n${result.quartierWarning}`;
                }
                sheet.getRange(sheetRowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(comment);
            } else {
                results.failed++;
                sheet.getRange(sheetRowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(
                    `❌ Erreur: ${result.error}`
                );
                results.errors.push({ row: sheetRowNumber, error: result.error });
            }

            results.processed++;

        } catch (error) {
            logError(`❌ Error row ${sheetRowNumber}`, error);
            results.failed++;
            sheet.getRange(sheetRowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(
                `❌ System error: ${error.toString()}`
            );
            results.errors.push({ row: sheetRowNumber, error: error.toString() });
        }
    });

    logInfo('✅ Bulk import completed', results);

    if (results.succeeded > 0 || results.failed > 0) {
        notifyAdmin(
            '📥 Bulk Import Completed',
            `Processed: ${results.processed}\nSucceeded: ${results.succeeded}\nFailed: ${results.failed}\nRemaining: ${results.remaining}\n\nNote: Toutes les familles importées ont le statut "En cours"`
        );
    }

    return results;
}

/**
 * Get bulk import statistics
 */
function getBulkImportStatistics() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_IMPORT_SHEET_NAME);

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
    const DATA_START_ROW = 2;

    if (lastRow < DATA_START_ROW) {
        return {
            total: 0,
            pending: 0,
            processing: 0,
            success: 0,
            error: 0
        };
    }

    // Data starts at row 2
    const numDataRows = lastRow - DATA_START_ROW + 1;
    const data = sheet.getRange(DATA_START_ROW, BULK_COLUMNS.COMMENTAIRE + 1, numDataRows, 1).getValues();

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
        } else if (comment.includes('✅') || comment.includes('Importée')) {
            stats.success++;
        } else if (comment.includes('❌') || comment.includes('Erreur')) {
            stats.error++;
        }
    });

    return stats;
}

/**
 * Clear all data from Bulk Import sheet (keep headers)
 */
function clearBulkImportSheet() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_IMPORT_SHEET_NAME);

    if (!sheet) {
        return {
            success: false,
            message: '❌ "Bulk Import" sheet not found'
        };
    }

    const lastRow = sheet.getLastRow();
    const DATA_START_ROW = 2;

    // Keep row 1 (header), delete from row 2 onwards
    if (lastRow >= DATA_START_ROW) {
        const rowsToDelete = lastRow - DATA_START_ROW + 1;
        sheet.deleteRows(DATA_START_ROW, rowsToDelete);
        logInfo('🗑️ Bulk Import sheet cleared');
        return {
            success: true,
            message: `✅ ${rowsToDelete} rows deleted`
        };
    }

    return {
        success: true,
        message: '✅ Sheet already empty'
    };
}

/**
 * Reset "Processing" status to "Pending"
 */
function resetProcessingStatus() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_IMPORT_SHEET_NAME);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    const DATA_START_ROW = 2;

    if (lastRow < DATA_START_ROW) return;

    const numDataRows = lastRow - DATA_START_ROW + 1;
    const data = sheet.getRange(DATA_START_ROW, BULK_COLUMNS.COMMENTAIRE + 1, numDataRows, 1).getValues();

    let resetCount = 0;
    data.forEach((row, index) => {
        if (row[0] && row[0].includes('En cours')) {
            const actualRow = DATA_START_ROW + index;
            sheet.getRange(actualRow, BULK_COLUMNS.COMMENTAIRE + 1).setValue(
                'En attente (reset after timeout)'
            );
            resetCount++;
        }
    });

    if (resetCount > 0) {
        logInfo(`🔄 ${resetCount} "Processing" rows reset in Bulk Import`);
    }
}

/**
 * Get or create Bulk Import sheet with proper headers
 */
function getOrCreateBulkImportSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(BULK_IMPORT_SHEET_NAME);

    if (!sheet) {
        sheet = ss.insertSheet(BULK_IMPORT_SHEET_NAME);

        // Row 1: Set headers
        const headers = [
            'nom',
            'prenom',
            'nombre_adulte',
            'nombre_enfant',
            'adresse',
            'code_postal',
            'ville',
            'telephone',
            'telephone_bis',
            'email',
            'se_deplace',
            'circonstances',
            'ressentit',
            'specificites',
            'criticite',
            'langue',
            'commentaire'
        ];

        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

        // Format headers
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setBackground('#1a73e8');
        headerRange.setFontColor('#ffffff');
        headerRange.setFontWeight('bold');
        headerRange.setHorizontalAlignment('center');

        // Freeze header row
        sheet.setFrozenRows(1);

        // Set column widths
        sheet.setColumnWidths(1, 3, 150);
        sheet.setColumnWidth(4, 100);
        sheet.setColumnWidth(5, 250);
        sheet.setColumnWidths(6, 2, 100);
        sheet.setColumnWidths(8, 2, 150);
        sheet.setColumnWidth(10, 150);
        sheet.setColumnWidth(11, 80); // se_deplace
        sheet.setColumnWidths(12, 3, 200);
        sheet.setColumnWidth(15, 80);
        sheet.setColumnWidth(16, 100);
        sheet.setColumnWidth(17, 300);

        // Add data validation for criticite (starting from row 2)
        const criticiteRule = SpreadsheetApp.newDataValidation()
            .requireNumberBetween(0, 5)
            .setAllowInvalid(false)
            .setHelpText('Criticité doit être entre 0 et 5')
            .build();

        sheet.getRange('O2:O1000').setDataValidation(criticiteRule);

        // Add data validation for se_deplace (starting from row 2)
        const seDeplacRule = SpreadsheetApp.newDataValidation()
            .requireValueInList(['Oui', 'Non', 'Yes', 'No', 'نعم', 'لا'], true)
            .setAllowInvalid(false)
            .setHelpText('Sélectionner Oui/Non')
            .build();

        sheet.getRange('K2:K1000').setDataValidation(seDeplacRule);

        // Add data validation for langue (starting from row 2)
        const langueRule = SpreadsheetApp.newDataValidation()
            .requireValueInList(['Français', 'Arabe', 'Anglais'], true)
            .setAllowInvalid(false)
            .setHelpText('Sélectionner une langue')
            .build();

        sheet.getRange('P2:P1000').setDataValidation(langueRule);

        logInfo('✅ Feuille Bulk Import créée avec succès (données à partir de la ligne 2)');
    }

    return sheet;
}