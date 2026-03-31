/**
 * @file src/handlers/editHandler.js
 */

function onEditHandler(e) {
    try {
        const sheet = e.range.getSheet();
        if (sheet.getName() !== CONFIG.SHEETS.FAMILLE) return;

        const row = e.range.getRow();
        const col = e.range.getColumn();
        if (row === 1) return;

        const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
        const familyId = safeGetColumn(data, OUTPUT_COLUMNS.ID);

        logInfo(`Édition famille ${familyId} ligne ${row}, colonne ${col}`);

        if (col === OUTPUT_COLUMNS.NOMBRE_ADULTE + 1 || col === OUTPUT_COLUMNS.NOMBRE_ENFANT + 1) {
            handleHouseholdCompositionEdit(sheet, row, col, e, familyId);
            return;
        }

        if (col === OUTPUT_COLUMNS.ETAT_DOSSIER + 1) {
            handleStatusEdit(sheet, row, col, e, data, familyId);
            return;
        }

        if (col === OUTPUT_COLUMNS.CRITICITE + 1) {
            handleCriticiteEdit(sheet, row, col, e);
        }
    } catch (error) {
        logError('Échec gestionnaire édition', error);
    }
}

function handleStatusEdit(sheet, row, col, e, data, familyId) {
    const newStatus = e.value;
    const oldStatus = e.oldValue;

    if (newStatus === CONFIG.STATUS.ARCHIVED) {
        handleArchiveStatus(sheet, row, data, familyId);
        return;
    }
    if (newStatus === CONFIG.STATUS.REJECTED) {
        handleRejectedStatus(sheet, row, data, familyId);
        return;
    }
    if (newStatus === CONFIG.STATUS.VALIDATED) {
        handleValidationStatus(sheet, row, col, e, data, familyId, oldStatus);
    }
}

function handleValidationStatus(sheet, row, col, e, data, familyId, oldStatus) {
    const criticite = safeGetColumn(data, OUTPUT_COLUMNS.CRITICITE);
    let quartierId = safeGetColumn(data, OUTPUT_COLUMNS.ID_QUARTIER);
    const zakatElFitr = safeGetColumn(data, OUTPUT_COLUMNS.ZAKAT_EL_FITR);
    const sadaqa = safeGetColumn(data, OUTPUT_COLUMNS.SADAQA);
    const nombreAdulte = parseInt(safeGetColumn(data, OUTPUT_COLUMNS.NOMBRE_ADULTE, 0)) || 0;
    const nombreEnfant = parseInt(safeGetColumn(data, OUTPUT_COLUMNS.NOMBRE_ENFANT, 0)) || 0;

    const revert = (msg, title) => {
        const fallback = oldStatus || CONFIG.STATUS.IN_PROGRESS;
        sheet.getRange(row, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).setValue(fallback);
        SpreadsheetApp.getUi().alert(title, msg + '\n\nStatut rétabli à: ' + fallback, SpreadsheetApp.getUi().ButtonSet.OK);
        logInfo(`Validation bloquée ligne ${row}: ${msg}`);
    };

    const householdValidation = validateHouseholdComposition(nombreAdulte, nombreEnfant);
    if (!householdValidation.isValid) { revert(householdValidation.error, '⚠️ Composition du foyer invalide'); return; }

    if (!criticite || criticite === 0) { revert('Vous devez définir une criticité (1-5) avant de valider le dossier.', '⚠️ Criticité non définie'); return; }

    if (criticite < CONFIG.CRITICITE.MIN || criticite > CONFIG.CRITICITE.MAX) { revert(`La criticité doit être entre ${CONFIG.CRITICITE.MIN} et ${CONFIG.CRITICITE.MAX}.`, '⚠️ Criticité invalide'); return; }

    if (zakatElFitr !== true && sadaqa !== true) { revert('Vous devez cocher au moins une case: Zakat El Fitr ou Sadaqa.', '⚠️ Éligibilité requise'); return; }

    if (!quartierId) {
        const adresse = safeGetColumn(data, OUTPUT_COLUMNS.ADRESSE);
        if (!adresse) { revert('Le dossier ne peut pas être validé sans adresse.', '⚠️ Adresse manquante'); return; }

        const addressParts = parseAddressComponents(adresse);
        if (!addressParts.street || !addressParts.postalCode || !addressParts.city) { revert('Adresse incomplète ou mal formatée.\nFormat attendu: Adresse, Code Postal Ville', '⚠️ Adresse incomplète'); return; }

        const addressValidation = validateAddressAndGetQuartier(addressParts.street, addressParts.postalCode, addressParts.city);
        if (!addressValidation.isValid || !addressValidation.quartierId) {
            const fallback = oldStatus || CONFIG.STATUS.IN_PROGRESS;
            sheet.getRange(row, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).setValue(fallback);
            SpreadsheetApp.getUi().alert('⚠️ Quartier introuvable', `Impossible de déterminer le quartier.\n\nErreur: ${addressValidation.error || 'Aucun quartier trouvé'}\n\nStatut rétabli à: ${fallback}`, SpreadsheetApp.getUi().ButtonSet.OK);
            appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.RESOLUTION_ADRESSE, `❌ Validation échouée: ${addressValidation.error || 'Quartier introuvable'}`);
            return;
        }

        quartierId = addressValidation.quartierId;
        sheet.getRange(row, OUTPUT_COLUMNS.ID_QUARTIER + 1).setValue(quartierId);
        appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.RESOLUTION_ADRESSE, `✅ Quartier résolu automatiquement: ${addressValidation.quartierName || quartierId}`);
    }

    const quartierValidation = validateQuartierId(quartierId);
    if (!quartierValidation.isValid) {
        const fallback = oldStatus || CONFIG.STATUS.IN_PROGRESS;
        sheet.getRange(row, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).setValue(fallback);
        SpreadsheetApp.getUi().alert('⚠️ Quartier invalide', `Le Quartier ID "${quartierId}" n'existe pas dans l'API GEO.\n\nStatut rétabli à: ${fallback}`, SpreadsheetApp.getUi().ButtonSet.OK);
        appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.VALIDATION, `❌ Validation échouée: ${quartierValidation.error}`);
        return;
    }

    processValidatedFamily(sheet, row, data, familyId);
}

function handleHouseholdCompositionEdit(sheet, row, col, e, familyId) {
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
            SpreadsheetApp.getUi().alert('⚠️ Composition du foyer invalide', validation.error + '\n\nValeur rétablie à: ' + (parseInt(e.oldValue) || 0), SpreadsheetApp.getUi().ButtonSet.OK);
            return;
        }

        const fieldName = col === OUTPUT_COLUMNS.NOMBRE_ADULTE + 1 ? 'Adultes' : 'Enfants';
        appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.VALIDATION, `👥 ${fieldName}: ${e.oldValue || 0} → ${newValue} (Total: ${validation.total})`);
    } catch (error) {
        logError('Échec gestion édition foyer', error);
    }
}

function handleCriticiteEdit(sheet, row, col, e) {
    const criticite = e.value;
    if (criticite === '' || criticite === null) return;
    const numCriticite = parseInt(criticite);
    if (isNaN(numCriticite) || numCriticite < CONFIG.CRITICITE.MIN || numCriticite > CONFIG.CRITICITE.MAX) {
        sheet.getRange(row, OUTPUT_COLUMNS.CRITICITE + 1).setValue(e.oldValue || 0);
        SpreadsheetApp.getUi().alert('⚠️ Valeur invalide', `La criticité doit être entre ${CONFIG.CRITICITE.MIN} et ${CONFIG.CRITICITE.MAX}.\n\nValeur rétablie.`, SpreadsheetApp.getUi().ButtonSet.OK);
    }
}

function handleRejectedStatus(sheet, row, data, familyId) {
    try {
        const existingContact = findContactByFamilyId(familyId);
        if (existingContact) {
            const updateResult = updateContactLabelsForStatus(familyId, 'Rejeté');
            appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.REJET, '🚫 Marqué comme Rejeté');
            if (updateResult.success) {
                appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.REJET, '🏷️ Labels Google Contact mis à jour: Rejeté');
            } else {
                appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.REJET, `⚠️ Échec mise à jour labels: ${updateResult.error}`);
            }
        } else {
            const familyData = _extractFamilyDataFromRow(data, familyId);
            const createResult = createContactWithStatusLabel(familyData, 'Rejeté');
            appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.REJET, '🚫 Marqué comme Rejeté');
            if (createResult.success) {
                appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.REJET, '📞 Contact créé avec label: Rejeté');
            } else {
                appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.REJET, `⚠️ Échec création contact: ${createResult.error}`);
            }
        }
        const nom = safeGetColumn(data, OUTPUT_COLUMNS.NOM);
        const prenom = safeGetColumn(data, OUTPUT_COLUMNS.PRENOM);
        notifyAdmin('🚫 Famille rejetée', `ID: ${familyId}\nNom: ${nom} ${prenom}`);
    } catch (error) {
        logError('Échec traitement statut rejeté', error);
        appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.REJET, `❌ Erreur traitement rejet: ${error.toString()}`);
    }
}

function handleArchiveStatus(sheet, row, data, familyId) {
    try {
        const existingContact = findContactByFamilyId(familyId);
        if (existingContact) {
            const updateResult = updateContactLabelsForStatus(familyId, 'Archivé');
            appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.ARCHIVAGE, '🗄️ Archivé');
            if (updateResult.success) {
                appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.ARCHIVAGE, '🏷️ Labels Google Contact mis à jour: Archivé');
            } else {
                appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.ARCHIVAGE, `⚠️ Échec mise à jour labels: ${updateResult.error}`);
            }
        } else {
            const familyData = _extractFamilyDataFromRow(data, familyId);
            const createResult = createContactWithStatusLabel(familyData, 'Archivé');
            appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.ARCHIVAGE, '🗄️ Archivé');
            if (createResult.success) {
                appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.ARCHIVAGE, '📞 Contact créé avec label: Archivé');
            } else {
                appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.ARCHIVAGE, `⚠️ Échec création contact: ${createResult.error}`);
            }
        }
        const nom = safeGetColumn(data, OUTPUT_COLUMNS.NOM);
        const prenom = safeGetColumn(data, OUTPUT_COLUMNS.PRENOM);
        notifyAdmin('🗄️ Famille archivée', `ID: ${familyId}\nNom: ${nom} ${prenom}`);
    } catch (error) {
        logError('Échec traitement archivage', error);
        appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.ARCHIVAGE, `❌ Erreur archivage: ${error.toString()}`);
    }
}

function processValidatedFamily(sheet, row, data, familyId) {
    try {
        const identityUrls = safeGetColumn(data, OUTPUT_COLUMNS.IDENTITE);
        const aidesEtatUrls = safeGetColumn(data, OUTPUT_COLUMNS.AIDES_ETAT);
        const identityIds = extractFileIds(identityUrls);
        const aidesEtatIds = extractFileIds(aidesEtatUrls);

        if (identityIds.length > 0 || aidesEtatIds.length > 0) {
            const organized = organizeDocuments(familyId, identityIds, aidesEtatIds, []);
            if (organized.identity.length > 0) sheet.getRange(row, OUTPUT_COLUMNS.IDENTITE + 1).setValue(formatDocumentLinks(organized.identity));
            if (organized.aidesEtat.length > 0) sheet.getRange(row, OUTPUT_COLUMNS.AIDES_ETAT + 1).setValue(formatDocumentLinks(organized.aidesEtat));
        }

        const familyData = _extractFamilyDataFromRow(data, familyId);
        const contactResult = syncFamilyContact(familyData);

        if (contactResult.success) {
            appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.VALIDATION, '✅ Validé et contact synchronisé');
        } else {
            appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.VALIDATION, `⚠️ Validé mais erreur contact: ${contactResult.error}`);
        }
    } catch (error) {
        logError('Échec traitement famille validée', error);
        appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.VALIDATION, `❌ Erreur de traitement: ${error.toString()}`);
    }
}

function _extractFamilyDataFromRow(data, familyId) {
    return {
        id: familyId,
        nom: safeGetColumn(data, OUTPUT_COLUMNS.NOM),
        prenom: safeGetColumn(data, OUTPUT_COLUMNS.PRENOM),
        email: safeGetColumn(data, OUTPUT_COLUMNS.EMAIL),
        telephone: String(safeGetColumn(data, OUTPUT_COLUMNS.TELEPHONE, '')),
        phoneBis: String(safeGetColumn(data, OUTPUT_COLUMNS.TELEPHONE_BIS, '')),
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
}
