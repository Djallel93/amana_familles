/**
 * @file src/handlers/formHandler.js (UPDATED)
 * @description Unified form submission handler with AME support and validation requirements
 */

/**
 * Unified form submission handler
 */
function onFormSubmit(e) {
    try {
        const sheet = e.range.getSheet();
        const sheetName = sheet.getName();
        const row = e.range.getRow();

        logInfo(`📋 Processing sheet: ${sheetName}, row: ${row}`);

        // Ignore output sheet
        if (sheetName === CONFIG.SHEETS.FAMILLE) {
            logInfo('⏭️ Famille sheet ignored - output only');
            return;
        }

        // Detect language from sheet name
        const detectedLanguage = detectLanguageFromSheet(sheetName);

        // Check if this is the Google Form sheet
        if (sheetName === CONFIG.SHEETS.GOOGLE_FORM) {
            processGoogleFormSubmission(sheet, row, detectedLanguage);
            return;
        }

        // Otherwise, process as multilingual form (FR/AR/EN/UPDATE)
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
        const formData = parseFormResponse(headers, values);

        // Add detected language to formData
        formData.langue = detectedLanguage;

        // Check consent refusal
        if (isConsentRefused(formData)) {
            logInfo('🚫 Submission ignored: user refused consent');
            return;
        }

        // Detect form type
        const formType = detectFormType(formData, sheetName);
        logInfo(`🎯 Form type detected: ${formType}`);

        // Route to appropriate handler
        if (formType === 'UPDATE') {
            processUpdate(formData);
        } else {
            processInsert(formData);
        }

    } catch (error) {
        logError('❌ Form submission processing failed', error);
        notifyAdmin('❌ Form Processing Error', `Error: ${error.toString()}\nSheet: ${e.range.getSheet().getName()}\nRow: ${e.range.getRow()}`);
    }
}

/**
 * Process Google Form submission (insert-only, no documents)
 */
function processGoogleFormSubmission(sheet, row, language = CONFIG.LANGUAGES.FR) {
    try {
        logInfo('📱 Processing Google Form submission');

        const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
        const formData = parseGoogleFormData(values);

        // Add language
        formData.langue = language;

        // Add status column for tracking
        const statusColumn = sheet.getLastColumn() + 1;
        sheet.getRange(row, statusColumn).setValue('⚙️ En cours...');

        // Validate required fields
        const fieldValidation = validateRequiredFields(formData);
        if (!fieldValidation.isValid) {
            const errorMessage = `Champs requis manquants: ${fieldValidation.errors.join(', ')}`;
            sheet.getRange(row, statusColumn).setValue(`❌ ${errorMessage}`);

            writeToFamilySheet(formData, {
                status: CONFIG.STATUS.REJECTED,
                comment: errorMessage,
                criticite: 0,
                langue: language
            });

            notifyAdmin(
                '⚠️ Google Form Rejected',
                `Reason: ${fieldValidation.errors.join(', ')}\nName: ${formData.lastName} ${formData.firstName}`
            );
            return;
        }

        // Validate address
        logInfo('🏠 Validating address');
        const addressValidation = validateAddressAndGetQuartier(
            formData.address,
            formData.postalCode,
            formData.city
        );

        if (!addressValidation.isValid) {
            const errorMessage = `Adresse invalide: ${addressValidation.error}`;
            sheet.getRange(row, statusColumn).setValue(`❌ ${errorMessage}`);

            writeToFamilySheet(formData, {
                status: CONFIG.STATUS.REJECTED,
                comment: errorMessage,
                criticite: 0,
                langue: language
            });

            notifyAdmin(
                '⚠️ Google Form Rejected',
                `Invalid address\nFamily: ${formData.lastName} ${formData.firstName}\nAddress: ${formData.address}`
            );
            return;
        }

        logInfo('✅ Address validated successfully');

        let status = CONFIG.STATUS.IN_PROGRESS;
        let comment = `Soumis via Google Form le ${new Date().toLocaleString('fr-FR')}`;

        if (addressValidation.quartierInvalid) {
            comment += `\n⚠️ ${addressValidation.warning}`;
            logWarning(`Quartier invalid for Google Form: ${addressValidation.quartierId}`);
        }

        // Check duplicates
        logInfo('🔍 Checking for duplicates');
        const duplicate = findDuplicateFamily(
            formData.phone,
            formData.lastName,
            formData.email
        );

        if (duplicate.exists) {
            updateExistingFamily(duplicate, formData, addressValidation, { identityIds: [], aidesEtatIds: [], resourceIds: [] });
            sheet.getRange(row, statusColumn).setValue(`✅ Mis à jour: ${duplicate.id}`);

            notifyAdmin(
                '🔄 Family Updated (Google Form)',
                `ID: ${duplicate.id}\nName: ${formData.lastName} ${formData.firstName}\nPhone: ${normalizePhone(formData.phone)}\nLanguage: ${language}`
            );
        } else {
            const familyId = generateFamilyId();

            writeToFamilySheet(formData, {
                status: status,
                comment: comment,
                familyId: familyId,
                quartierId: addressValidation.quartierId,
                quartierName: addressValidation.quartierName,
                identityIds: [],
                aidesEtatIds: [], // UPDATED
                resourceIds: [],
                criticite: formData.criticite,
                langue: language
            });

            sheet.getRange(row, statusColumn).setValue(`✅ Créé: ${familyId}`);

            const notificationMsg = `ID: ${familyId}\nName: ${formData.lastName} ${formData.firstName}\n` +
                `Phone: ${normalizePhone(formData.phone)}\n` +
                `Address: ${formData.address}, ${formData.postalCode} ${formData.city}\n` +
                `Quartier: ${addressValidation.quartierName || 'Non assigné'}\n` +
                `Criticité: ${formData.criticite}\n` +
                `Language: ${language}` +
                (addressValidation.quartierInvalid ? `\n\n⚠️ WARNING: Quartier ID invalid` : '');

            notifyAdmin('✅ New Submission (Google Form)', notificationMsg);
        }

        logInfo('✅ Google Form processed successfully');

    } catch (error) {
        logError('❌ Google Form processing failed', error);

        const statusColumn = sheet.getLastColumn();
        sheet.getRange(row, statusColumn).setValue(`❌ Erreur: ${error.toString()}`);

        notifyAdmin('❌ Google Form Error', `Error: ${error.toString()}`);
    }
}

/**
 * Parse Google Form submission data
 */
function parseGoogleFormData(values) {
    return {
        timestamp: values[GOOGLE_FORM_COLUMNS.TIMESTAMP] || new Date(),
        dateSaisie: values[GOOGLE_FORM_COLUMNS.DATE_SAISIE] || '',
        lastName: values[GOOGLE_FORM_COLUMNS.NOM] || '',
        firstName: values[GOOGLE_FORM_COLUMNS.PRENOM] || '',
        phone: String(values[GOOGLE_FORM_COLUMNS.TELEPHONE] || ''),
        phoneBis: values[GOOGLE_FORM_COLUMNS.TELEPHONE_BIS] ? String(values[GOOGLE_FORM_COLUMNS.TELEPHONE_BIS]) : '',
        email: values[GOOGLE_FORM_COLUMNS.EMAIL] || '',
        address: values[GOOGLE_FORM_COLUMNS.ADRESSE] || '',
        postalCode: String(values[GOOGLE_FORM_COLUMNS.CODE_POSTAL] || ''),
        city: values[GOOGLE_FORM_COLUMNS.VILLE] || '',
        nombreAdulte: parseInt(values[GOOGLE_FORM_COLUMNS.NOMBRE_ADULTE]) || 0,
        nombreEnfant: parseInt(values[GOOGLE_FORM_COLUMNS.NOMBRE_ENFANT]) || 0,
        criticite: parseInt(values[GOOGLE_FORM_COLUMNS.CRITICITE]) || 0,
        circonstances: values[GOOGLE_FORM_COLUMNS.CIRCONSTANCES] || '',
        ressentit: values[GOOGLE_FORM_COLUMNS.RESSENTIT] || '',
        specificites: values[GOOGLE_FORM_COLUMNS.SPECIFICITES] || ''
    };
}

/**
 * Detect if form is INSERT or UPDATE
 */
function detectFormType(formData, sheetName) {
    const hasFamilyId = !!(formData.familyId || formData.id);

    if (hasFamilyId) {
        logInfo('🆔 Family ID detected - UPDATE form');
        return 'UPDATE';
    }

    const updateKeywords = [
        'update', 'mise à jour', 'mise a jour', 'maj', 'modification',
        'تحديث', 'actualisation', 'modifier'
    ];

    const lowerName = sheetName.toLowerCase();
    const isUpdateSheet = updateKeywords.some(keyword => lowerName.includes(keyword));

    if (isUpdateSheet) {
        logInfo('🔤 Update keyword detected in sheet name - UPDATE form');
        return 'UPDATE';
    }

    logInfo('➕ No update indicator found - INSERT form');
    return 'INSERT';
}

/**
 * Process INSERT submission (new family) - UPDATED with AME
 */
function processInsert(formData) {
    try {
        logInfo('➕ Processing INSERT submission');

        const fieldValidation = validateRequiredFields(formData);
        if (!fieldValidation.isValid) {
            writeToFamilySheet(formData, {
                status: CONFIG.STATUS.REJECTED,
                comment: `Champs requis manquants: ${fieldValidation.errors.join(', ')}`,
                criticite: 0,
                langue: formData.langue || CONFIG.LANGUAGES.FR
            });
            notifyAdmin('⚠️ Submission Rejected', `Reason: ${fieldValidation.errors.join(', ')}\nName: ${formData.lastName} ${formData.firstName}`);
            return;
        }

        logInfo('🏠 Validating address');
        const addressValidation = validateAddressAndGetQuartier(
            formData.address,
            formData.postalCode,
            formData.city
        );

        if (!addressValidation.isValid) {
            writeToFamilySheet(formData, {
                status: CONFIG.STATUS.REJECTED,
                comment: `Adresse invalide: ${addressValidation.error}`,
                criticite: 0,
                langue: formData.langue || CONFIG.LANGUAGES.FR
            });
            notifyAdmin('⚠️ Submission Rejected', `Invalid address\nFamily: ${formData.lastName} ${formData.firstName}\nAddress: ${formData.address}`);
            return;
        }

        logInfo('✅ Address validated successfully');

        let status = CONFIG.STATUS.IN_PROGRESS;
        let comment = '';

        if (addressValidation.quartierInvalid) {
            status = CONFIG.STATUS.IN_PROGRESS;
            comment = `⚠️ ATTENTION: ${addressValidation.warning}\n` +
                `Quartier ID "${addressValidation.quartierId}" n'existe pas dans l'API GEO.\n` +
                `Vérifier l'adresse avant validation.`;

            logWarning(`Quartier invalid for new family: ${addressValidation.quartierId}`);
        }

        logInfo('📄 Validating documents');
        // UPDATED: Both CAF and AME documents go to aidesEtatDoc field
        const docValidation = validateDocuments(
            formData.identityDoc,
            formData.aidesEtatDoc, // Handles both CAF and AME
            formData.resourceDoc
        );

        if (!docValidation.isValid) {
            writeToFamilySheet(formData, {
                status: CONFIG.STATUS.REJECTED,
                comment: `Documents invalides: ${docValidation.errors.join(', ')}`,
                quartierId: addressValidation.quartierId,
                criticite: 0,
                langue: formData.langue || CONFIG.LANGUAGES.FR
            });
            notifyAdmin('⚠️ Submission Rejected', `Invalid documents\nFamily: ${formData.lastName} ${formData.firstName}\nErrors: ${docValidation.errors.join(', ')}`);
            return;
        }
        logInfo('✅ Documents validated successfully');

        logInfo('🔍 Checking for duplicates');
        const duplicate = findDuplicateFamily(
            formData.phone,
            formData.lastName,
            formData.email
        );

        if (duplicate.exists) {
            updateExistingFamily(duplicate, formData, addressValidation, docValidation);
            notifyAdmin('🔄 Family Updated', `ID: ${duplicate.id}\nName: ${formData.lastName} ${formData.firstName}\nPhone: ${normalizePhone(formData.phone)}`);
        } else {
            const familyId = generateFamilyId();
            writeToFamilySheet(formData, {
                status: status,
                comment: comment,
                familyId: familyId,
                quartierId: addressValidation.quartierId,
                quartierName: addressValidation.quartierName,
                identityIds: docValidation.identityIds,
                aidesEtatIds: docValidation.aidesEtatIds, // UPDATED from cafIds
                resourceIds: docValidation.resourceIds,
                criticite: 0,
                langue: formData.langue || CONFIG.LANGUAGES.FR
            });

            const notificationMsg = `ID: ${familyId}\nName: ${formData.lastName} ${formData.firstName}\n` +
                `Phone: ${normalizePhone(formData.phone)}\n` +
                `Address: ${formData.address}, ${formData.postalCode} ${formData.city}\n` +
                `Quartier: ${addressValidation.quartierName || 'Non assigné'}\n` +
                `Language: ${formData.langue || CONFIG.LANGUAGES.FR}` +
                (addressValidation.quartierInvalid ? `\n\n⚠️ WARNING: Quartier ID invalid in GEO API` : '');

            notifyAdmin('✅ New Submission', notificationMsg);
        }

        logInfo('✅ INSERT submission processed successfully');

    } catch (error) {
        logError('❌ INSERT processing failed', error);
        notifyAdmin('❌ INSERT Error', `Error: ${error.toString()}\nFamily: ${formData.lastName} ${formData.firstName}`);
        throw error;
    }
}

/**
 * Process UPDATE submission (existing family)
 */
function processUpdate(formData) {
    try {
        logInfo('✏️ Processing UPDATE submission');

        const familyId = formData.familyId || formData.id;

        if (!familyId) {
            logError('❌ Update form without family ID');
            notifyAdmin('❌ Update Failed', 'Missing family ID in form');
            return;
        }

        const updateData = buildUpdateData(formData);

        if (Object.keys(updateData).length === 0) {
            logError('❌ Update form without data', { familyId });
            notifyAdmin('❌ Update Failed', `No data to update for ${familyId}`);
            return;
        }

        const validation = validateUpdateData(updateData);
        if (!validation.isValid) {
            logError('❌ Update validation failed', { familyId, error: validation.error });
            notifyAdmin('❌ Update Failed', `${familyId}: ${validation.error}`);
            return;
        }

        const result = updateFamilyById(familyId, updateData);

        if (result.success) {
            logInfo('✅ Update form processed successfully', {
                familyId,
                updatedFields: result.updatedFields
            });
            notifyAdmin(
                '✅ Family Updated via Form',
                `ID: ${familyId}\nUpdated fields: ${result.updatedFields.join(', ')}`
            );
        } else {
            logError('❌ Update processing failed', { familyId, error: result.error });
            notifyAdmin('❌ Update Failed', `ID: ${familyId}\nError: ${result.error}`);
        }

    } catch (error) {
        logError('❌ UPDATE processing failed', error);
        notifyAdmin('❌ UPDATE Error', `Error: ${error.toString()}`);
        throw error;
    }
}

/**
 * Build update data object from form data
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
        criticite: 'criticite',
        langue: 'langue'
    };

    Object.keys(fieldMapping).forEach(key => {
        const value = formData[key];

        if (value === undefined || value === null || value === '') {
            return;
        }

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
 * Validate update data (UPDATED with full language names)
 */
function validateUpdateData(updateData) {
    if (updateData.email && !isValidEmail(updateData.email)) {
        return { isValid: false, error: 'Email invalide' };
    }

    if (updateData.phone && !isValidPhone(updateData.phone)) {
        return { isValid: false, error: 'Téléphone invalide' };
    }

    if (updateData.criticite !== undefined) {
        if (isNaN(updateData.criticite) ||
            updateData.criticite < CONFIG.CRITICITE.MIN ||
            updateData.criticite > CONFIG.CRITICITE.MAX) {
            return { isValid: false, error: 'Criticité invalide (doit être entre 0 et 5)' };
        }
    }

    // UPDATED: Check for full language names
    if (updateData.langue && !['Français', 'Arabe', 'Anglais'].includes(updateData.langue)) {
        return { isValid: false, error: 'Langue invalide (doit être: Français, Arabe, ou Anglais)' };
    }

    return { isValid: true };
}