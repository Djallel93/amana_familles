/**
 * @file src/handlers/formHandler.js
 * @description 📋 Gestionnaire unifié pour toutes les soumissions de formulaire (INSERT et UPDATE)
 */

/**
 * 📝 Gestionnaire unifié de soumission de formulaire
 * Route automatiquement vers INSERT ou UPDATE selon le contenu du formulaire
 * 
 * @param {Object} e - Objet événement de soumission
 */
function onFormSubmit(e) {
    try {
        const sheet = e.range.getSheet();
        const sheetName = sheet.getName();
        const row = e.range.getRow();

        logInfo(`📋 Traitement de la feuille: ${sheetName}, ligne: ${row}`);

        // 🚫 Ignorer la feuille Famille (feuille de sortie uniquement)
        if (sheetName === CONFIG.SHEETS.FAMILLE) {
            logInfo('⏭️ Feuille Famille ignorée - sortie uniquement');
            return;
        }

        // 📊 Parser les données du formulaire
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
        const formData = parseFormResponse(headers, values);

        // 🚫 NOUVEAU: Vérifier le refus de consentement
        if (isConsentRefused(formData)) {
            logInfo('🚫 Soumission ignorée: l\'utilisateur a refusé le consentement');
            return; // Ne rien faire, ne pas notifier, ne pas logger
        }

        // 🔍 Détection automatique du type de formulaire
        const formType = detectFormType(formData, sheetName);

        logInfo(`🎯 Type de formulaire détecté: ${formType}`);

        // 🔀 Router vers le gestionnaire approprié
        if (formType === 'UPDATE') {
            processUpdate(formData, sheet, row);
        } else {
            processInsert(formData, sheet, row, sheetName);
        }

    } catch (error) {
        logError('❌ Échec du traitement de la soumission', error);
        notifyAdmin('❌ Erreur de traitement', `Erreur: ${error.toString()}\nFeuille: ${e.range.getSheet().getName()}\nLigne: ${e.range.getRow()}`);
    }
}

/**
 * 🔍 Détecter s'il s'agit d'un formulaire INSERT ou UPDATE
 * 
 * @param {Object} formData - Données du formulaire parsées
 * @param {string} sheetName - Nom de la feuille
 * @returns {string} - 'INSERT' ou 'UPDATE'
 */
function detectFormType(formData, sheetName) {
    // 🔍 Vérification 1: Le formulaire contient-il un ID de famille?
    const hasFamilyId = !!(formData.familyId || formData.id);

    if (hasFamilyId) {
        logInfo('🆔 ID famille détecté dans les données - formulaire UPDATE');
        return 'UPDATE';
    }

    // 🔍 Vérification 2: Le nom de la feuille contient des mots-clés de mise à jour?
    const updateKeywords = [
        'update',
        'mise à jour',
        'mise a jour',
        'maj',
        'modification',
        'تحديث',
        'actualisation',
        'modifier'
    ];

    const lowerName = sheetName.toLowerCase();
    const isUpdateSheet = updateKeywords.some(keyword => lowerName.includes(keyword));

    if (isUpdateSheet) {
        logInfo('🔤 Mot-clé de mise à jour détecté dans le nom de la feuille - formulaire UPDATE');
        return 'UPDATE';
    }

    // ➕ Par défaut: formulaire INSERT
    logInfo('➕ Aucun indicateur de mise à jour trouvé - formulaire INSERT');
    return 'INSERT';
}

/**
 * ➕ Traiter une soumission INSERT (nouvelle famille)
 * 
 * @param {Object} formData - Données du formulaire parsées
 * @param {Sheet} sheet - Feuille source
 * @param {number} row - Numéro de ligne source
 * @param {string} sheetName - Nom de la feuille
 */
function processInsert(formData, sheet, row, sheetName) {
    try {
        logInfo('➕ Traitement d\'une soumission INSERT');

        // ✅ Valider les champs requis
        const fieldValidation = validateRequiredFields(formData);
        if (!fieldValidation.isValid) {
            writeToFamilySheet(formData, {
                status: CONFIG.STATUS.REJECTED,
                comment: `Champs requis manquants: ${fieldValidation.errors.join(', ')}`,
                criticite: 0
            });
            notifyAdmin('⚠️ Soumission rejetée', `Raison: ${fieldValidation.errors.join(', ')}\nNom: ${formData.lastName} ${formData.firstName}`);
            return;
        }

        // 🏠 Valider l'adresse
        logInfo('🏠 Validation de l\'adresse');
        const addressValidation = validateAddressAndGetQuartier(
            formData.address,
            formData.postalCode,
            formData.city
        );

        if (!addressValidation.isValid) {
            writeToFamilySheet(formData, {
                status: CONFIG.STATUS.REJECTED,
                comment: `Adresse invalide: ${addressValidation.error}`,
                criticite: 0
            });
            notifyAdmin('⚠️ Soumission rejetée', `Adresse invalide\nFamille: ${formData.lastName} ${formData.firstName}\nAdresse: ${formData.address}`);
            return;
        }

        logInfo('✅ Adresse validée avec succès');

        // 📄 Valider les documents
        logInfo('📄 Validation des documents');
        const docValidation = validateDocuments(
            formData.identityDoc,
            formData.cafDoc || formData.cafDocOptional,
            formData.resourceDoc
        );

        if (!docValidation.isValid) {
            writeToFamilySheet(formData, {
                status: CONFIG.STATUS.REJECTED,
                comment: `Documents invalides: ${docValidation.errors.join(', ')}`,
                quartierId: addressValidation.quartierId,
                criticite: 0
            });
            notifyAdmin('⚠️ Soumission rejetée', `Documents invalides\nFamille: ${formData.lastName} ${formData.firstName}\nErreurs: ${docValidation.errors.join(', ')}`);
            return;
        }
        logInfo('✅ Documents validés avec succès');

        logInfo('🔍 Vérification des doublons');
        // 🔍 Vérifier les doublons
        const duplicate = findDuplicateFamily(
            formData.phone,
            formData.lastName,
            formData.email
        );

        if (duplicate.exists) {
            updateExistingFamily(duplicate, formData, addressValidation, docValidation);
            notifyAdmin('🔄 Famille mise à jour', `ID: ${duplicate.id}\nNom: ${formData.lastName} ${formData.firstName}\nTéléphone: ${normalizePhone(formData.phone)}`);
        } else {
            const familyId = generateFamilyId();
            writeToFamilySheet(formData, {
                status: CONFIG.STATUS.IN_PROGRESS,
                familyId: familyId,
                quartierId: addressValidation.quartierId,
                quartierName: addressValidation.quartierName,
                identityIds: docValidation.identityIds,
                cafIds: docValidation.cafIds,
                resourceIds: docValidation.resourceIds,
                criticite: 0
            });
            notifyAdmin('✅ Nouvelle soumission', `ID: ${familyId}\nNom: ${formData.lastName} ${formData.firstName}\nTéléphone: ${normalizePhone(formData.phone)}\nAdresse: ${formData.address}, ${formData.postalCode} ${formData.city}\nQuartier: ${addressValidation.quartierName || 'Non assigné'}`);
        }

        logInfo('✅ Soumission INSERT traitée avec succès');

    } catch (error) {
        logError('❌ Échec du traitement INSERT', error);
        notifyAdmin('❌ Erreur INSERT', `Erreur: ${error.toString()}\nFamille: ${formData.lastName} ${formData.firstName}`);
        throw error;
    }
}

/**
 * ✏️ Traiter une soumission UPDATE (famille existante)
 * 
 * @param {Object} formData - Données du formulaire parsées
 * @param {Sheet} sheet - Feuille source
 * @param {number} row - Numéro de ligne source
 */
function processUpdate(formData, sheet, row) {
    try {
        logInfo('✏️ Traitement d\'une soumission UPDATE');

        // 🆔 Extraire l'ID de famille
        const familyId = formData.familyId || formData.id;

        if (!familyId) {
            logError('❌ Formulaire de mise à jour sans ID famille', { row });
            notifyAdmin('❌ Update échouée', `ID famille manquant dans le formulaire\nLigne: ${row}`);
            return;
        }

        // 🔨 Construire les données de mise à jour (uniquement les champs non vides)
        const updateData = buildUpdateData(formData);

        if (Object.keys(updateData).length === 0) {
            logError('❌ Formulaire de mise à jour sans données', { familyId });
            notifyAdmin('❌ Update échouée', `Aucune donnée à mettre à jour pour ${familyId}`);
            return;
        }

        // ✅ Valider les données de mise à jour
        const validation = validateUpdateData(updateData);
        if (!validation.isValid) {
            logError('❌ Validation de la mise à jour échouée', { familyId, error: validation.error });
            notifyAdmin('❌ Update échouée', `${familyId}: ${validation.error}`);
            return;
        }

        // 🔄 Effectuer la mise à jour
        const result = updateFamilyById(familyId, updateData);

        if (result.success) {
            logInfo('✅ Formulaire de mise à jour traité avec succès', {
                familyId,
                updatedFields: result.updatedFields
            });
            notifyAdmin(
                '✅ Famille mise à jour via formulaire',
                `ID: ${familyId}\nChamps mis à jour: ${result.updatedFields.join(', ')}`
            );
        } else {
            logError('❌ Échec du traitement de la mise à jour', { familyId, error: result.error });
            notifyAdmin('❌ Update échouée', `ID: ${familyId}\nErreur: ${result.error}`);
        }

    } catch (error) {
        logError('❌ Échec du traitement UPDATE', error);
        notifyAdmin('❌ Erreur UPDATE', `Erreur: ${error.toString()}`);
        throw error;
    }
}

/**
 * 🔨 Construire l'objet de données de mise à jour depuis les données du formulaire
 * 
 * @param {Object} formData - Données brutes du formulaire
 * @returns {Object} - Données de mise à jour nettoyées
 */
function buildUpdateData(formData) {
    const updateData = {};

    const fieldMapping = {
        lastName: 'lastName',
        firstName: 'firstName',
        phone: 'phone',
        phoneBis: 'phoneBis',
        email: 'email',
        address: 'address',
        postalCode: 'postalCode',
        city: 'city',
        nombreAdulte: 'nombreAdulte',
        nombreEnfant: 'nombreEnfant',
        circonstances: 'circonstances',
        ressentit: 'ressentit',
        specificites: 'specificites',
        criticite: 'criticite'
    };

    Object.keys(fieldMapping).forEach(key => {
        const value = formData[key];

        // ⏭️ Ignorer les valeurs vides
        if (value === undefined || value === null || value === '') {
            return;
        }

        // 🔢 Parser les nombres
        if (key === 'nombreAdulte' || key === 'nombreEnfant' || key === 'criticite') {
            const parsed = parseInt(value);
            if (!isNaN(parsed)) {
                updateData[fieldMapping[key]] = parsed;
            }
        } else {
            updateData[fieldMapping[key]] = value;
        }
    });

    return updateData;
}

/**
 * ✅ Valider les données de mise à jour
 * 
 * @param {Object} updateData - Données de mise à jour à valider
 * @returns {Object} - {isValid: boolean, error: string}
 */
function validateUpdateData(updateData) {
    // ✉️ Valider l'email si fourni
    if (updateData.email && !isValidEmail(updateData.email)) {
        return {
            isValid: false,
            error: 'Email invalide'
        };
    }

    // 📞 Valider le téléphone si fourni
    if (updateData.phone && !isValidPhone(updateData.phone)) {
        return {
            isValid: false,
            error: 'Téléphone invalide'
        };
    }

    // ⚠️ Valider la criticité si fournie
    if (updateData.criticite !== undefined) {
        if (isNaN(updateData.criticite) ||
            updateData.criticite < CONFIG.CRITICITE.MIN ||
            updateData.criticite > CONFIG.CRITICITE.MAX) {
            return {
                isValid: false,
                error: 'Criticité invalide (doit être entre 0 et 5)'
            };
        }
    }

    return { isValid: true };
}