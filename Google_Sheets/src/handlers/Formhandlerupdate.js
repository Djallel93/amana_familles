/**
 * @file src/handlers/formHandlerUpdate.js
 * @description Traitement des mises à jour via formulaire et parsing du formulaire admin
 */

function processUpdate(formData) {
    try {
        logInfo('✏️ Traitement soumission UPDATE');
        const familyId = formData.familyId || formData.id;

        if (!familyId) {
            logError('Formulaire UPDATE sans ID famille');
            notifyAdmin('❌ Mise à jour échouée', 'ID famille manquant dans le formulaire');
            return;
        }

        const updateData = buildUpdateData(formData);
        if (Object.keys(updateData).length === 0) {
            logError('Formulaire UPDATE sans données', { familyId });
            notifyAdmin('❌ Mise à jour échouée', `Aucune donnée à mettre à jour pour ${familyId}`);
            return;
        }

        const validation = validateUpdateData(updateData);
        if (!validation.isValid) {
            logError('Validation mise à jour échouée', { familyId, error: validation.error });
            notifyAdmin('❌ Mise à jour échouée', `${familyId}: ${validation.error}`);
            return;
        }

        const result = updateFamilyById(familyId, updateData);
        if (result.success) {
            logInfo('✅ Formulaire UPDATE traité avec succès', { familyId, updatedFields: result.updatedFields });
            notifyAdmin('✅ Famille mise à jour via formulaire', `ID: ${familyId}\nChamps mis à jour: ${result.updatedFields.join(', ')}`);
        } else {
            logError('Échec traitement mise à jour', { familyId, error: result.error });
            notifyAdmin('❌ Mise à jour échouée', `ID: ${familyId}\nErreur: ${result.error}`);
        }
    } catch (error) {
        logError('Échec traitement UPDATE', error);
        notifyAdmin('❌ Erreur UPDATE', `Erreur: ${error.toString()}`);
        throw error;
    }
}

function buildUpdateData(formData) {
    const updateData = {};
    const fieldMapping = {
        lastName: 'lastName', firstName: 'firstName', phone: 'phone',
        phoneBis: 'phoneBis', email: 'email', address: 'address',
        postalCode: 'postalCode', city: 'city', nombreAdulte: 'nombreAdulte',
        nombreEnfant: 'nombreEnfant', seDeplace: 'seDeplace',
        circonstances: 'circonstances', ressentit: 'ressentit',
        specificites: 'specificites', criticite: 'criticite', langue: 'langue'
    };

    Object.keys(fieldMapping).forEach(key => {
        const value = formData[key];
        if (value === undefined || value === null || value === '') return;
        if (key === 'nombreAdulte' || key === 'nombreEnfant' || key === 'criticite') {
            const parsed = parseInt(value);
            if (!isNaN(parsed)) updateData[fieldMapping[key]] = parsed;
        } else if (key === 'seDeplace') {
            updateData[fieldMapping[key]] = parseSeDeplace(value);
        } else {
            updateData[fieldMapping[key]] = value.trim();
        }
    });

    return updateData;
}

function validateUpdateData(updateData) {
    if (updateData.email && !isValidEmail(updateData.email)) {
        return { isValid: false, error: 'Email invalide' };
    }
    if (updateData.phone && !isValidPhone(updateData.phone)) {
        return { isValid: false, error: 'Téléphone invalide' };
    }
    if (updateData.criticite !== undefined) {
        if (isNaN(updateData.criticite) || updateData.criticite < CONFIG.CRITICITE.MIN || updateData.criticite > CONFIG.CRITICITE.MAX) {
            return { isValid: false, error: 'Criticité invalide (doit être entre 0 et 5)' };
        }
    }
    if (updateData.langue && !['Français', 'Arabe', 'Anglais'].includes(updateData.langue)) {
        return { isValid: false, error: 'Langue invalide' };
    }
    return { isValid: true };
}

/**
 * Parse les données du formulaire admin Google Form
 */
function parseGoogleFormData(values) {
    const eligibility = parseEligibility(values[GOOGLE_FORM_COLUMNS.ELIGIBILITY]);

    return {
        timestamp: values[GOOGLE_FORM_COLUMNS.TIMESTAMP] || new Date(),
        dateSaisie: values[GOOGLE_FORM_COLUMNS.DATE_SAISIE] || '',
        lastName: capitalizeName(values[GOOGLE_FORM_COLUMNS.NOM] || ''),
        firstName: capitalizeName(values[GOOGLE_FORM_COLUMNS.PRENOM] || ''),
        phone: String(values[GOOGLE_FORM_COLUMNS.TELEPHONE] || ''),
        phoneBis: values[GOOGLE_FORM_COLUMNS.TELEPHONE_BIS] ? String(values[GOOGLE_FORM_COLUMNS.TELEPHONE_BIS]) : '',
        email: values[GOOGLE_FORM_COLUMNS.EMAIL] || '',
        address: values[GOOGLE_FORM_COLUMNS.ADRESSE] || '',
        postalCode: String(values[GOOGLE_FORM_COLUMNS.CODE_POSTAL] || ''),
        city: values[GOOGLE_FORM_COLUMNS.VILLE] || '',
        seDeplace: parseSeDeplace(values[GOOGLE_FORM_COLUMNS.SE_DEPLACE]),
        nombreAdulte: parseInt(values[GOOGLE_FORM_COLUMNS.NOMBRE_ADULTE]) || 0,
        nombreEnfant: parseInt(values[GOOGLE_FORM_COLUMNS.NOMBRE_ENFANT]) || 0,
        criticite: parseInt(values[GOOGLE_FORM_COLUMNS.CRITICITE]) || 0,
        circonstances: values[GOOGLE_FORM_COLUMNS.CIRCONSTANCES] || '',
        ressentit: values[GOOGLE_FORM_COLUMNS.RESSENTIT] || '',
        specificites: values[GOOGLE_FORM_COLUMNS.SPECIFICITES] || '',
        zakatElFitr: eligibility.zakatElFitr,
        sadaqa: eligibility.sadaqa
    };
}

/**
 * Détecte si le formulaire est un INSERT ou UPDATE (formulaires avec ID famille)
 */
function detectFormType(formData, sheetName) {
    if (formData.familyId || formData.id) {
        logInfo('🆔 ID famille détecté - formulaire UPDATE');
        return 'UPDATE';
    }
    const updateKeywords = [
        'update', 'mise à jour', 'mise a jour', 'maj',
        'modification', 'تحديث', 'actualisation', 'modifier'
    ];
    if (updateKeywords.some(k => sheetName.toLowerCase().includes(k))) {
        logInfo('🔤 Mot-clé mise à jour détecté dans le nom de feuille - UPDATE');
        return 'UPDATE';
    }
    logInfo('➕ Aucun indicateur de mise à jour - INSERT');
    return 'INSERT';
}