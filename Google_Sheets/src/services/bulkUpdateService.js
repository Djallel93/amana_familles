/**
 * @file src/services/bulkUpdateService.js
 * @description ✏️ Gérer les mises à jour en masse depuis une feuille de calcul
 */

/**
 * 📊 Traiter les mises à jour en masse avec limite de batch
 */
function processBulkUpdate(batchSize = 10) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_UPDATE_SHEET_NAME);

    if (!sheet) {
        return {
            success: false,
            message: '❌ Feuille "Bulk Update" introuvable. Créez-la d\'abord via le menu.'
        };
    }

    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
        return {
            success: false,
            message: '⚠️ Aucune donnée à traiter. Collez vos mises à jour dans la feuille "Bulk Update".'
        };
    }

    // 📊 Récupérer toutes les données (sans colonne STATUT)
    const data = sheet.getRange(2, 1, lastRow - 1, 16).getValues();

    // 🔍 Trouver les lignes en attente
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

    logInfo(`✏️ Traitement de ${rowsToProcess.length} mises à jour (batch: ${batchSize})`);

    // 🔄 Traiter chaque ligne
    rowsToProcess.forEach(item => {
        const { row, index } = item;
        const rowNumber = index;

        try {
            // 🔄 Marquer comme en cours
            sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue('⚙️ En cours...');
            SpreadsheetApp.flush();

            // 🔨 Traiter la mise à jour
            const result = processBulkUpdateRow(row, sheet, rowNumber);

            if (result.success) {
                results.succeeded++;
                sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(
                    `✅ Mis à jour: ${result.updatedFields.join(', ')}`
                );
            } else {
                results.failed++;
                sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(
                    `❌ Erreur: ${result.error}`
                );
                results.errors.push({ row: rowNumber, error: result.error });
            }

            results.processed++;

        } catch (error) {
            logError(`❌ Erreur ligne ${rowNumber}`, error);
            results.failed++;
            sheet.getRange(rowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(
                `❌ Erreur système: ${error.toString()}`
            );
            results.errors.push({ row: rowNumber, error: error.toString() });
        }
    });

    logInfo('✅ Mise à jour en masse terminée', results);

    // 📧 Notifier l'administrateur
    if (results.succeeded > 0 || results.failed > 0) {
        notifyAdmin(
            '✏️ Mise à jour en masse terminée',
            `Traitées: ${results.processed}\nRéussies: ${results.succeeded}\nÉchecs: ${results.failed}\nRestantes: ${results.remaining}`
        );
    }

    return results;
}

/**
 * 🔨 Traiter une seule ligne de mise à jour en masse
 */
function processBulkUpdateRow(row, sheet, rowNumber) {
    const familyId = row[BULK_UPDATE_COLUMNS.ID];

    // ✅ Valider que l'ID est fourni
    if (!familyId) {
        return {
            success: false,
            error: 'ID famille obligatoire'
        };
    }

    // 🔨 Construire les données de mise à jour (uniquement les champs non vides)
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

    // ⚠️ Vérifier qu'au moins un champ est à mettre à jour
    if (updatedFields.length === 0) {
        return {
            success: false,
            error: 'Au moins un champ doit être renseigné pour la mise à jour'
        };
    }

    // 🔄 Mettre à jour la famille
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
 * 🗑️ Effacer toutes les données de la feuille Bulk Update (garder les en-têtes)
 */
function clearBulkUpdateSheet() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_UPDATE_SHEET_NAME);

    if (!sheet) {
        return {
            success: false,
            message: '❌ Feuille "Bulk Update" introuvable'
        };
    }

    const lastRow = sheet.getLastRow();

    if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
        logInfo('🗑️ Feuille Bulk Update effacée');
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
 * 📊 Obtenir les statistiques de mise à jour en masse
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
 * 🔄 Réinitialiser le statut "En cours" en "En attente"
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
                'En attente (réinitialisé après timeout)'
            );
            resetCount++;
        }
    });

    if (resetCount > 0) {
        logInfo(`🔄 ${resetCount} lignes "En cours" réinitialisées dans Bulk Update`);
    }
}