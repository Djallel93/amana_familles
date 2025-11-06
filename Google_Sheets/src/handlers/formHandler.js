/**
 * @file src/handlers/formHandler.js (REFACTORED)
 * @description Unified form submission handler with quartier validation
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

        // Parse form data
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
        const formData = parseFormResponse(headers, values);

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
            processUpdate(formData, sheet, row);
        } else {
            processInsert(formData, sheet, row, sheetName);
        }

    } catch (error) {
        logError('❌ Form submission processing failed', error);
        notifyAdmin('❌ Form Processing Error', `Error: ${error.toString()}\nSheet: ${e.range.getSheet().getName()}\nRow: ${e.range.getRow()}`);
    }
}

/**
 * Detect if form is INSERT or UPDATE
 */
function detectFormType(formData, sheetName) {
    // Check for family ID
    const hasFamilyId = !!(formData.familyId || formData.id);

    if (hasFamilyId) {
        logInfo('🆔 Family ID detected - UPDATE form');
        return 'UPDATE';
    }

    // Check sheet name for update keywords
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
 * Process INSERT submission (new family)
 */
function processInsert(formData, sheet, row, sheetName) {
    try {
        logInfo('➕ Processing INSERT submission');

        // Validate required fields
        const fieldValidation = validateRequiredFields(formData);
        if (!fieldValidation.isValid) {
            writeToFamilySheet(formData, {
                status: CONFIG.STATUS.REJECTED,
                comment: `Champs requis manquants: ${fieldValidation.errors.join(', ')}`,
                criticite: 0
            });
            notifyAdmin('⚠️ Submission Rejected', `Reason: ${fieldValidation.errors.join(', ')}\nName: ${formData.lastName} ${formData.firstName}`);
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
            writeToFamilySheet(formData, {
                status: CONFIG.STATUS.REJECTED,
                comment: `Adresse invalide: ${addressValidation.error}`,
                criticite: 0
            });
            notifyAdmin('⚠️ Submission Rejected', `Invalid address\nFamily: ${formData.lastName} ${formData.firstName}\nAddress: ${formData.address}`);
            return;
        }

        logInfo('✅ Address validated successfully');

        // NEW: Check if quartier is invalid in GEO API
        let status = CONFIG.STATUS.IN_PROGRESS;
        let comment = '';

        if (addressValidation.quartierInvalid) {
            status = CONFIG.STATUS.IN_PROGRESS; // Keep as in-progress
            comment = `⚠️ ATTENTION: ${addressValidation.warning}\n` +
                `Quartier ID "${addressValidation.quartierId}" n'existe pas dans l'API GEO.\n` +
                `Vérifier l'adresse avant validation.`;

            logWarning(`Quartier invalid for new family: ${addressValidation.quartierId}`);
        }

        // Validate documents
        logInfo('📄 Validating documents');
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
            notifyAdmin('⚠️ Submission Rejected', `Invalid documents\nFamily: ${formData.lastName} ${formData.firstName}\nErrors: ${docValidation.errors.join(', ')}`);
            return;
        }
        logInfo('✅ Documents validated successfully');

        // Check for duplicates
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
                cafIds: docValidation.cafIds,
                resourceIds: docValidation.resourceIds,
                criticite: 0
            });

            const notificationMsg = `ID: ${familyId}\nName: ${formData.lastName} ${formData.firstName}\n` +
                `Phone: ${normalizePhone(formData.phone)}\n` +
                `Address: ${formData.address}, ${formData.postalCode} ${formData.city}\n` +
                `Quartier: ${addressValidation.quartierName || 'Non assigné'}` +
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
function processUpdate(formData, sheet, row) {
    try {
        logInfo('✏️ Processing UPDATE submission');

        const familyId = formData.familyId || formData.id;

        if (!familyId) {
            logError('❌ Update form without family ID', { row });
            notifyAdmin('❌ Update Failed', `Missing family ID in form\nRow: ${row}`);
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
        criticite: 'criticite'
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
 * Validate update data
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

    return { isValid: true };
}