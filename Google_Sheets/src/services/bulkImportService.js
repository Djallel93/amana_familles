/**
 * @file src/ui/bulkSheetSetup.js
 * @description Functions to create and configure Bulk Import and Bulk Update sheets
 */

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
        
        sheet.getRange('N2:N1000').setDataValidation(criticiteRule);

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
 * Get or create Bulk Update sheet with proper headers
 */
function getOrCreateBulkUpdateSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(BULK_UPDATE_SHEET_NAME);

    if (!sheet) {
        sheet = ss.insertSheet(BULK_UPDATE_SHEET_NAME);
        
        // Set headers
        const headers = [
            'id',
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
        headerRange.setBackground('#ff9800');
        headerRange.setFontColor('#ffffff');
        headerRange.setFontWeight('bold');
        headerRange.setHorizontalAlignment('center');

        // Freeze header row
        sheet.setFrozenRows(1);

        // Set column widths
        sheet.setColumnWidth(1, 100);      // id
        sheet.setColumnWidths(2, 3, 150);  // nom, prenom, nombre_adulte
        sheet.setColumnWidth(5, 100);      // nombre_enfant
        sheet.setColumnWidth(6, 250);      // adresse
        sheet.setColumnWidths(7, 2, 100);  // code_postal, ville
        sheet.setColumnWidths(9, 2, 150);  // telephone, telephone_bis
        sheet.setColumnWidth(11, 150);     // email
        sheet.setColumnWidths(12, 3, 200); // circonstances, ressentit, specificites
        sheet.setColumnWidth(15, 80);      // criticite
        sheet.setColumnWidth(16, 300);     // commentaire

        // Add data validation for criticite
        const criticiteRule = SpreadsheetApp.newDataValidation()
            .requireNumberBetween(0, 5)
            .setAllowInvalid(false)
            .setHelpText('Criticité doit être entre 0 et 5')
            .build();
        
        sheet.getRange('O2:O1000').setDataValidation(criticiteRule);

        // Add instructions in row 2
        const instructions = [
            'ID Famille (OBLIGATOIRE)',
            'Nom de famille',
            'Prénom',
            'Nombre d\'adultes',
            'Nombre d\'enfants',
            'Adresse complète',
            'Code postal',
            'Ville',
            'Téléphone',
            'Téléphone secondaire',
            'Email',
            'Circonstances',
            'Ressentit',
            'Spécificités',
            'Criticité 0-5',
            'Commentaire/Statut (auto)'
        ];

        sheet.getRange(2, 1, 1, instructions.length).setValues([instructions]);
        sheet.getRange(2, 1, 1, instructions.length)
            .setFontStyle('italic')
            .setFontColor('#666666')
            .setBackground('#fff3cd');

        // Important note in row 3
        const note = [
            '⚠️ IMPORTANT: Seules les colonnes non vides seront mises à jour. L\'ID est obligatoire, au moins une autre colonne doit contenir une valeur.',
            '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
        ];

        sheet.getRange(3, 1, 1, note.length).setValues([note]);
        sheet.getRange(3, 1, 1, note.length)
            .setFontWeight('bold')
            .setFontColor('#856404')
            .setBackground('#fff3cd')
            .merge();

        logInfo('✅ Feuille Bulk Update créée avec succès');
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