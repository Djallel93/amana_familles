/**
 * @file src/handlers/formHandler.js
 */

function onFormSubmit(e) {
    try {
        const sheet = e.range.getSheet();
        const sheetName = sheet.getName();
        const row = e.range.getRow();

        logInfo(`Traitement feuille: ${sheetName}, ligne: ${row}`);

        if (sheetName === CONFIG.SHEETS.FAMILLE) return;

        const detectedLanguage = detectLanguageFromSheet(sheetName);

        if (sheetName === CONFIG.SHEETS.GOOGLE_FORM) {
            processGoogleFormSubmission(sheet, row, detectedLanguage);
            return;
        }

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
        const formData = parseFormResponse(headers, values);
        formData.langue = detectedLanguage;

        if (isConsentRefused(formData)) {
            logInfo('Soumission ignorée: consentement refusé');
            return;
        }

        processInsert(formData);
    } catch (error) {
        logError('Échec traitement soumission formulaire', error);
        notifyAdmin('❌ Erreur traitement formulaire', `Erreur: ${error.toString()}\nFeuille: ${e.range.getSheet().getName()}\nLigne: ${e.range.getRow()}`);
    }
}

function processGoogleFormSubmission(sheet, row, language = CONFIG.LANGUAGES.FR) {
    try {
        logInfo('Traitement soumission formulaire admin');
        const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
        const formData = parseGoogleFormData(values);
        formData.langue = language;

        const statusColumn = sheet.getLastColumn() + 1;
        sheet.getRange(row, statusColumn).setValue('⚙️ En cours...');

        const fieldValidation = validateRequiredFields(formData);
        if (!fieldValidation.isValid) {
            const errorMessage = `Champs requis manquants: ${fieldValidation.errors.join(', ')}`;
            sheet.getRange(row, statusColumn).setValue(`❌ ${errorMessage}`);
            notifyAdmin('⚠️ Formulaire admin rejeté', `Raison: ${errorMessage}\nNom: ${formData.lastName} ${formData.firstName}`);
            return;
        }

        const duplicate = findDuplicateFamily(formData.phone, formData.lastName, formData.email);
        if (duplicate.exists) {
            const docValidation = validateDocuments(formData.identityDoc, formData.aidesEtatDoc, formData.resourceDoc);
            const updateResult = updateExistingFamily(duplicate, formData, null, docValidation.isValid ? docValidation : { identityIds: [], aidesEtatIds: [], resourceIds: [] });
            sheet.getRange(row, statusColumn).setValue(`✅ Mis à jour: ${duplicate.id}`);
            _notifyAdminUpdate(duplicate, formData, updateResult);
            return;
        }

        const addressValidation = validateAddressAndGetQuartier(formData.address, formData.postalCode, formData.city);
        if (!addressValidation.isValid) {
            sheet.getRange(row, statusColumn).setValue(`❌ Adresse invalide: ${addressValidation.error}`);
            notifyAdmin('⚠️ Formulaire admin rejeté', `Adresse invalide\nFamille: ${formData.lastName} ${formData.firstName}`);
            return;
        }

        const familyId = generateFamilyId();
        const familleSheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        const newRow = writeToFamilySheet(formData, {
            status: CONFIG.STATUS.IN_PROGRESS,
            familyId,
            quartierId: addressValidation.quartierId,
            identityIds: [], aidesEtatIds: [], resourceIds: [],
            criticite: formData.criticite,
            langue: language,
            seDeplace: formData.seDeplace || false,
            zakatElFitr: formData.zakatElFitr || false,
            sadaqa: formData.sadaqa || false
        });

        if (addressValidation.quartierInvalid) {
            appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.RESOLUTION_ADRESSE, `⚠️ ${addressValidation.warning}`);
        }

        appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.SOUMISSION_FORMULAIRE, '📋 Soumis via formulaire admin');
        sheet.getRange(row, statusColumn).setValue(`✅ Créé: ${familyId}`);
        notifyAdmin('✅ Nouvelle famille (formulaire admin)', _buildInsertNotification(familyId, formData, addressValidation));
    } catch (error) {
        logError('Échec traitement formulaire admin', error);
        notifyAdmin('❌ Erreur formulaire admin', `Erreur: ${error.toString()}`);
    }
}

function processInsert(formData) {
    try {
        logInfo('Traitement soumission INSERT');

        const fieldValidation = validateRequiredFields(formData);
        if (!fieldValidation.isValid) {
            notifyAdmin('⚠️ Soumission rejetée', `Champs manquants: ${fieldValidation.errors.join(', ')}\nNom: ${formData.lastName} ${formData.firstName}`);
            return;
        }

        const duplicate = findDuplicateFamily(formData.phone, formData.lastName, formData.email);
        if (duplicate.exists) {
            logInfo(`Doublon trouvé (${duplicate.matchType}) - mise à jour famille ${duplicate.id}`);
            const docValidation = validateDocuments(formData.identityDoc, formData.aidesEtatDoc, formData.resourceDoc);
            if (!docValidation.isValid) {
                logWarning(`Documents invalides lors de la mise à jour famille ${duplicate.id}: ${docValidation.errors.join(', ')}`);
            }
            const updateResult = updateExistingFamily(duplicate, formData, null, docValidation.isValid ? docValidation : { identityIds: [], aidesEtatIds: [], resourceIds: [] });
            _notifyAdminUpdate(duplicate, formData, updateResult);
            return;
        }

        const addressValidation = validateAddressAndGetQuartier(formData.address, formData.postalCode, formData.city);
        if (!addressValidation.isValid) {
            notifyAdmin('⚠️ Soumission rejetée', `Adresse invalide\nFamille: ${formData.lastName} ${formData.firstName}`);
            return;
        }

        const docValidation = validateDocuments(formData.identityDoc, formData.aidesEtatDoc, formData.resourceDoc);
        if (!docValidation.isValid) {
            notifyAdmin('⚠️ Soumission rejetée', `Documents invalides: ${docValidation.errors.join(', ')}\nFamille: ${formData.lastName} ${formData.firstName}`);
            return;
        }

        const familyId = generateFamilyId();
        writeToFamilySheet(formData, {
            status: CONFIG.STATUS.IN_PROGRESS,
            familyId,
            quartierId: addressValidation.quartierId,
            identityIds: docValidation.identityIds,
            aidesEtatIds: docValidation.aidesEtatIds,
            resourceIds: docValidation.resourceIds,
            criticite: 0,
            langue: formData.langue || CONFIG.LANGUAGES.FR,
            seDeplace: formData.seDeplace || false,
            zakatElFitr: formData.zakatElFitr || false,
            sadaqa: formData.sadaqa || false
        });

        if (addressValidation.quartierInvalid) {
            appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.RESOLUTION_ADRESSE, `⚠️ ${addressValidation.warning}`);
        }

        appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.SOUMISSION_FORMULAIRE, `📋 Soumis via formulaire (${formData.langue || CONFIG.LANGUAGES.FR})`);
        notifyAdmin('✅ Nouvelle soumission', _buildInsertNotification(familyId, formData, addressValidation));
        logInfo('Soumission INSERT traitée avec succès');
    } catch (error) {
        logError('Échec traitement INSERT', error);
        notifyAdmin('❌ Erreur INSERT', `Erreur: ${error.toString()}\nFamille: ${formData.lastName} ${formData.firstName}`);
        throw error;
    }
}

function _buildInsertNotification(familyId, formData, addressValidation) {
    let msg = `ID: ${familyId}\nNom: ${formData.lastName} ${formData.firstName}\n` +
        `Téléphone: ${normalizePhone(formData.phone)}\n` +
        `Adresse: ${formData.address}, ${formData.postalCode} ${formData.city}\n` +
        `Quartier: ${addressValidation.quartierName || 'Non assigné'}\n` +
        `Langue: ${formData.langue || CONFIG.LANGUAGES.FR}\n` +
        `Se déplace: ${formData.seDeplace ? 'Oui' : 'Non'}`;
    if (addressValidation.quartierInvalid) msg += `\n\n⚠️ ATTENTION: Quartier ID invalide dans l'API GEO`;
    return msg;
}

function _notifyAdminUpdate(duplicate, formData, updateResult) {
    const changes = updateResult && updateResult.changes && updateResult.changes.length > 0
        ? updateResult.changes.join(', ')
        : 'aucun changement détecté';
    notifyAdmin(
        '🔄 Famille mise à jour (soumission formulaire)',
        `ID: ${duplicate.id}\nNom: ${formData.lastName} ${formData.firstName}\n` +
        `Téléphone: ${normalizePhone(formData.phone)}\n` +
        `Correspondance: ${duplicate.matchType === 'email' ? 'email' : 'téléphone + nom'}\n` +
        `Champs mis à jour: ${changes}`
    );
}
