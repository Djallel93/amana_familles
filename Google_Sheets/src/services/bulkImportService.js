/**
 * @file src/services/bulkImportService.js (ENHANCED)
 * @description Complete bulk import service with "En cours" status after import
 */

/**
 * Process single bulk import row
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
        criticite: parseInt(row[BULK_COLUMNS.CRITICITE]) || 0
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

    // CHANGED: Always set status to "En cours" after bulk import
    const status = CONFIG.STATUS.IN_PROGRESS;
    let comment = `Importé en masse le ${new Date().toLocaleString('fr-FR')}`;

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
        cafIds: [],
        resourceIds: [],
        criticite: criticite
    });

    // Note: Contact will NOT be synced here because status is "En cours"
    // Contact will be created only when status changes to "Validé"

    logInfo(`✅ Famille importée avec statut "En cours": ${familyId}`, { criticite });

    return {
        success: true,
        familyId: familyId,
        quartierWarning: quartierWarning
    };
}

// ... (rest of the bulk import service remains unchanged)

/**
 * Process bulk import with batch limit
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

    if (lastRow <= 2) {
        return {
            success: false,
            message: '⚠️ No data to process. Paste your data in "Bulk Import" sheet starting from row 3.'
        };
    }

    // Get data starting from row 3 (skip header and instructions)
    const data = sheet.getRange(3, 1, lastRow - 2, 15).getValues();

    // Find pending rows
    const pendingRows = [];
    data.forEach((row, index) => {
        const comment = row[BULK_COLUMNS.COMMENTAIRE];
        if (!comment || comment === '' || comment === 'En attente') {
            pendingRows.push({ row: row, index: index + 3 });
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
        const { row, index } = item;
        const rowNumber = index;

        try {
            sheet.getRange(rowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue('⚙️ En cours...');
            SpreadsheetApp.flush();

            const result = processBulkImportRow(row, sheet, rowNumber);

            if (result.success) {
                results.succeeded++;
                let comment = `✅ Importée: ${result.familyId} (Statut: En cours)`;
                if (result.quartierWarning) {
                    comment += `\n${result.quartierWarning}`;
                }
                sheet.getRange(rowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(comment);
            } else {
                results.failed++;
                sheet.getRange(rowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(
                    `❌ Erreur: ${result.error}`
                );
                results.errors.push({ row: rowNumber, error: result.error });
            }

            results.processed++;

        } catch (error) {
            logError(`❌ Error row ${rowNumber}`, error);
            results.failed++;
            sheet.getRange(rowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(
                `❌ System error: ${error.toString()}`
            );
            results.errors.push({ row: rowNumber, error: error.toString() });
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

    const data = sheet.getRange(3, BULK_COLUMNS.COMMENTAIRE + 1, lastRow - 2, 1).getValues();

    const stats = {
        total: lastRow - 2,
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

    if (lastRow > 3) {
        sheet.deleteRows(4, lastRow - 3);
        logInfo('🗑️ Bulk Import sheet cleared');
        return {
            success: true,
            message: `✅ ${lastRow - 3} rows deleted`
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

    const data = sheet.getRange(3, BULK_COLUMNS.COMMENTAIRE + 1, lastRow - 2, 1).getValues();

    let resetCount = 0;
    data.forEach((row, index) => {
        if (row[0] && row[0].includes('En cours')) {
            sheet.getRange(index + 3, BULK_COLUMNS.COMMENTAIRE + 1).setValue(
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

        // Set headers
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
            'circonstances',
            'ressentit',
            'specificites',
            'criticite',
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
        sheet.setColumnWidths(11, 3, 200);
        sheet.setColumnWidth(14, 80);
        sheet.setColumnWidth(15, 300);

        // Add data validation for criticite
        const criticiteRule = SpreadsheetApp.newDataValidation()
            .requireNumberBetween(0, 5)
            .setAllowInvalid(false)
            .setHelpText('Criticité doit être entre 0 et 5')
            .build();

        sheet.getRange('N3:N1000').setDataValidation(criticiteRule);

        // Add instructions in row 2
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
            'Circonstances',
            'Ressentit',
            'Spécificités',
            'Criticité 0-5 (requis)',
            'Commentaire/Statut (auto)'
        ];

        sheet.getRange(2, 1, 1, instructions.length).setValues([instructions]);
        sheet.getRange(2, 1, 1, instructions.length)
            .setFontStyle('italic')
            .setFontColor('#666666')
            .setBackground('#f8f9fa');

        logInfo('✅ Feuille Bulk Import créée avec succès');
    }

    return sheet;
}