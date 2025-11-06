/**
 * @file src/services/bulkImportService.js
 * @description Complete bulk import service with statistics and processing
 */

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
            pendingRows.push({ row: row, index: index + 3 }); // +3 because we start from row 3
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
                let comment = `✅ Importée: ${result.familyId}`;
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
            `Processed: ${results.processed}\nSucceeded: ${results.succeeded}\nFailed: ${results.failed}\nRemaining: ${results.remaining}`
        );
    }

    return results;
}

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

    // Write to Famille sheet
    const status = addressValidation.quartierInvalid ? CONFIG.STATUS.IN_PROGRESS : CONFIG.STATUS.VALIDATED;
    const comment = quartierWarning ? `⚠️ ${quartierWarning}` : '';

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

    // Sync with Google Contacts
    const contactData = {
        id: familyId,
        nom: formData.lastName,
        prenom: formData.firstName,
        email: formData.email,
        telephone: normalizePhone(formData.phone),
        phoneBis: formData.phoneBis ? normalizePhone(formData.phoneBis) : '',
        adresse: `${formData.address}, ${formData.postalCode} ${formData.city}`
    };

    syncFamilyContact(contactData);

    logInfo(`✅ Famille importée: ${familyId}`, { criticite });

    return {
        success: true,
        familyId: familyId,
        quartierWarning: quartierWarning
    };
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
        sheet.setColumnWidths(1, 3, 150);  // nom, prenom, nombre_adulte
        sheet.setColumnWidth(4, 100);      // nombre_enfant
        sheet.setColumnWidth(5, 250);      // adresse
        sheet.setColumnWidths(6, 2, 100);  // code_postal, ville
        sheet.setColumnWidths(8, 2, 150);  // telephone, telephone_bis
        sheet.setColumnWidth(10, 150);     // email
        sheet.setColumnWidths(11, 3, 200); // circonstances, ressentit, specificites
        sheet.setColumnWidth(14, 80);      // criticite
        sheet.setColumnWidth(15, 300);     // commentaire

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

/**
 * Export family data to Bulk Update sheet for easy editing
 * @param {Array} familyIds - Optional array of family IDs to export (exports all if not provided)
 */
function exportFamiliesToBulkUpdate(familyIds = null) {
    const familySheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    const bulkSheet = getOrCreateBulkUpdateSheet();

    if (!familySheet) {
        SpreadsheetApp.getUi().alert('❌ Feuille Famille introuvable');
        return;
    }

    const data = familySheet.getDataRange().getValues();
    const exportData = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const familyId = row[OUTPUT_COLUMNS.ID];

        // Skip if filtering by IDs and this ID is not in the list
        if (familyIds && !familyIds.includes(familyId)) {
            continue;
        }

        // Skip non-validated families
        if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] !== CONFIG.STATUS.VALIDATED) {
            continue;
        }

        // Parse address
        const fullAddress = row[OUTPUT_COLUMNS.ADRESSE] || '';
        const addressParts = fullAddress.split(',');
        const address = addressParts[0] ? addressParts[0].trim() : '';
        const postalCode = addressParts[1] ? addressParts[1].trim() : '';
        const city = addressParts[2] ? addressParts[2].trim() : '';

        exportData.push([
            familyId,                                    // id
            row[OUTPUT_COLUMNS.NOM],                     // nom
            row[OUTPUT_COLUMNS.PRENOM],                  // prenom
            row[OUTPUT_COLUMNS.NOMBRE_ADULTE],           // nombre_adulte
            row[OUTPUT_COLUMNS.NOMBRE_ENFANT],           // nombre_enfant
            address,                                     // adresse
            postalCode,                                  // code_postal
            city,                                        // ville
            row[OUTPUT_COLUMNS.TELEPHONE],               // telephone
            row[OUTPUT_COLUMNS.TELEPHONE_BIS],           // telephone_bis
            row[OUTPUT_COLUMNS.EMAIL],                   // email
            row[OUTPUT_COLUMNS.CIRCONSTANCES],           // circonstances
            row[OUTPUT_COLUMNS.RESSENTIT],               // ressentit
            row[OUTPUT_COLUMNS.SPECIFICITES],            // specificites
            row[OUTPUT_COLUMNS.CRITICITE],               // criticite
            ''                                           // commentaire (empty for manual input)
        ]);
    }

    if (exportData.length === 0) {
        SpreadsheetApp.getUi().alert('⚠️ Aucune famille à exporter');
        return;
    }

    // Clear existing data (keep headers and instructions)
    const lastRow = bulkSheet.getLastRow();
    if (lastRow > 3) {
        bulkSheet.deleteRows(4, lastRow - 3);
    }

    // Write exported data starting from row 4
    bulkSheet.getRange(4, 1, exportData.length, exportData[0].length).setValues(exportData);

    SpreadsheetApp.getUi().alert(
        `✅ Export réussi`,
        `${exportData.length} familles exportées vers la feuille "Bulk Update".\n\nVous pouvez maintenant modifier les données et utiliser "Traiter Mises à Jour" dans le menu.`,
        SpreadsheetApp.getUi().ButtonSet.OK
    );

    logInfo(`📤 ${exportData.length} familles exportées vers Bulk Update`);
}

/**
 * Menu function to export validated families to Bulk Update sheet
 */
function exportValidatedFamiliesToBulkUpdate() {
    exportFamiliesToBulkUpdate();
}

/**
 * Menu function to export families by criticite to Bulk Update sheet
 */
function exportFamiliesByCriticiteToUpdate() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(
        'Export par Criticité',
        'Entrez le niveau de criticité à exporter (0-5):',
        ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK) {
        return;
    }

    const criticite = parseInt(response.getResponseText());

    if (isNaN(criticite) || criticite < 0 || criticite > 5) {
        ui.alert('❌ Criticité invalide', 'La criticité doit être entre 0 et 5', ui.ButtonSet.OK);
        return;
    }

    const familySheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!familySheet) {
        ui.alert('❌ Feuille Famille introuvable');
        return;
    }

    const data = familySheet.getDataRange().getValues();
    const familyIds = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] === CONFIG.STATUS.VALIDATED &&
            parseInt(row[OUTPUT_COLUMNS.CRITICITE]) === criticite) {
            familyIds.push(row[OUTPUT_COLUMNS.ID]);
        }
    }

    if (familyIds.length === 0) {
        ui.alert('⚠️ Aucune famille trouvée', `Aucune famille validée avec criticité ${criticite}`, ui.ButtonSet.OK);
        return;
    }

    exportFamiliesToBulkUpdate(familyIds);
}

/**
 * Show bulk import statistics in a UI alert (called from menu)
 */
function showBulkImportStats() {
    const stats = getBulkImportStatistics();
    const remaining = stats.pending + stats.processing;

    const message = `
📊 Statistiques Import en Masse

Total de lignes: ${stats.total}
━━━━━━━━━━━━━━━━━━━━
⏳ En attente: ${stats.pending}
⚙️ En traitement: ${stats.processing}
✅ Réussies: ${stats.success}
❌ Erreurs: ${stats.error}

${remaining > 0 ? '\n💡 Cliquez sur "Traiter Import" pour continuer.' : ''}
${stats.processing > 0 ? '\n⚠️ Lignes "En cours" détectées. Utilisez "Réinitialiser Processing" si nécessaire.' : ''}
`;

    SpreadsheetApp.getUi().alert('Statistiques Import', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Show bulk update statistics in a UI alert (called from menu)
 */
function showBulkUpdateStats() {
    const stats = getBulkUpdateStatistics();
    const remaining = stats.pending + stats.processing;

    const message = `
📊 Statistiques Mise à Jour en Masse

Total de lignes: ${stats.total}
━━━━━━━━━━━━━━━━━━━━
⏳ En attente: ${stats.pending}
⚙️ En traitement: ${stats.processing}
✅ Réussies: ${stats.success}
❌ Erreurs: ${stats.error}

${remaining > 0 ? '\n💡 Cliquez sur "Traiter Mises à Jour" pour continuer.' : ''}
${stats.processing > 0 ? '\n⚠️ Lignes "En cours" détectées. Utilisez "Réinitialiser Processing" si nécessaire.' : ''}
`;

    SpreadsheetApp.getUi().alert('Statistiques Update', message, SpreadsheetApp.getUi().ButtonSet.OK);
}