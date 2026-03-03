function processBulkUpdateRow(row, sheet, sheetRowNumber) {
    const familyId = row[BULK_UPDATE_COLUMNS.ID];

    if (!familyId) {
        return { success: false, error: 'ID famille obligatoire' };
    }

    const updateData = {};
    const updatedFields = [];

    if (row[BULK_UPDATE_COLUMNS.NOM]) { updateData.lastName = row[BULK_UPDATE_COLUMNS.NOM]; updatedFields.push('nom'); }
    if (row[BULK_UPDATE_COLUMNS.PRENOM]) { updateData.firstName = row[BULK_UPDATE_COLUMNS.PRENOM]; updatedFields.push('prenom'); }
    if (row[BULK_UPDATE_COLUMNS.NOMBRE_ADULTE] !== '' && row[BULK_UPDATE_COLUMNS.NOMBRE_ADULTE] !== null) { updateData.nombreAdulte = parseInt(row[BULK_UPDATE_COLUMNS.NOMBRE_ADULTE]); updatedFields.push('nombre_adulte'); }
    if (row[BULK_UPDATE_COLUMNS.NOMBRE_ENFANT] !== '' && row[BULK_UPDATE_COLUMNS.NOMBRE_ENFANT] !== null) { updateData.nombreEnfant = parseInt(row[BULK_UPDATE_COLUMNS.NOMBRE_ENFANT]); updatedFields.push('nombre_enfant'); }
    if (row[BULK_UPDATE_COLUMNS.ADRESSE]) { updateData.address = row[BULK_UPDATE_COLUMNS.ADRESSE]; updatedFields.push('adresse'); }
    if (row[BULK_UPDATE_COLUMNS.CODE_POSTAL]) { updateData.postalCode = String(row[BULK_UPDATE_COLUMNS.CODE_POSTAL]); updatedFields.push('code_postal'); }
    if (row[BULK_UPDATE_COLUMNS.VILLE]) { updateData.city = row[BULK_UPDATE_COLUMNS.VILLE]; updatedFields.push('ville'); }
    if (row[BULK_UPDATE_COLUMNS.TELEPHONE]) { updateData.phone = String(row[BULK_UPDATE_COLUMNS.TELEPHONE]); updatedFields.push('telephone'); }
    if (row[BULK_UPDATE_COLUMNS.TELEPHONE_BIS]) { updateData.phoneBis = String(row[BULK_UPDATE_COLUMNS.TELEPHONE_BIS]); updatedFields.push('telephone_bis'); }
    if (row[BULK_UPDATE_COLUMNS.EMAIL]) { updateData.email = row[BULK_UPDATE_COLUMNS.EMAIL]; updatedFields.push('email'); }
    if (row[BULK_UPDATE_COLUMNS.SE_DEPLACE] !== '' && row[BULK_UPDATE_COLUMNS.SE_DEPLACE] !== null) { updateData.seDeplace = parseSeDeplace(row[BULK_UPDATE_COLUMNS.SE_DEPLACE]); updatedFields.push('se_deplace'); }
    if (row[BULK_UPDATE_COLUMNS.CIRCONSTANCES]) { updateData.circonstances = row[BULK_UPDATE_COLUMNS.CIRCONSTANCES]; updatedFields.push('circonstances'); }
    if (row[BULK_UPDATE_COLUMNS.RESSENTIT]) { updateData.ressentit = row[BULK_UPDATE_COLUMNS.RESSENTIT]; updatedFields.push('ressentit'); }
    if (row[BULK_UPDATE_COLUMNS.SPECIFICITES]) { updateData.specificites = row[BULK_UPDATE_COLUMNS.SPECIFICITES]; updatedFields.push('specificites'); }
    if (row[BULK_UPDATE_COLUMNS.CRITICITE] !== '' && row[BULK_UPDATE_COLUMNS.CRITICITE] !== null) { updateData.criticite = parseInt(row[BULK_UPDATE_COLUMNS.CRITICITE]); updatedFields.push('criticite'); }
    if (row[BULK_UPDATE_COLUMNS.LANGUE]) { updateData.langue = row[BULK_UPDATE_COLUMNS.LANGUE]; updatedFields.push('langue'); }

    if (updatedFields.length === 0) {
        return { success: false, error: 'Au moins un champ doit être renseigné' };
    }

    updateData.forceInProgress = true;

    const result = updateFamilyById(familyId, updateData);

    if (result.success) {
        return { success: true, updatedFields: updatedFields, quartierWarning: result.quartierWarning };
    } else {
        return { success: false, error: result.error };
    }
}

function processBulkUpdate(batchSize = 10) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_UPDATE_SHEET_NAME);

    if (!sheet) {
        return { success: false, message: '❌ Feuille "Bulk Update" introuvable. Créez-la via le menu.' };
    }

    const lastRow = sheet.getLastRow();
    const FIRST_DATA_ROW = 2;

    if (lastRow < FIRST_DATA_ROW) {
        return { success: false, message: '⚠️ Aucune donnée à traiter. Collez vos données à partir de la ligne 2.' };
    }

    const numDataRows = lastRow - FIRST_DATA_ROW + 1;
    const data = sheet.getRange(FIRST_DATA_ROW, 1, numDataRows, 18).getValues();
    const comments = sheet.getRange(FIRST_DATA_ROW, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1, numDataRows, 1).getValues();

    logInfo(`Bulk Update: lastRow=${lastRow}, numDataRows=${numDataRows}`);

    const pendingRows = [];
    data.forEach((row, arrayIndex) => {
        const comment = comments[arrayIndex][0];
        const sheetRowNumber = FIRST_DATA_ROW + arrayIndex;
        if (!comment || comment === '' || comment === 'En attente' || comment.includes('En cours...')) {
            pendingRows.push({ row, sheetRowNumber, arrayIndex });
        }
    });

    if (pendingRows.length === 0) {
        return { success: true, message: '✅ Toutes les lignes ont déjà été traitées.', processed: 0, succeeded: 0, failed: 0, remaining: 0, errors: [] };
    }

    const rowsToProcess = pendingRows.slice(0, batchSize);
    const results = { success: true, processed: 0, succeeded: 0, failed: 0, skipped: 0, remaining: pendingRows.length - rowsToProcess.length, errors: [] };

    rowsToProcess.forEach(item => {
        const { row, sheetRowNumber } = item;
        try {
            sheet.getRange(sheetRowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue('⚙️ En cours...');
            SpreadsheetApp.flush();

            const result = processBulkUpdateRow(row, sheet, sheetRowNumber);

            if (result.success) {
                results.succeeded++;
                let comment = `✅ Mis à jour: ${result.updatedFields.join(', ')}`;
                if (result.quartierWarning) comment += `\n${result.quartierWarning}`;
                sheet.getRange(sheetRowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(comment);
            } else {
                results.failed++;
                sheet.getRange(sheetRowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(`❌ Erreur: ${result.error}`);
                results.errors.push({ row: sheetRowNumber, error: result.error });
            }

            results.processed++;
        } catch (error) {
            logError(`Erreur ligne ${sheetRowNumber}`, error);
            results.failed++;
            sheet.getRange(sheetRowNumber, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue(`❌ Erreur système: ${error.toString()}`);
            results.errors.push({ row: sheetRowNumber, error: error.toString() });
        }
    });

    if (results.succeeded > 0 || results.failed > 0) {
        notifyAdmin(
            '✏️ Bulk Update Terminé',
            `Traités: ${results.processed}\nRéussis: ${results.succeeded}\nÉchecs: ${results.failed}\nRestants: ${results.remaining}`
        );
    }

    return results;
}

function clearBulkUpdateSheet() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_UPDATE_SHEET_NAME);
    if (!sheet) return { success: false, message: '❌ Feuille "Bulk Update" introuvable' };

    const lastRow = sheet.getLastRow();
    const FIRST_DATA_ROW = 2;

    if (lastRow >= FIRST_DATA_ROW) {
        sheet.deleteRows(FIRST_DATA_ROW, lastRow - FIRST_DATA_ROW + 1);
        return { success: true, message: `✅ ${lastRow - FIRST_DATA_ROW + 1} lignes supprimées` };
    }

    return { success: true, message: '✅ Feuille déjà vide' };
}

function getBulkUpdateStatistics() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_UPDATE_SHEET_NAME);
    if (!sheet) return { total: 0, pending: 0, processing: 0, success: 0, error: 0 };

    const lastRow = sheet.getLastRow();
    const FIRST_DATA_ROW = 2;
    if (lastRow < FIRST_DATA_ROW) return { total: 0, pending: 0, processing: 0, success: 0, error: 0 };

    const numDataRows = lastRow - FIRST_DATA_ROW + 1;
    const data = sheet.getRange(FIRST_DATA_ROW, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1, numDataRows, 1).getValues();

    const stats = { total: numDataRows, pending: 0, processing: 0, success: 0, error: 0 };

    data.forEach(row => {
        const comment = row[0];
        if (!comment || comment === '' || comment === 'En attente') stats.pending++;
        else if (comment.includes('En cours')) stats.processing++;
        else if (comment.includes('✅') || comment.includes('Mis à jour')) stats.success++;
        else if (comment.includes('❌') || comment.includes('Erreur')) stats.error++;
    });

    return stats;
}

function resetUpdateProcessingStatus() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BULK_UPDATE_SHEET_NAME);
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    const FIRST_DATA_ROW = 2;
    if (lastRow < FIRST_DATA_ROW) return;

    const numDataRows = lastRow - FIRST_DATA_ROW + 1;
    const data = sheet.getRange(FIRST_DATA_ROW, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1, numDataRows, 1).getValues();

    let resetCount = 0;
    data.forEach((row, arrayIndex) => {
        if (row[0] && row[0].includes('En cours')) {
            sheet.getRange(FIRST_DATA_ROW + arrayIndex, BULK_UPDATE_COLUMNS.COMMENTAIRE + 1).setValue('En attente (reset after timeout)');
            resetCount++;
        }
    });

    if (resetCount > 0) logInfo(`${resetCount} lignes "Processing" réinitialisées`);
}