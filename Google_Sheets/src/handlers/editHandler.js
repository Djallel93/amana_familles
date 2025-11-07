/**
 * @file src/handlers/editHandler.js (ENHANCED)
 * @description Handle onEdit triggers with quartier validation and archive contact deletion
 */

/**
 * Handle edit events on Famille sheet
 */
function handleEdit(e) {
    try {
        const sheet = e.range.getSheet();

        if (sheet.getName() !== CONFIG.SHEETS.FAMILLE) {
            return;
        }

        const row = e.range.getRow();
        const col = e.range.getColumn();

        if (row === 1) return; // Header row

        // Check if status column was edited
        if (col === OUTPUT_COLUMNS.ETAT_DOSSIER + 1) {
            const newStatus = e.value;
            const oldStatus = e.oldValue;

            // Handle status change to "Archivé" - delete contact
            if (newStatus === CONFIG.STATUS.ARCHIVED) {
                handleArchiveStatus(sheet, row);
                return;
            }

            // Validate before allowing status change to "Validé"
            if (newStatus === CONFIG.STATUS.VALIDATED) {
                const criticite = sheet.getRange(row, OUTPUT_COLUMNS.CRITICITE + 1).getValue();
                const quartierId = sheet.getRange(row, OUTPUT_COLUMNS.ID_QUARTIER + 1).getValue();

                // Check if criticite is 0 or empty
                if (!criticite || criticite === 0) {
                    const oldStatusValue = oldStatus || CONFIG.STATUS.IN_PROGRESS;
                    sheet.getRange(row, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).setValue(oldStatusValue);

                    SpreadsheetApp.getUi().alert(
                        '⚠️ Criticité non définie',
                        'Vous devez définir une criticité (1-5) avant de valider le dossier.\n\n' +
                        'La criticité permet de prioriser les familles lors des livraisons.\n\n' +
                        'Le statut a été rétabli à: ' + oldStatusValue,
                        SpreadsheetApp.getUi().ButtonSet.OK
                    );

                    logInfo(`Validation blocked for row ${row}: criticite not set`);
                    return;
                }

                // Validate criticite range
                if (criticite < CONFIG.CRITICITE.MIN || criticite > CONFIG.CRITICITE.MAX) {
                    const oldStatusValue = oldStatus || CONFIG.STATUS.IN_PROGRESS;
                    sheet.getRange(row, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).setValue(oldStatusValue);

                    SpreadsheetApp.getUi().alert(
                        '⚠️ Criticité invalide',
                        `La criticité doit être entre ${CONFIG.CRITICITE.MIN} et ${CONFIG.CRITICITE.MAX}.\n\n` +
                        'Le statut a été rétabli à: ' + oldStatusValue,
                        SpreadsheetApp.getUi().ButtonSet.OK
                    );

                    logInfo(`Validation blocked for row ${row}: invalid criticite ${criticite}`);
                    return;
                }

                // Validate quartier ID exists in GEO API
                if (!quartierId) {
                    const oldStatusValue = oldStatus || CONFIG.STATUS.IN_PROGRESS;
                    sheet.getRange(row, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).setValue(oldStatusValue);

                    SpreadsheetApp.getUi().alert(
                        '⚠️ Quartier manquant',
                        'Le dossier ne peut pas être validé sans un ID Quartier valide.\n\n' +
                        'Le statut a été rétabli à: ' + oldStatusValue,
                        SpreadsheetApp.getUi().ButtonSet.OK
                    );

                    const existingComment = sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).getValue() || '';
                    const newComment = existingComment +
                        `\n⚠️ Tentative de validation échouée: Quartier ID manquant - ${new Date().toLocaleString('fr-FR')}`;
                    sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);

                    logInfo(`Validation blocked for row ${row}: quartier ID missing`);
                    return;
                }

                // Validate quartier exists in GEO API
                const quartierValidation = validateQuartierId(quartierId);

                if (!quartierValidation.isValid) {
                    const oldStatusValue = oldStatus || CONFIG.STATUS.IN_PROGRESS;
                    sheet.getRange(row, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).setValue(oldStatusValue);

                    SpreadsheetApp.getUi().alert(
                        '⚠️ Quartier invalide',
                        `Le Quartier ID "${quartierId}" n'existe pas dans l'API GEO.\n\n` +
                        'Veuillez vérifier l\'adresse et régénérer le quartier.\n\n' +
                        'Le statut a été rétabli à: ' + oldStatusValue,
                        SpreadsheetApp.getUi().ButtonSet.OK
                    );

                    const existingComment = sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).getValue() || '';
                    const newComment = existingComment +
                        `\n⚠️ Tentative de validation échouée: ${quartierValidation.error} - ${new Date().toLocaleString('fr-FR')}`;
                    sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);

                    logInfo(`Validation blocked for row ${row}: ${quartierValidation.error}`);
                    return;
                }

                // Proceed with validation
                processValidatedFamily(sheet, row);
            }
        }

        // Validate criticite value when it's edited
        if (col === OUTPUT_COLUMNS.CRITICITE + 1) {
            const criticite = e.value;

            if (criticite !== '' && criticite !== null) {
                const numCriticite = parseInt(criticite);

                if (isNaN(numCriticite) || numCriticite < CONFIG.CRITICITE.MIN || numCriticite > CONFIG.CRITICITE.MAX) {
                    sheet.getRange(row, OUTPUT_COLUMNS.CRITICITE + 1).setValue(e.oldValue || 0);

                    SpreadsheetApp.getUi().alert(
                        '⚠️ Valeur invalide',
                        `La criticité doit être un nombre entier entre ${CONFIG.CRITICITE.MIN} et ${CONFIG.CRITICITE.MAX}.\n\n` +
                        'La valeur a été rétablie.',
                        SpreadsheetApp.getUi().ButtonSet.OK
                    );

                    return;
                }
            }
        }

    } catch (error) {
        logError('Edit handler failed', error);
    }
}

/**
 * Handle archive status - delete contact
 */
function handleArchiveStatus(sheet, row) {
    try {
        const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
        const familyId = data[OUTPUT_COLUMNS.ID];

        logInfo(`Processing archive for family ${familyId} at row ${row}`);

        // Delete contact from Google Contacts
        const deleteResult = deleteContactForArchivedFamily(familyId);

        // Add comment about archiving and contact deletion
        const existingComment = data[OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';
        let newComment = existingComment ?
            `${existingComment}\n🗄️ Archivé le ${new Date().toLocaleString('fr-FR')}` :
            `🗄️ Archivé le ${new Date().toLocaleString('fr-FR')}`;

        if (deleteResult.success) {
            newComment += `\n📞 Contact Google supprimé`;
            logInfo(`Contact deleted successfully for archived family: ${familyId}`);
        } else {
            newComment += `\n⚠️ Échec suppression contact: ${deleteResult.error}`;
            logError(`Failed to delete contact for family: ${familyId}`, deleteResult.error);
        }

        sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);

        // Notify admin
        notifyAdmin(
            '🗄️ Famille archivée',
            `ID: ${familyId}\nNom: ${data[OUTPUT_COLUMNS.NOM]} ${data[OUTPUT_COLUMNS.PRENOM]}\nContact supprimé: ${deleteResult.success ? 'Oui' : 'Non'}`
        );

    } catch (error) {
        logError('Failed to process archive status', error);

        const comment = sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).getValue() || '';
        sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(
            comment + `\n❌ Erreur archivage: ${error.toString()}`
        );
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

        if (identityIds.length > 0 || cafIds.length > 0) {
            const organized = organizeDocuments(familyId, identityIds, cafIds, []);

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
            adresse: data[OUTPUT_COLUMNS.ADRESSE],
            idQuartier: data[OUTPUT_COLUMNS.ID_QUARTIER]
        };

        const contactResult = syncFamilyContact(familyData);

        if (contactResult.success) {
            logInfo(`Contact synced for family: ${familyId}`);

            const existingComment = data[OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';
            const newComment = existingComment ?
                `${existingComment}\n✅ Validé et traité le ${new Date().toLocaleString('fr-FR')}` :
                `✅ Validé et traité le ${new Date().toLocaleString('fr-FR')}`;
            sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);
        } else {
            logError(`Contact sync failed for family: ${familyId}`, contactResult.error);
        }

    } catch (error) {
        logError('Failed to process validated family', error);

        const comment = sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).getValue() || '';
        sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(
            comment + `\n❌ Erreur de traitement: ${error.toString()}`
        );
    }
}