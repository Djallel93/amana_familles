/**
 * @file src/ui/helpers.js
 * @description UI utility functions for manual entry
 */

/**
 * Process manual family entry (called from UI)
 */
function processManualEntry(formData) {
    try {
        logInfo('Processing manual entry', formData);

        const fieldValidation = validateRequiredFields(formData);
        if (!fieldValidation.isValid) {
            return {
                success: false,
                error: `Champs requis manquants: ${fieldValidation.errors.join(', ')}`
            };
        }

        const addressValidation = validateAddressAndGetQuartier(
            formData.address,
            formData.postalCode,
            formData.city
        );

        if (!addressValidation.isValid) {
            return {
                success: false,
                error: `Adresse invalide: ${addressValidation.error}`
            };
        }

        const duplicate = findDuplicateFamily(
            formData.phone,
            formData.lastName,
            formData.email
        );

        if (duplicate.exists) {
            return {
                success: false,
                warning: true,
                duplicate: true,
                message: `Une famille avec ce téléphone et nom existe déjà (ID: ${duplicate.id})`,
                familyId: duplicate.id
            };
        }

        const familyId = writeToFamilySheet(formData, {
            status: CONFIG.STATUS.VALIDATED,
            familyId: generateFamilyId(),
            quartierId: addressValidation.quartierId,
            quartierName: addressValidation.quartierName
        });

        const contactData = {
            id: familyId,
            nom: formData.lastName,
            prenom: formData.firstName,
            email: formData.email,
            telephone: formData.phone,
            phoneBis: formData.phoneBis,
            adresse: formData.address
        };

        syncFamilyContact(contactData);

        logInfo('Manual entry processed successfully', { familyId });

        return {
            success: true,
            familyId: familyId,
            quartierId: addressValidation.quartierId,
            quartierName: addressValidation.quartierName
        };

    } catch (error) {
        logError('Manual entry processing failed', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Update manually entered family if form submitted later
 */
function updateManualEntryWithFormData(manualFamilyId, formData, docValidation) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
    if (!sheet) return false;

    const data = sheet.getDataRange().getValues();
    let targetRow = -1;

    for (let i = 1; i < data.length; i++) {
        if (data[i][OUTPUT_COLUMNS.ID] === manualFamilyId) {
            targetRow = i + 1;
            break;
        }
    }

    if (targetRow === -1) {
        logError('Manual family not found', manualFamilyId);
        return false;
    }

    if (docValidation.identityIds.length > 0) {
        sheet.getRange(targetRow, OUTPUT_COLUMNS.IDENTITE + 1).setValue(
            formatDocumentLinks(docValidation.identityIds)
        );
    }

    if (docValidation.cafIds.length > 0) {
        sheet.getRange(targetRow, OUTPUT_COLUMNS.CAF + 1).setValue(
            formatDocumentLinks(docValidation.cafIds)
        );
    }

    organizeDocuments(
        manualFamilyId,
        docValidation.identityIds,
        docValidation.cafIds,
        docValidation.resourceIds
    );

    const existingComment = data[targetRow - 1][OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';
    const newComment = `${existingComment}\nDocuments ajoutés via formulaire - ${new Date().toLocaleString('fr-FR')}`;
    sheet.getRange(targetRow, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);

    logInfo('Manual entry updated with form documents', manualFamilyId);
    return true;
}