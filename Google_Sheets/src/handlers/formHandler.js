/**
 * @file src/handlers/formHandler.js
 * @description Process form submissions from multiple languages
 */

/**
 * Main form submission handler (triggered by onFormSubmit)
 */
function handleFormSubmission(e) {
    try {
        logInfo('Form submission received');

        const sheet = e.range.getSheet();
        const sheetName = sheet.getName();

        if (!Object.values(CONFIG.SHEETS).includes(sheetName) ||
            sheetName === CONFIG.SHEETS.FAMILLE_CLEANED) {
            logInfo(`Ignoring sheet: ${sheetName}`);
            return;
        }

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const row = e.range.getRow();
        const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

        const formData = parseFormResponse(headers, values);

        processFormSubmission(formData, sheetName, row);

    } catch (error) {
        logError('Form submission processing failed', error);
        notifyAdminOfError(error);
    }
}

/**
 * Process parsed form submission
 */
function processFormSubmission(formData, sourceSheet, sourceRow) {
    logInfo('Processing form submission', { sourceSheet, sourceRow });

    const fieldValidation = validateRequiredFields(formData);
    if (!fieldValidation.isValid) {
        writeToFamilySheet(formData, {
            status: CONFIG.STATUS.REJECTED,
            comment: `Champs requis manquants: ${fieldValidation.errors.join(', ')}`
        });
        notifyAdmin('Soumission rejetée', fieldValidation.errors.join(', '));
        return;
    }

    const addressValidation = validateAddressAndGetQuartier(
        formData.address,
        formData.postalCode,
        formData.city
    );

    if (!addressValidation.isValid) {
        writeToFamilySheet(formData, {
            status: CONFIG.STATUS.REJECTED,
            comment: `Adresse invalide: ${addressValidation.error}`
        });
        notifyAdmin('Soumission rejetée', addressValidation.error);
        return;
    }

    const docValidation = validateDocuments(
        formData.identityDoc,
        formData.cafDoc || formData.cafDocOptional,
        formData.resourceDoc
    );

    if (!docValidation.isValid) {
        writeToFamilySheet(formData, {
            status: CONFIG.STATUS.REJECTED,
            comment: `Documents invalides: ${docValidation.errors.join(', ')}`,
            quartierId: addressValidation.quartierId
        });
        notifyAdmin('Soumission rejetée', docValidation.errors.join(', '));
        return;
    }

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
            resourceIds: docValidation.resourceIds
        });
        notifyAdmin('Nouvelle soumission', `ID: ${familyId}`);
    }
}

/**
 * Write data to Famille (Cleaned & Enriched) sheet
 */
function writeToFamilySheet(formData, options = {}) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
    if (!sheet) {
        throw new Error('Famille sheet not found');
    }

    const {
        status = CONFIG.STATUS.IN_PROGRESS,
        comment = '',
        familyId = generateFamilyId(),
        quartierId = null,
        quartierName = '',
        identityIds = [],
        cafIds = [],
        resourceIds = []
    } = options;

    const row = Array(20).fill('');
    row[OUTPUT_COLUMNS.ID] = familyId;
    row[OUTPUT_COLUMNS.NOM] = formData.lastName || '';
    row[OUTPUT_COLUMNS.PRENOM] = formData.firstName || '';
    row[OUTPUT_COLUMNS.ZAKAT_EL_FITR] = false;
    row[OUTPUT_COLUMNS.SADAQA] = false;
    row[OUTPUT_COLUMNS.NOMBRE_ADULTE] = parseInt(formData.nombreAdulte) || 0;
    row[OUTPUT_COLUMNS.NOMBRE_ENFANT] = parseInt(formData.nombreEnfant) || 0;
    row[OUTPUT_COLUMNS.ADRESSE] = formData.address || '';
    row[OUTPUT_COLUMNS.ID_QUARTIER] = quartierId || '';
    row[OUTPUT_COLUMNS.SE_DEPLACE] = false;
    row[OUTPUT_COLUMNS.EMAIL] = formData.email || '';
    row[OUTPUT_COLUMNS.TELEPHONE] = normalizePhone(formData.phone);
    row[OUTPUT_COLUMNS.TELEPHONE_BIS] = normalizePhone(formData.phoneBis) || '';
    row[OUTPUT_COLUMNS.IDENTITE] = formatDocumentLinks(identityIds);
    row[OUTPUT_COLUMNS.CAF] = formatDocumentLinks(cafIds);
    row[OUTPUT_COLUMNS.CIRCONSTANCES] = formData.circonstances || '';
    row[OUTPUT_COLUMNS.RESSENTIT] = '';
    row[OUTPUT_COLUMNS.SPECIFICITES] = '';
    row[OUTPUT_COLUMNS.ETAT_DOSSIER] = status;
    row[OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] = comment;

    sheet.appendRow(row);

    const cache = CacheService.getScriptCache();
    const cacheKey = `dup_${normalizePhone(formData.phone)}_${formData.lastName.toLowerCase().trim()}`;
    cache.remove(cacheKey);

    logInfo('Family written to sheet', { familyId, status });

    return familyId;
}

/**
 * Update existing family record
 */
function updateExistingFamily(duplicate, formData, addressValidation, docValidation) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
    if (!sheet) return;

    const row = duplicate.row;
    const existingData = duplicate.data;
    const changes = [];

    const newPhone = normalizePhone(formData.phone);
    const oldPhone = normalizePhone(existingData[OUTPUT_COLUMNS.TELEPHONE]);
    if (newPhone !== oldPhone) {
        sheet.getRange(row, OUTPUT_COLUMNS.TELEPHONE + 1).setValue(newPhone);
        changes.push('téléphone');
    }

    const newAddress = formData.address || '';
    const oldAddress = existingData[OUTPUT_COLUMNS.ADRESSE] || '';
    if (newAddress !== oldAddress) {
        sheet.getRange(row, OUTPUT_COLUMNS.ADRESSE + 1).setValue(newAddress);
        sheet.getRange(row, OUTPUT_COLUMNS.ID_QUARTIER + 1).setValue(addressValidation.quartierId || '');
        changes.push('adresse');
    }

    if (docValidation.identityIds.length > 0) {
        sheet.getRange(row, OUTPUT_COLUMNS.IDENTITE + 1).setValue(formatDocumentLinks(docValidation.identityIds));
        changes.push('documents');
    }

    if (docValidation.cafIds.length > 0) {
        sheet.getRange(row, OUTPUT_COLUMNS.CAF + 1).setValue(formatDocumentLinks(docValidation.cafIds));
        changes.push('CAF');
    }

    if (formData.email) {
        const newEmail = formData.email.toLowerCase().trim();
        const oldEmail = (existingData[OUTPUT_COLUMNS.EMAIL] || '').toLowerCase().trim();
        if (newEmail !== oldEmail) {
            sheet.getRange(row, OUTPUT_COLUMNS.EMAIL + 1).setValue(formData.email);
            changes.push('email');
        }
    }

    const comment = `Mis à jour: ${changes.join(', ')} - ${new Date().toLocaleString('fr-FR')}`;
    const existingComment = existingData[OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';
    sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(
        existingComment + '\n' + comment
    );

    sheet.getRange(row, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).setValue(CONFIG.STATUS.IN_PROGRESS);

    logInfo('Family updated', { id: duplicate.id, changes });
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