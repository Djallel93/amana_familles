/**
 * @file unifiedFormHandler.js
 * @description Unified handler for all form submissions (INSERT and UPDATE)
 */

/**
 * Unified form submission handler
 * Automatically routes to INSERT or UPDATE processing based on form content
 * 
 * @param {Object} e - Form submit event object
 */
function onFormSubmit(e) {
    try {

        const sheet = e.range.getSheet();
        const sheetName = sheet.getName();
        const row = e.range.getRow();

        logInfo(`Processing sheet: ${sheetName}, row: ${row}`);

        // Ignore Famille sheet (output sheet)
        if (sheetName === CONFIG.SHEETS.FAMILLE_CLEANED) {
            logInfo('Ignoring Famille sheet - output only');
            return;
        }

        // Parse form data
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
        const formData = parseFormResponse(headers, values);

        // Auto-detect form type based on data content
        const formType = detectFormType(formData, sheetName);

        logInfo(`Detected form type: ${formType}`);

        // Route to appropriate handler
        if (formType === 'UPDATE') {
            processUpdate(formData, sheet, row);
        } else {
            processInsert(formData, sheet, row, sheetName);
        }

    } catch (error) {
        logError('Form submission processing failed', error);
        notifyAdminOfError(error);
    }
}

/**
 * Detect whether this is an INSERT or UPDATE form
 * 
 * @param {Object} formData - Parsed form data
 * @param {string} sheetName - Name of the sheet
 * @returns {string} - 'INSERT' or 'UPDATE'
 */
function detectFormType(formData, sheetName) {
    // Check 1: Does form data contain a family ID?
    const hasFamilyId = !!(formData.familyId || formData.id);

    if (hasFamilyId) {
        logInfo('Family ID detected in form data - UPDATE form');
        return 'UPDATE';
    }

    // Check 2: Sheet name contains update keywords?
    const updateKeywords = [
        'update',
        'mise à jour',
        'mise a jour',
        'maj',
        'modification',
        'تحديث', // Arabic: "Update"
        'actualisation',
        'modifier'
    ];

    const lowerName = sheetName.toLowerCase();
    const isUpdateSheet = updateKeywords.some(keyword => lowerName.includes(keyword));

    if (isUpdateSheet) {
        logInfo('Update keyword detected in sheet name - UPDATE form');
        return 'UPDATE';
    }

    // Default: INSERT form
    logInfo('No update indicators found - INSERT form');
    return 'INSERT';
}

/**
 * Process INSERT form submission (new family)
 * 
 * @param {Object} formData - Parsed form data
 * @param {Sheet} sheet - Source sheet
 * @param {number} row - Source row number
 * @param {string} sheetName - Sheet name
 */
function processInsert(formData, sheet, row, sheetName) {
    try {
        logInfo('Processing INSERT form submission');

        // Validate required fields
        const fieldValidation = validateRequiredFields(formData);
        if (!fieldValidation.isValid) {
            writeToFamilySheet(formData, {
                status: CONFIG.STATUS.REJECTED,
                comment: `Champs requis manquants: ${fieldValidation.errors.join(', ')}`,
                criticite: 0
            });
            notifyAdmin('Soumission rejetée', fieldValidation.errors.join(', '));
            return;
        }

        // Validate address
        logInfo('Validating address');
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
            notifyAdmin('Soumission rejetée', addressValidation.error);
            return;
        }

        logInfo('Address validated successfully');

        // Validate documents
        logInfo('Validating documents');
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
            notifyAdmin('Soumission rejetée', docValidation.errors.join(', '));
            return;
        }
        logInfo('Documents validated successfully');

        logInfo('Checking for duplicate family submissions');
        // Check for duplicates
        const duplicate = findDuplicateFamily(
            formData.phone,
            formData.lastName,
            formData.email
        );

        if (duplicate.exists) {
            updateExistingFamily(duplicate, formData, addressValidation, docValidation);
            notifyAdmin('Famille mise à jour', `ID: ${duplicate.id}`);
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
            notifyAdmin('Nouvelle soumission', `ID: ${familyId}`);
        }

        logInfo('INSERT form processed successfully');

    } catch (error) {
        logError('INSERT processing failed', error);
        throw error;
    }
}

/**
 * Process UPDATE form submission (existing family)
 * 
 * @param {Object} formData - Parsed form data
 * @param {Sheet} sheet - Source sheet
 * @param {number} row - Source row number
 */
function processUpdate(formData, sheet, row) {
    try {
        logInfo('Processing UPDATE form submission');

        // Extract family ID
        const familyId = formData.familyId || formData.id;

        if (!familyId) {
            logError('Update form missing family ID', { row });
            notifyAdmin('Update échouée', 'ID famille manquant dans le formulaire');
            return;
        }

        // Build update data (only non-empty fields)
        const updateData = buildUpdateData(formData);

        if (Object.keys(updateData).length === 0) {
            logError('Update form has no data to update', { familyId });
            notifyAdmin('Update échouée', `Aucune donnée à mettre à jour pour ${familyId}`);
            return;
        }

        // Validate update data
        const validation = validateUpdateData(updateData);
        if (!validation.isValid) {
            logError('Update validation failed', { familyId, error: validation.error });
            notifyAdmin('Update échouée', `${familyId}: ${validation.error}`);
            return;
        }

        // Perform the update
        const result = updateFamilyById(familyId, updateData);

        if (result.success) {
            logInfo('Update form processed successfully', {
                familyId,
                updatedFields: result.updatedFields
            });
            notifyAdmin(
                'Famille mise à jour via formulaire',
                `ID: ${familyId}\nChamps: ${result.updatedFields.join(', ')}`
            );
        } else {
            logError('Update form processing failed', { familyId, error: result.error });
            notifyAdmin('Update échouée', `ID: ${familyId}\nErreur: ${result.error}`);
        }

    } catch (error) {
        logError('UPDATE processing failed', error);
        throw error;
    }
}


/**
 * Build update data object from form data (only non-empty fields)
 * 
 * @param {Object} formData - Raw form data
 * @returns {Object} - Clean update data
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

        // Skip empty values
        if (value === undefined || value === null || value === '') {
            return;
        }

        // Parse numbers
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
 * 
 * @param {Object} updateData - Update data to validate
 * @returns {Object} - {isValid: boolean, error: string}
 */
function validateUpdateData(updateData) {
    // Validate email if provided
    if (updateData.email && !isValidEmail(updateData.email)) {
        return {
            isValid: false,
            error: 'Email invalide'
        };
    }

    // Validate phone if provided
    if (updateData.phone && !isValidPhone(updateData.phone)) {
        return {
            isValid: false,
            error: 'Téléphone invalide'
        };
    }

    // Validate criticite if provided
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

/**
 * Notify admin of new submission or error
 */
function notifyAdmin(subject, message) {
    logInfo(`ADMIN NOTIFICATION: ${subject}`, message);
}

/**
 * Notify admin of processing error
 */
function notifyAdminOfError(error) {
    notifyAdmin('Erreur de traitement', error.toString());
}