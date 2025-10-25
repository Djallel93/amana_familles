/**
 * @file src/handlers/editHandler.js
 * @description Handle onEdit triggers for status changes
 */

/**
 * Handle edit events on Famille sheet
 */
function handleEdit(e) {
    try {
        const sheet = e.range.getSheet();

        if (sheet.getName() !== CONFIG.SHEETS.FAMILLE_CLEANED) {
            return;
        }

        const row = e.range.getRow();
        const col = e.range.getColumn();

        if (row === 1) return;

        if (col === OUTPUT_COLUMNS.ETAT_DOSSIER + 1) {
            const newStatus = e.value;

            if (newStatus === CONFIG.STATUS.VALIDATED) {
                processValidatedFamily(sheet, row);
            }
        }

    } catch (error) {
        logError('Edit handler failed', error);
    }
}

/**
 * Process family when status changes to "Validé"
 */
function processValidatedFamily(sheet, row) {
    try {
        logInfo(`Processing validated family at row ${row}`);

        const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

        const familyId = data[OUTPUT_COLUMNS.ID];
        const identityUrls = data[OUTPUT_COLUMNS.IDENTITE];
        const cafUrls = data[OUTPUT_COLUMNS.CAF];

        const identityIds = extractFileIds(identityUrls);
        const cafIds = extractFileIds(cafUrls);
        const resourceIds = [];

        if (identityIds.length > 0 || cafIds.length > 0 || resourceIds.length > 0) {
            const organized = organizeDocuments(familyId, identityIds, cafIds, resourceIds);

            if (organized.identity.length > 0) {
                sheet.getRange(row, OUTPUT_COLUMNS.IDENTITE + 1).setValue(
                    formatDocumentLinks(organized.identity)
                );
            }
            if (organized.caf.length > 0) {
                sheet.getRange(row, OUTPUT_COLUMNS.CAF + 1).setValue(
                    formatDocumentLinks(organized.caf)
                );
            }

            logInfo(`Documents organized for family: ${familyId}`);
        }

        const familyData = {
            id: familyId,
            nom: data[OUTPUT_COLUMNS.NOM],
            prenom: data[OUTPUT_COLUMNS.PRENOM],
            email: data[OUTPUT_COLUMNS.EMAIL],
            telephone: data[OUTPUT_COLUMNS.TELEPHONE],
            phoneBis: data[OUTPUT_COLUMNS.TELEPHONE_BIS],
            adresse: data[OUTPUT_COLUMNS.ADRESSE]
        };

        const contactResult = syncFamilyContact(familyData);

        if (contactResult.success) {
            logInfo(`Contact synced for family: ${familyId}`);

            const existingComment = data[OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';
            const newComment = `${existingComment}\nValidé et traité le ${new Date().toLocaleString('fr-FR')}`;
            sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);
        } else {
            logError(`Contact sync failed for family: ${familyId}`, contactResult.error);
        }

    } catch (error) {
        logError('Failed to process validated family', error);

        const comment = sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).getValue() || '';
        sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(
            comment + `\nErreur de traitement: ${error.toString()}`
        );
    }
}