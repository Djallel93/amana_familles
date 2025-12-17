/**
 * @file src/services/bulkImportService.js (FIXED)
 * @description Complete bulk import service with proper row tracking
 */

/**
 * Process single bulk import row
 * @param {Array} row - Row data
 * @param {Sheet} sheet - Bulk Import sheet
 * @param {number} rowNumber - ACTUAL row number in sheet (1-based)
 */
function processBulkImportRow(row, sheet, rowNumber) {
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
    let comment = `📥 ${new Date().toLocaleString('fr-FR')} Importé en masse})`;

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

    logInfo(`✅ Famille importée avec statut "En cours": ${familyId} (Ligne ${rowNumber})`, { criticite });

    return {
        success: true,
        familyId: familyId,
        quartierWarning: quartierWarning
    };
}

/**
 * Process bulk import with batch limit (FIXED ROW TRACKING)
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
    // Row 2: Instructions
    // Row 3+: Data
    if (lastRow <= 2) {
        return {
            success: false,
            message: '⚠️ No data to process. Paste your data in "Bulk Import" sheet starting from row 3.'
        };
    }

    // Get data starting from row 3 (skip header row 1 and instructions row 2)
    const dataStartRow = 3;
    const numDataRows = lastRow - 2; // Total data rows
    const data = sheet.getRange(dataStartRow, 1, numDataRows, 17).getValues();
    const comments = sheet.getRange(dataStartRow, BULK_COLUMNS.COMMENTAIRE + 1, numDataRows, 1).getValues();

    // Find pending rows (not yet processed)
    const pendingRows = [];
    data.forEach((row, index) => {
        const comment = comments[index][0];
        const actualRowNumber = dataStartRow + index; // Actual row number in sheet

        // Only process if not already processed successfully
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

    logInfo(`📥 Processing ${rowsToProcess.length} imports (batch: ${batchSize})`);

    rowsToProcess.forEach(item => {
        const { row, sheetRowNumber } = item;

        try {
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
    if (lastRow <= 2) {
        return {
            total: 0,
            pending: 0,
            processing: 0,
            success: 0,
            error: 0
        };
    }

    // Data starts at row 3
    const dataStartRow = 3;
    const numDataRows = lastRow - 2;
    const data = sheet.getRange(dataStartRow, BULK_COLUMNS.COMMENTAIRE + 1, numDataRows, 1).getValues();

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

    // Keep rows 1 (header) and 2 (instructions), delete from row 3 onwards
    if (lastRow > 2) {
        sheet.deleteRows(3, lastRow - 2);
        logInfo('🗑️ Bulk Import sheet cleared');
        return {
            success: true,
            message: `✅ ${lastRow - 2} rows deleted`
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
    if (lastRow <= 2) return;

    const dataStartRow = 3;
    const numDataRows = lastRow - 2;
    const data = sheet.getRange(dataStartRow, BULK_COLUMNS.COMMENTAIRE + 1, numDataRows, 1).getValues();

    let resetCount = 0;
    data.forEach((row, index) => {
        if (row[0] && row[0].includes('En cours')) {
            const actualRow = dataStartRow + index;
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

        // Add data validation for criticite
        const criticiteRule = SpreadsheetApp.newDataValidation()
            .requireNumberBetween(0, 5)
            .setAllowInvalid(false)
            .setHelpText('Criticité doit être entre 0 et 5')
            .build();

        sheet.getRange('O3:O1000').setDataValidation(criticiteRule);

        // Add data validation for se_deplace
        const seDeplacRule = SpreadsheetApp.newDataValidation()
            .requireValueInList(['Oui', 'Non', 'Yes', 'No', 'نعم', 'لا'], true)
            .setAllowInvalid(false)
            .setHelpText('Sélectionner Oui/Non')
            .build();

        sheet.getRange('K3:K1000').setDataValidation(seDeplacRule);

        // Add data validation for langue
        const langueRule = SpreadsheetApp.newDataValidation()
            .requireValueInList(['Français', 'Arabe', 'Anglais'], true)
            .setAllowInvalid(false)
            .setHelpText('Sélectionner une langue')
            .build();

        sheet.getRange('P3:P1000').setDataValidation(langueRule);

        // Row 2: Add instructions
        const instructions = [
            'Nom de famille (requis)',
            'Prénom (requis)',
            'Nombre d\'adultes (requis)',
            'Nombre d\'enfants (requis)',
            'Adresse complète (requis)',
            'Code postal (requis)',
            'Ville (requis)',
            'Téléphone (requis)',
            'Téléphone secondaire',
            'Email',
            'Oui/Non',
            'Circonstances',
            'Ressentit',
            'Spécificités',
            'Criticité 0-5 (requis)',
            'Français/Arabe/Anglais',
            'Commentaire/Statut (auto)'
        ];

        sheet.getRange(2, 1, 1, instructions.length).setValues([instructions]);
        sheet.getRange(2, 1, 1, instructions.length)
            .setFontStyle('italic')
            .setFontColor('#666666')
            .setBackground('#f8f9fa');

        // Freeze instruction row too
        sheet.setFrozenRows(2);

        logInfo('✅ Feuille Bulk Import créée avec succès');
    }

    return sheet;
}