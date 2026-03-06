/**
 * @file src/handlers/formHandler.js
 * @description Gestionnaire principal des soumissions de formulaires multilingues et admin
 */

function onFormSubmit(e) {
    try {
        const sheet = e.range.getSheet();
        const sheetName = sheet.getName();
        const row = e.range.getRow();

        logInfo(`📋 Traitement feuille: ${sheetName}, ligne: ${row}`);

        if (sheetName === CONFIG.SHEETS.FAMILLE) {
            logInfo('⏭️ Feuille Famille ignorée - sortie uniquement');
            return;
        }

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
            logInfo('🚫 Soumission ignorée: consentement refusé');
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
        logInfo('📱 Traitement soumission formulaire admin');

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
            logInfo('📄 Validation documents (mise à jour formulaire admin)');
            const docValidation = validateDocuments(formData.identityDoc, formData.aidesEtatDoc, formData.resourceDoc);
            const updateResult = updateExistingFamily(duplicate, formData, null, docValidation.isValid ? docValidation : { identityIds: [], aidesEtatIds: [], resourceIds: [] });
            sheet.getRange(row, statusColumn).setValue(`✅ Mis à jour: ${duplicate.id}`);
            _notifyAdminUpdate(duplicate, formData, updateResult);
            return;
        }

        logInfo('🏠 Validation adresse');
        const addressValidation = validateAddressAndGetQuartier(formData.address, formData.postalCode, formData.city);

        if (!addressValidation.isValid) {
            const errorMessage = `Adresse invalide: ${addressValidation.error}`;
            sheet.getRange(row, statusColumn).setValue(`❌ ${errorMessage}`);
            notifyAdmin('⚠️ Formulaire admin rejeté', `Adresse invalide\nFamille: ${formData.lastName} ${formData.firstName}`);
            return;
        }

        logInfo('✅ Adresse validée');
        const familyId = generateFamilyId();
        let comment = `Soumis via formulaire admin le ${new Date().toLocaleString('fr-FR')}`;
        if (addressValidation.quartierInvalid) comment += `\n⚠️ ${addressValidation.warning}`;

        writeToFamilySheet(formData, {
            status: CONFIG.STATUS.IN_PROGRESS,
            comment: comment,
            familyId: familyId,
            quartierId: addressValidation.quartierId,
            quartierName: addressValidation.quartierName,
            identityIds: [], aidesEtatIds: [], resourceIds: [],
            criticite: formData.criticite,
            langue: language,
            seDeplace: formData.seDeplace || false,
            zakatElFitr: formData.zakatElFitr || false,
            sadaqa: formData.sadaqa || false
        });

        sheet.getRange(row, statusColumn).setValue(`✅ Créé: ${familyId}`);
        notifyAdmin('✅ Nouvelle famille (formulaire admin)', _buildInsertNotification(familyId, formData, addressValidation));
        logInfo('✅ Formulaire admin traité avec succès');

    } catch (error) {
        logError('Échec traitement formulaire admin', error);
        notifyAdmin('❌ Erreur formulaire admin', `Erreur: ${error.toString()}`);
    }
}

function processInsert(formData) {
    try {
        logInfo('➕ Traitement soumission INSERT');

        const fieldValidation = validateRequiredFields(formData);
        if (!fieldValidation.isValid) {
            notifyAdmin('⚠️ Soumission rejetée', `Champs manquants: ${fieldValidation.errors.join(', ')}\nNom: ${formData.lastName} ${formData.firstName}`);
            return;
        }

        logInfo('🔍 Vérification doublon');
        const duplicate = findDuplicateFamily(formData.phone, formData.lastName, formData.email);

        if (duplicate.exists) {
            logInfo(`🔄 Doublon trouvé (${duplicate.matchType}) - mise à jour famille ${duplicate.id}`);

            logInfo('📄 Validation documents (mise à jour)');
            const docValidation = validateDocuments(formData.identityDoc, formData.aidesEtatDoc, formData.resourceDoc);
            if (!docValidation.isValid) {
                logAvertissement(`Documents invalides lors de la mise à jour famille ${duplicate.id}: ${docValidation.errors.join(', ')}`);
            }

            const updateResult = updateExistingFamily(duplicate, formData, null, docValidation.isValid ? docValidation : { identityIds: [], aidesEtatIds: [], resourceIds: [] });
            _notifyAdminUpdate(duplicate, formData, updateResult);
            logInfo('✅ Mise à jour doublon traitée avec succès');
            return;
        }

        logInfo('🏠 Validation adresse');
        const addressValidation = validateAddressAndGetQuartier(formData.address, formData.postalCode, formData.city);

        if (!addressValidation.isValid) {
            notifyAdmin('⚠️ Soumission rejetée', `Adresse invalide\nFamille: ${formData.lastName} ${formData.firstName}`);
            return;
        }
        logInfo('✅ Adresse validée');

        logInfo('📄 Validation documents');
        const docValidation = validateDocuments(formData.identityDoc, formData.aidesEtatDoc, formData.resourceDoc);

        if (!docValidation.isValid) {
            notifyAdmin('⚠️ Soumission rejetée', `Documents invalides: ${docValidation.errors.join(', ')}\nFamille: ${formData.lastName} ${formData.firstName}`);
            return;
        }
        logInfo('✅ Documents validés');

        const familyId = generateFamilyId();
        let comment = '';
        if (addressValidation.quartierInvalid) {
            comment = `⚠️ ATTENTION: ${addressValidation.warning}\nVérifier l'adresse avant validation.`;
        }

        writeToFamilySheet(formData, {
            status: CONFIG.STATUS.IN_PROGRESS,
            comment: comment,
            familyId: familyId,
            quartierId: addressValidation.quartierId,
            quartierName: addressValidation.quartierName,
            identityIds: docValidation.identityIds,
            aidesEtatIds: docValidation.aidesEtatIds,
            resourceIds: docValidation.resourceIds,
            criticite: 0,
            langue: formData.langue || CONFIG.LANGUAGES.FR,
            seDeplace: formData.seDeplace || false,
            zakatElFitr: formData.zakatElFitr || false,
            sadaqa: formData.sadaqa || false
        });

        notifyAdmin('✅ Nouvelle soumission', _buildInsertNotification(familyId, formData, addressValidation));
        logInfo('✅ Soumission INSERT traitée avec succès');

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