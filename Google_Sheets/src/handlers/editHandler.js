/**
 * @file src/handlers/editHandler.js
 * @description Handle onEdit triggers with household validation + Archive/Reject contact handling
 */

function onEditHandler(e) {
    try {
        const sheet = e.range.getSheet();

        if (sheet.getName() !== CONFIG.SHEETS.FAMILLE) {
            logInfo(`L'edition ignorée sur la feuille: ${sheet.getName()}`);
            return;
        }

        const row = e.range.getRow();
        const col = e.range.getColumn();

        logInfo(`Edition détectée à la ligne ${row}, colonne ${col}`);
        if (row === 1) return;

        const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
        const familyId = safeGetColumn(data, OUTPUT_COLUMNS.ID);

        logInfo(`Processing family ${familyId} at row ${row}...`);

        if (col === OUTPUT_COLUMNS.NOMBRE_ADULTE + 1 || col === OUTPUT_COLUMNS.NOMBRE_ENFANT + 1) {
            handleHouseholdCompositionEdit(sheet, row, col, e);
            return;
        }

        if (col === OUTPUT_COLUMNS.ETAT_DOSSIER + 1) {
            const newStatus = e.value;
            const oldStatus = e.oldValue;

            if (newStatus === CONFIG.STATUS.ARCHIVED) {
                handleArchiveStatus(sheet, row);
                return;
            }

            if (newStatus === CONFIG.STATUS.REJECTED) {
                handleRejectedStatus(sheet, row);
                return;
            }

            if (newStatus === CONFIG.STATUS.VALIDATED) {
                const criticite = safeGetColumn(data, OUTPUT_COLUMNS.CRITICITE);
                let quartierId = safeGetColumn(data, OUTPUT_COLUMNS.ID_QUARTIER);

                const zakatElFitr = safeGetColumn(data, OUTPUT_COLUMNS.ZAKAT_EL_FITR);
                const sadaqa = safeGetColumn(data, OUTPUT_COLUMNS.SADAQA);

                const nombreAdulte = parseInt(safeGetColumn(data, OUTPUT_COLUMNS.NOMBRE_ADULTE, 0)) || 0;
                const nombreEnfant = parseInt(safeGetColumn(data, OUTPUT_COLUMNS.NOMBRE_ENFANT, 0)) || 0;

                const householdValidation = validateHouseholdComposition(nombreAdulte, nombreEnfant);
                if (!householdValidation.isValid) {
                    const oldStatusValue = oldStatus || CONFIG.STATUS.IN_PROGRESS;
                    sheet.getRange(row, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).setValue(oldStatusValue);

                    SpreadsheetApp.getUi().alert(
                        '⚠️ Composition du foyer invalide',
                        householdValidation.error + '\n\n' +
                        'Le statut a été rétabli à: ' + oldStatusValue,
                        SpreadsheetApp.getUi().ButtonSet.OK
                    );

                    logInfo(`Validation blocked for row ${row}: ${householdValidation.error}`);
                    return;
                }

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

                if (!quartierId) {
                    logInfo(`Attempting to auto-resolve quartier for row ${row}`);

                    const adresse = safeGetColumn(data, OUTPUT_COLUMNS.ADRESSE);

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

                    const addressParts = parseAddressComponents(adresse);
                    const address = addressParts.street || '';
                    const postalCode = addressParts.postalCode || '';
                    const city = addressParts.city || '';

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
                        appendSheetComment(
                            sheet,
                            row,
                            '❌',
                            `Tentative de validation échouée: ${addressValidation.error || 'Quartier introuvable'}`
                        );
                        return;
                    }

                    quartierId = addressValidation.quartierId;
                    sheet.getRange(row, OUTPUT_COLUMNS.ID_QUARTIER + 1).setValue(quartierId);

                    logInfo(`Quartier auto-resolved: ${quartierId} (${addressValidation.quartierName})`);
                    appendSheetComment(
                        sheet,
                        row,
                        '✅',
                        `Quartier résolu automatiquement: ${addressValidation.quartierName || quartierId}`
                    );
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

                    appendSheetComment(
                        sheet,
                        row,
                        '❌',
                        `Tentative de validation échouée: ${quartierValidation.error}`
                    );

                    logInfo(`Validation blocked for row ${row}: ${quartierValidation.error}`);
                    return;
                }

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

function handleHouseholdCompositionEdit(sheet, row, col, e) {
    try {
        const newValue = parseInt(e.value) || 0;
        const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

        let nombreAdulte, nombreEnfant;

        if (col === OUTPUT_COLUMNS.NOMBRE_ADULTE + 1) {
            nombreAdulte = newValue;
            nombreEnfant = parseInt(safeGetColumn(data, OUTPUT_COLUMNS.NOMBRE_ENFANT, 0)) || 0;
        } else {
            nombreAdulte = parseInt(safeGetColumn(data, OUTPUT_COLUMNS.NOMBRE_ADULTE, 0)) || 0;
            nombreEnfant = newValue;
        }

        const validation = validateHouseholdComposition(nombreAdulte, nombreEnfant);

        if (!validation.isValid) {
            sheet.getRange(row, col).setValue(parseInt(e.oldValue) || 0);

            SpreadsheetApp.getUi().alert(
                '⚠️ Composition du foyer invalide',
                validation.error + '\n\n' +
                'La valeur a été rétablie à: ' + (parseInt(e.oldValue) || 0),
                SpreadsheetApp.getUi().ButtonSet.OK
            );

            logInfo(`Household composition edit blocked for row ${row}: ${validation.error}`);
            return;
        }

        const fieldName = col === OUTPUT_COLUMNS.NOMBRE_ADULTE + 1 ? 'Adultes' : 'Enfants';
        appendSheetComment(
            sheet,
            row,
            '👥',
            `${fieldName}: ${e.oldValue || 0} → ${newValue} (Total: ${validation.total})`
        );
        logInfo(`Household composition updated for row ${row}: ${fieldName} = ${newValue}, Total = ${validation.total}`);

    } catch (error) {
        logError('Household composition edit handler failed', error);
    }
}

function handleRejectedStatus(sheet, row) {
    try {
        const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
        const familyId = safeGetColumn(data, OUTPUT_COLUMNS.ID);

        logInfo(`Processing rejected status for family ${familyId} at row ${row}`);

        const existingContact = findContactByFamilyId(familyId);

        if (existingContact) {
            const updateResult = updateContactLabelsForStatus(familyId, 'Rejeté');
            appendSheetComment(sheet, row, '🚫', 'Marqué comme Rejeté');

            if (updateResult.success) {
                logInfo(`Contact labels updated successfully for rejected family: ${familyId}`);
                appendSheetComment(sheet, row, '🏷️', 'Labels Google Contact mis à jour: Rejeté');
            } else {
                logError(`Failed to update contact labels for family: ${familyId}`, updateResult.error);
                appendSheetComment(sheet, row, '⚠️', `Échec mise à jour labels: ${updateResult.error}`);
            }
        } else {
            logInfo(`Creating new contact for rejected family: ${familyId}`);

            const rawPhone = String(safeGetColumn(data, OUTPUT_COLUMNS.TELEPHONE, ''));
            const rawPhoneBis = String(safeGetColumn(data, OUTPUT_COLUMNS.TELEPHONE_BIS, ''));

            const familyData = {
                id: familyId,
                nom: safeGetColumn(data, OUTPUT_COLUMNS.NOM),
                prenom: safeGetColumn(data, OUTPUT_COLUMNS.PRENOM),
                email: safeGetColumn(data, OUTPUT_COLUMNS.EMAIL),
                telephone: rawPhone,
                phoneBis: rawPhoneBis,
                adresse: safeGetColumn(data, OUTPUT_COLUMNS.ADRESSE),
                idQuartier: safeGetColumn(data, OUTPUT_COLUMNS.ID_QUARTIER),
                nombreAdulte: parseInt(safeGetColumn(data, OUTPUT_COLUMNS.NOMBRE_ADULTE, 0)) || 0,
                nombreEnfant: parseInt(safeGetColumn(data, OUTPUT_COLUMNS.NOMBRE_ENFANT, 0)) || 0,
                criticite: parseInt(safeGetColumn(data, OUTPUT_COLUMNS.CRITICITE, 0)) || 0,
                zakatElFitr: safeGetColumn(data, OUTPUT_COLUMNS.ZAKAT_EL_FITR) === true,
                sadaqa: safeGetColumn(data, OUTPUT_COLUMNS.SADAQA) === true,
                langue: safeGetColumn(data, OUTPUT_COLUMNS.LANGUE, CONFIG.LANGUAGES.FR),
                seDeplace: safeGetColumn(data, OUTPUT_COLUMNS.SE_DEPLACE) === true
            };

            const createResult = createContactWithStatusLabel(familyData, 'Rejeté');

            if (createResult.success) {
                logInfo(`Contact created successfully for rejected family: ${familyId}`);
                appendSheetComment(sheet, row, '🚫', 'Marqué comme Rejeté');
                appendSheetComment(sheet, row, '📞', 'Contact créé avec label: Rejeté');
            } else {
                logError(`Failed to create contact for rejected family: ${familyId}`, createResult.error);
                appendSheetComment(sheet, row, '🚫', 'Marqué comme Rejeté');
                appendSheetComment(sheet, row, '⚠️', `Échec création contact: ${createResult.error}`);
            }
        }

        const nom = safeGetColumn(data, OUTPUT_COLUMNS.NOM);
        const prenom = safeGetColumn(data, OUTPUT_COLUMNS.PRENOM);

        notifyAdmin(
            '🚫 Famille rejetée',
            `ID: ${familyId}\nNom: ${nom} ${prenom}\nContact: ${existingContact ? 'Mis à jour' : 'Créé'}`
        );

    } catch (error) {
        logError('Failed to process rejected status', error);
        appendSheetComment(sheet, row, '❌', `Erreur traitement rejet: ${error.toString()}`);
    }
}

function handleArchiveStatus(sheet, row) {
    try {
        const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
        const familyId = safeGetColumn(data, OUTPUT_COLUMNS.ID);

        logInfo(`Processing archive for family ${familyId} at row ${row}`);

        const existingContact = findContactByFamilyId(familyId);

        if (existingContact) {
            const updateResult = updateContactLabelsForStatus(familyId, 'Archivé');
            appendSheetComment(sheet, row, '🗄️', 'Archivé');

            if (updateResult.success) {
                logInfo(`Contact labels updated successfully for archived family: ${familyId}`);
                appendSheetComment(sheet, row, '🏷️', 'Labels Google Contact mis à jour: Archivé');
            } else {
                logError(`Failed to update contact labels for family: ${familyId}`, updateResult.error);
                appendSheetComment(sheet, row, '⚠️', `Échec mise à jour labels: ${updateResult.error}`);
            }
        } else {
            logInfo(`Creating new contact for archived family: ${familyId}`);

            const rawPhone = String(safeGetColumn(data, OUTPUT_COLUMNS.TELEPHONE, ''));
            const rawPhoneBis = String(safeGetColumn(data, OUTPUT_COLUMNS.TELEPHONE_BIS, ''));

            const familyData = {
                id: familyId,
                nom: safeGetColumn(data, OUTPUT_COLUMNS.NOM),
                prenom: safeGetColumn(data, OUTPUT_COLUMNS.PRENOM),
                email: safeGetColumn(data, OUTPUT_COLUMNS.EMAIL),
                telephone: rawPhone,
                phoneBis: rawPhoneBis,
                adresse: safeGetColumn(data, OUTPUT_COLUMNS.ADRESSE),
                idQuartier: safeGetColumn(data, OUTPUT_COLUMNS.ID_QUARTIER),
                nombreAdulte: parseInt(safeGetColumn(data, OUTPUT_COLUMNS.NOMBRE_ADULTE, 0)) || 0,
                nombreEnfant: parseInt(safeGetColumn(data, OUTPUT_COLUMNS.NOMBRE_ENFANT, 0)) || 0,
                criticite: parseInt(safeGetColumn(data, OUTPUT_COLUMNS.CRITICITE, 0)) || 0,
                zakatElFitr: safeGetColumn(data, OUTPUT_COLUMNS.ZAKAT_EL_FITR) === true,
                sadaqa: safeGetColumn(data, OUTPUT_COLUMNS.SADAQA) === true,
                langue: safeGetColumn(data, OUTPUT_COLUMNS.LANGUE, CONFIG.LANGUAGES.FR),
                seDeplace: safeGetColumn(data, OUTPUT_COLUMNS.SE_DEPLACE) === true
            };

            const createResult = createContactWithStatusLabel(familyData, 'Archivé');

            if (createResult.success) {
                logInfo(`Contact created successfully for archived family: ${familyId}`);
                appendSheetComment(sheet, row, '🗄️', 'Archivé');
                appendSheetComment(sheet, row, '📞', 'Contact créé avec label: Archivé');
            } else {
                logError(`Failed to create contact for archived family: ${familyId}`, createResult.error);
                appendSheetComment(sheet, row, '🗄️', 'Archivé');
                appendSheetComment(sheet, row, '⚠️', `Échec création contact: ${createResult.error}`);
            }
        }

        const nom = safeGetColumn(data, OUTPUT_COLUMNS.NOM);
        const prenom = safeGetColumn(data, OUTPUT_COLUMNS.PRENOM);

        notifyAdmin(
            '🗄️ Famille archivée',
            `ID: ${familyId}\nNom: ${nom} ${prenom}\nContact: ${existingContact ? 'Mis à jour' : 'Créé'}`
        );

    } catch (error) {
        logError('Failed to process archive status', error);
        appendSheetComment(sheet, row, '❌', `Erreur archivage: ${error.toString()}`);
    }
}

function processValidatedFamily(sheet, row) {
    try {
        logInfo(`Processing validated family at row ${row}`);

        const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

        const familyId = safeGetColumn(data, OUTPUT_COLUMNS.ID);
        const identityUrls = safeGetColumn(data, OUTPUT_COLUMNS.IDENTITE);
        const aidesEtatUrls = safeGetColumn(data, OUTPUT_COLUMNS.AIDES_ETAT);

        const identityIds = extractFileIds(identityUrls);
        const aidesEtatIds = extractFileIds(aidesEtatUrls);

        if (identityIds.length > 0 || aidesEtatIds.length > 0) {
            const organized = organizeDocuments(familyId, identityIds, aidesEtatIds, []);

            if (organized.identity.length > 0) {
                sheet.getRange(row, OUTPUT_COLUMNS.IDENTITE + 1).setValue(
                    formatDocumentLinks(organized.identity)
                );
            }
            if (organized.aidesEtat.length > 0) {
                sheet.getRange(row, OUTPUT_COLUMNS.AIDES_ETAT + 1).setValue(
                    formatDocumentLinks(organized.aidesEtat)
                );
            }

            logInfo(`Documents organized for family: ${familyId}`);
        }

        const rawPhone = String(safeGetColumn(data, OUTPUT_COLUMNS.TELEPHONE, ''));
        const rawPhoneBis = String(safeGetColumn(data, OUTPUT_COLUMNS.TELEPHONE_BIS, ''));

        const familyData = {
            id: familyId,
            nom: safeGetColumn(data, OUTPUT_COLUMNS.NOM),
            prenom: safeGetColumn(data, OUTPUT_COLUMNS.PRENOM),
            email: safeGetColumn(data, OUTPUT_COLUMNS.EMAIL),
            telephone: rawPhone,
            phoneBis: rawPhoneBis,
            adresse: safeGetColumn(data, OUTPUT_COLUMNS.ADRESSE),
            idQuartier: safeGetColumn(data, OUTPUT_COLUMNS.ID_QUARTIER),
            nombreAdulte: parseInt(safeGetColumn(data, OUTPUT_COLUMNS.NOMBRE_ADULTE, 0)) || 0,
            nombreEnfant: parseInt(safeGetColumn(data, OUTPUT_COLUMNS.NOMBRE_ENFANT, 0)) || 0,
            criticite: parseInt(safeGetColumn(data, OUTPUT_COLUMNS.CRITICITE, 0)) || 0,
            zakatElFitr: safeGetColumn(data, OUTPUT_COLUMNS.ZAKAT_EL_FITR) === true,
            sadaqa: safeGetColumn(data, OUTPUT_COLUMNS.SADAQA) === true,
            langue: safeGetColumn(data, OUTPUT_COLUMNS.LANGUE, CONFIG.LANGUAGES.FR),
            seDeplace: safeGetColumn(data, OUTPUT_COLUMNS.SE_DEPLACE) === true
        };

        const contactResult = syncFamilyContact(familyData);

        if (contactResult.success) {
            logInfo(`Contact synced for family: ${familyId}`);
            appendSheetComment(sheet, row, '✅', 'Validé et traité');
        } else {
            logError(`Contact sync failed for family: ${familyId}`, contactResult.error);
            appendSheetComment(sheet, row, '⚠️', `Erreur création contact: ${contactResult.error}`);
        }
    } catch (error) {
        logError('Failed to process validated family', error);
        appendSheetComment(sheet, row, '❌', `Erreur de traitement: ${error.toString()}`);
    }
}