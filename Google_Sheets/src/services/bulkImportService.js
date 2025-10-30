/**
 * @file src/services/bulkImportService.js
 * @description 📥 Gérer les imports en masse depuis une feuille de calcul
 */

/**
 * 📊 Traiter l'import en masse avec limite de batch
 */
function processBulkImport(batchSize = 10) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_IMPORT_SHEET_NAME);

    if (!sheet) {
        return {
            success: false,
            message: '❌ Feuille "Bulk Import" introuvable. Créez-la d\'abord via le menu.'
        };
    }

    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
        return {
            success: false,
            message: '⚠️ Aucune donnée à importer. Collez vos familles dans la feuille "Bulk Import".'
        };
    }

    // 📊 Récupérer toutes les données (sans colonne STATUT)
    const data = sheet.getRange(2, 1, lastRow - 1, 15).getValues();

    // 🔍 Trouver les lignes en attente (colonne COMMENTAIRE vide ou "En attente")
    const pendingRows = [];
    data.forEach((row, index) => {
        const comment = row[BULK_COLUMNS.COMMENTAIRE];
        if (!comment || comment === '' || comment === 'En attente') {
            pendingRows.push({ row: row, index: index + 2 });
        }
    });

    if (pendingRows.length === 0) {
        return {
            success: true,
            message: '✅ Toutes les lignes ont déjà été traitées.',
            processed: 0,
            remaining: 0
        };
    }

    // 🎯 Limiter au batch size
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

    logInfo(`📥 Traitement de ${rowsToProcess.length} familles (batch: ${batchSize})`);

    // 🔄 Traiter chaque ligne
    rowsToProcess.forEach(item => {
        const { row, index } = item;
        const rowNumber = index;

        try {
            // 🔄 Marquer comme en cours
            sheet.getRange(rowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue('⚙️ En cours...');
            SpreadsheetApp.flush();

            // 🔨 Traiter la famille
            const result = processBulkImportRow(row, sheet, rowNumber);

            if (result.success) {
                results.succeeded++;
                sheet.getRange(rowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(
                    `✅ Importé: ${result.familyId} - Criticité: ${result.criticite}`
                );
            } else {
                results.failed++;
                sheet.getRange(rowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(
                    `❌ Erreur: ${result.error}`
                );
                results.errors.push({ row: rowNumber, error: result.error });
            }

            results.processed++;

        } catch (error) {
            logError(`❌ Erreur ligne ${rowNumber}`, error);
            results.failed++;
            sheet.getRange(rowNumber, BULK_COLUMNS.COMMENTAIRE + 1).setValue(
                `❌ Erreur système: ${error.toString()}`
            );
            results.errors.push({ row: rowNumber, error: error.toString() });
        }
    });

    logInfo('✅ Import en masse terminé', results);

    // 📧 Notifier l'administrateur
    if (results.succeeded > 0 || results.failed > 0) {
        notifyAdmin(
            '📥 Import en masse terminé',
            `Traitées: ${results.processed}\nRéussies: ${results.succeeded}\nÉchecs: ${results.failed}\nRestantes: ${results.remaining}`
        );
    }

    return results;
}

/**
 * 🔨 Traiter une seule ligne d'import en masse
 */
function processBulkImportRow(row, sheet, rowNumber) {
    // 📋 Parser les données de la ligne
    const formData = {
        lastName: row[BULK_COLUMNS.NOM] || '',
        firstName: row[BULK_COLUMNS.PRENOM] || '',
        nombreAdulte: row[BULK_COLUMNS.NOMBRE_ADULTE] || 0,
        nombreEnfant: row[BULK_COLUMNS.NOMBRE_ENFANT] || 0,
        address: row[BULK_COLUMNS.ADRESSE] || '',
        postalCode: String(row[BULK_COLUMNS.CODE_POSTAL]) || '',
        city: row[BULK_COLUMNS.VILLE] || '',
        phone: String(row[BULK_COLUMNS.TELEPHONE]) || '',
        phoneBis: String(row[BULK_COLUMNS.TELEPHONE_BIS]) || '',
        email: row[BULK_COLUMNS.EMAIL] || '',
        circonstances: row[BULK_COLUMNS.CIRCONSTANCES] || '',
        ressentit: row[BULK_COLUMNS.RESSENTIT] || '',
        specificites: row[BULK_COLUMNS.SPECIFICITES] || '',
        criticite: row[BULK_COLUMNS.CRITICITE] || 0
    };

    // ⚠️ Valider la criticité
    const criticite = parseInt(formData.criticite);
    if (isNaN(criticite) || criticite < CONFIG.CRITICITE.MIN || criticite > CONFIG.CRITICITE.MAX) {
        return {
            success: false,
            error: `Criticité invalide (${formData.criticite}). Doit être entre ${CONFIG.CRITICITE.MIN} et ${CONFIG.CRITICITE.MAX}`
        };
    }

    // ✅ Valider les champs requis
    const fieldValidation = validateRequiredFields(formData);
    if (!fieldValidation.isValid) {
        return {
            success: false,
            error: fieldValidation.errors.join(', ')
        };
    }

    // 🏠 Valider l'adresse
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

    // 🔍 Vérifier les doublons
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

    // 🆔 Créer l'enregistrement de famille
    const familyId = writeToFamilySheet(formData, {
        status: CONFIG.STATUS.VALIDATED,
        familyId: generateFamilyId(),
        quartierId: addressValidation.quartierId,
        quartierName: addressValidation.quartierName,
        criticite: criticite
    });

    // 📇 Synchroniser avec les contacts
    const contactData = {
        id: familyId,
        nom: formData.lastName,
        prenom: formData.firstName,
        email: formData.email,
        telephone: formData.phone,
        phoneBis: formData.phoneBis,
        adresse: `${formData.address}, ${formData.postalCode} ${formData.city}`
    };

    syncFamilyContact(contactData);

    return {
        success: true,
        familyId: familyId,
        criticite: criticite
    };
}

/**
 * 🗑️ Effacer toutes les données de la feuille Bulk Import (garder les en-têtes)
 */
function clearBulkImportSheet() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_IMPORT_SHEET_NAME);

    if (!sheet) {
        return {
            success: false,
            message: '❌ Feuille "Bulk Import" introuvable'
        };
    }

    const lastRow = sheet.getLastRow();

    if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
        logInfo('🗑️ Feuille Bulk Import effacée');
        return {
            success: true,
            message: `✅ ${lastRow - 1} lignes supprimées`
        };
    }

    return {
        success: true,
        message: '✅ La feuille est déjà vide'
    };
}

/**
 * 📊 Obtenir les statistiques d'import en masse
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
    if (lastRow <= 1) {
        return {
            total: 0,
            pending: 0,
            processing: 0,
            success: 0,
            error: 0
        };
    }

    const data = sheet.getRange(2, BULK_COLUMNS.COMMENTAIRE + 1, lastRow - 1, 1).getValues();

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
        } else if (comment.includes('✅') || comment.includes('Importé')) {
            stats.success++;
        } else if (comment.includes('❌') || comment.includes('Erreur')) {
            stats.error++;
        }
    });

    return stats;
}

/**
 * 🔄 Réinitialiser le statut "En cours" en "En attente" (en cas de timeout)
 */
function resetProcessingStatus() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_IMPORT_SHEET_NAME);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    const data = sheet.getRange(2, BULK_COLUMNS.COMMENTAIRE + 1, lastRow - 1, 1).getValues();

    let resetCount = 0;
    data.forEach((row, index) => {
        if (row[0] && row[0].includes('En cours')) {
            sheet.getRange(index + 2, BULK_COLUMNS.COMMENTAIRE + 1).setValue(
                'En attente (réinitialisé après timeout)'
            );
            resetCount++;
        }
    });

    if (resetCount > 0) {
        logInfo(`🔄 ${resetCount} lignes "En cours" réinitialisées en "En attente"`);
    }
}