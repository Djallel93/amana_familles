/**
 * @file src/handlers/editHandler.js (UPDATED)
 * @description Handle onEdit triggers with zakat/sadaqa validation requirements
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

        if (row === 1) return;

        if (col === OUTPUT_COLUMNS.ETAT_DOSSIER + 1) {
            const newStatus = e.value;
            const oldStatus = e.oldValue;

            if (newStatus === CONFIG.STATUS.ARCHIVED) {
                handleArchiveStatus(sheet, row);
                return;
            }

            if (newStatus === CONFIG.STATUS.VALIDATED) {
                const criticite = sheet.getRange(row, OUTPUT_COLUMNS.CRITICITE + 1).getValue();
                let quartierId = sheet.getRange(row, OUTPUT_COLUMNS.ID_QUARTIER + 1).getValue();

                // NEW: Get zakat and sadaqa values
                const zakatElFitr = sheet.getRange(row, OUTPUT_COLUMNS.ZAKAT_EL_FITR + 1).getValue();
                const sadaqa = sheet.getRange(row, OUTPUT_COLUMNS.SADAQA + 1).getValue();

                // VALIDATION 1: Check criticite
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

                // VALIDATION 2: Check zakat_el_fitr and sadaqa (NEW)
                if (zakatElFitr !== true && sadaqa !== true) {
                    const oldStatusValue = oldStatus || CONFIG.STATUS.IN_PROGRESS;
                    sheet.getRange(row, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).setValue(oldStatusValue);

                    SpreadsheetApp.getUi().alert(
                        '⚠️ Zakat El Fitr ou Sadaqa requis',
                        'Vous devez cocher au moins une des cases suivantes avant de valider:\n\n' +
                        '• Zakat El Fitr\n' +
                        '• Sadaqa\n\n' +
                        'Le statut a été rétabli à: ' + oldStatusValue,
                        SpreadsheetApp.getUi().ButtonSet.OK
                    );

                    logInfo(`Validation blocked for row ${row}: neither zakat nor sadaqa checked`);
                    return;
                }

                // VALIDATION 3: Check quartier (auto-resolve if missing)
                if (!quartierId) {
                    logInfo(`Attempting to auto-resolve quartier for row ${row}`);

                    const adresse = sheet.getRange(row, OUTPUT_COLUMNS.ADRESSE + 1).getValue();

                    if (!adresse) {
                        const oldStatusValue = oldStatus || CONFIG.STATUS.IN_PROGRESS;
                        sheet.getRange(row, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).setValue(oldStatusValue);

                        SpreadsheetApp.getUi().alert(
                            '⚠️ Quartier et adresse manquants',
                            'Le dossier ne peut pas être validé sans adresse.\n\n' +
                            'Le statut a été rétabli à: ' + oldStatusValue,
                            SpreadsheetApp.getUi().ButtonSet.OK
                        );

                        return;
                    }

                    const addressParts = adresse.split(',').map(p => p.trim());
                    const address = addressParts[0] || '';
                    const postalCode = addressParts[1] ? addressParts[1].match(/\d{5}/)?.[0] : '';
                    const city = addressParts[2] || addressParts[1]?.replace(/\d{5}/, '').trim() || '';

                    if (!address || !postalCode || !city) {
                        const oldStatusValue = oldStatus || CONFIG.STATUS.IN_PROGRESS;
                        sheet.getRange(row, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).setValue(oldStatusValue);

                        SpreadsheetApp.getUi().alert(
                            '⚠️ Adresse incomplète',
                            'Impossible de résoudre le quartier automatiquement.\n' +
                            'Adresse incomplète ou mal formatée.\n\n' +
                            'Format attendu: Adresse, Code Postal Ville\n\n' +
                            'Le statut a été rétabli à: ' + oldStatusValue,
                            SpreadsheetApp.getUi().ButtonSet.OK
                        );

                        return;
                    }

                    const addressValidation = validateAddressAndGetQuartier(address, postalCode, city);

                    if (!addressValidation.isValid || !addressValidation.quartierId) {
                        const oldStatusValue = oldStatus || CONFIG.STATUS.IN_PROGRESS;
                        sheet.getRange(row, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).setValue(oldStatusValue);

                        SpreadsheetApp.getUi().alert(
                            '⚠️ Quartier introuvable',
                            'Impossible de déterminer le quartier automatiquement.\n\n' +
                            `Adresse: ${address}, ${postalCode} ${city}\n\n` +
                            'Erreur: ' + (addressValidation.error || 'Aucun quartier trouvé') + '\n\n' +
                            'Le statut a été rétabli à: ' + oldStatusValue,
                            SpreadsheetApp.getUi().ButtonSet.OK
                        );

                        const existingComment = sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).getValue() || '';
                        const newComment = addComment(
                            existingComment,
                            formatComment('❌', `Tentative de validation échouée: ${addressValidation.error || 'Quartier introuvable'}`)
                        );
                        sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);

                        return;
                    }

                    quartierId = addressValidation.quartierId;
                    sheet.getRange(row, OUTPUT_COLUMNS.ID_QUARTIER + 1).setValue(quartierId);

                    logInfo(`Quartier auto-resolved: ${quartierId} (${addressValidation.quartierName})`);

                    const existingComment = sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).getValue() || '';
                    const newComment = addComment(
                        existingComment,
                        formatComment('✅', `Quartier résolu automatiquement: ${addressValidation.quartierName || quartierId}`)
                    );
                    sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);
                }

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
                    const newComment = addComment(
                        existingComment,
                        formatComment('❌', `Tentative de validation échouée: ${quartierValidation.error}`)
                    );
                    sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);

                    logInfo(`Validation blocked for row ${row}: ${quartierValidation.error}`);
                    return;
                }

                // All validations passed - process validated family
                processValidatedFamily(sheet, row);
            }
        }

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

        const deleteResult = deleteContactForArchivedFamily(familyId);

        const existingComment = data[OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';
        let newComment = formatComment('🗄️', 'Archivé');

        if (deleteResult.success) {
            newComment = addComment(newComment, formatComment('📞', 'Contact Google supprimé'));
            logInfo(`Contact deleted successfully for archived family: ${familyId}`);
        } else {
            newComment = addComment(newComment, formatComment('⚠️', `Échec suppression contact: ${deleteResult.error}`));
            logError(`Failed to delete contact for family: ${familyId}`, deleteResult.error);
        }

        const finalComment = addComment(existingComment, newComment);
        sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(finalComment);

        notifyAdmin(
            '🗄️ Famille archivée',
            `ID: ${familyId}\nNom: ${data[OUTPUT_COLUMNS.NOM]} ${data[OUTPUT_COLUMNS.PRENOM]}\nContact supprimé: ${deleteResult.success ? 'Oui' : 'Non'}`
        );

    } catch (error) {
        logError('Failed to process archive status', error);

        const comment = sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).getValue() || '';
        const newComment = addComment(comment, formatComment('❌', `Erreur archivage: ${error.toString()}`));
        sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);
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
        const aidesEtatUrls = data[OUTPUT_COLUMNS.AIDES_ETAT]; // UPDATED

        const identityIds = extractFileIds(identityUrls);
        const aidesEtatIds = extractFileIds(aidesEtatUrls); // UPDATED

        if (identityIds.length > 0 || aidesEtatIds.length > 0) {
            const organized = organizeDocuments(familyId, identityIds, aidesEtatIds, []);

            if (organized.identity.length > 0) {
                sheet.getRange(row, OUTPUT_COLUMNS.IDENTITE + 1).setValue(
                    formatDocumentLinks(organized.identity)
                );
            }
            if (organized.aidesEtat.length > 0) { // UPDATED
                sheet.getRange(row, OUTPUT_COLUMNS.AIDES_ETAT + 1).setValue(
                    formatDocumentLinks(organized.aidesEtat)
                );
            }

            logInfo(`Documents organized for family: ${familyId}`);
        }

        const rawPhone = String(data[OUTPUT_COLUMNS.TELEPHONE] || '');
        const rawPhoneBis = String(data[OUTPUT_COLUMNS.TELEPHONE_BIS] || '');

        const familyData = {
            id: familyId,
            nom: data[OUTPUT_COLUMNS.NOM],
            prenom: data[OUTPUT_COLUMNS.PRENOM],
            email: data[OUTPUT_COLUMNS.EMAIL],
            telephone: rawPhone,
            phoneBis: rawPhoneBis,
            adresse: data[OUTPUT_COLUMNS.ADRESSE],
            idQuartier: data[OUTPUT_COLUMNS.ID_QUARTIER]
        };

        const contactResult = syncFamilyContact(familyData);

        const existingComment = data[OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';
        let newComment;

        if (contactResult.success) {
            logInfo(`Contact synced for family: ${familyId}`);
            newComment = addComment(existingComment, formatComment('✅', 'Validé et traité'));
        } else {
            logError(`Contact sync failed for family: ${familyId}`, contactResult.error);
            newComment = addComment(existingComment, formatComment('⚠️', `Erreur création contact: ${contactResult.error}`));
        }

        sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);

    } catch (error) {
        logError('Failed to process validated family', error);

        const comment = sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).getValue() || '';
        const newComment = addComment(comment, formatComment('❌', `Erreur de traitement: ${error.toString()}`));
        sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);
    }
}