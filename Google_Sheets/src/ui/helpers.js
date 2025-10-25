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

        // Validate criticite
        const criticite = parseInt(formData.criticite);
        if (isNaN(criticite) || criticite < CONFIG.CRITICITE.MIN || criticite > CONFIG.CRITICITE.MAX) {
            return {
                success: false,
                error: `Criticité invalide. Doit être entre ${CONFIG.CRITICITE.MIN} et ${CONFIG.CRITICITE.MAX}.`
            };
        }

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
            quartierName: addressValidation.quartierName,
            criticite: criticite
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

        logInfo('Manual entry processed successfully', { familyId, criticite });

        return {
            success: true,
            familyId: familyId,
            quartierId: addressValidation.quartierId,
            quartierName: addressValidation.quartierName,
            criticite: criticite
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

/**
 * Inclut le contenu d'un fichier (pour use avec <?!= include('file') ?> dans HTML)
 * @param {string} filename - Nom du fichier à inclure
 * @returns {string} Contenu du fichier
 */
function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Calculate statistics from famille sheet
 */
function calculateStatistics() {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
    if (!sheet) {
        return {
            total: 0,
            validated: 0,
            inProgress: 0,
            rejected: 0,
            totalAdults: 0,
            totalChildren: 0,
            byCriticite: {}
        };
    }

    const data = sheet.getDataRange().getValues();
    const stats = {
        total: data.length - 1,
        validated: 0,
        inProgress: 0,
        rejected: 0,
        totalAdults: 0,
        totalChildren: 0,
        byCriticite: {
            0: 0,
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0
        }
    };

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const status = row[OUTPUT_COLUMNS.ETAT_DOSSIER];
        const criticite = parseInt(row[OUTPUT_COLUMNS.CRITICITE]) || 0;

        if (status === CONFIG.STATUS.VALIDATED) stats.validated++;
        if (status === CONFIG.STATUS.IN_PROGRESS) stats.inProgress++;
        if (status === CONFIG.STATUS.REJECTED) stats.rejected++;

        stats.totalAdults += parseInt(row[OUTPUT_COLUMNS.NOMBRE_ADULTE]) || 0;
        stats.totalChildren += parseInt(row[OUTPUT_COLUMNS.NOMBRE_ENFANT]) || 0;

        if (criticite >= 0 && criticite <= 5) {
            stats.byCriticite[criticite]++;
        }
    }

    return stats;
}

/**
 * Clear all caches
 */
function clearAllCaches() {
    CacheService.getScriptCache().removeAll([]);
    SpreadsheetApp.getUi().alert('✅ Cache effacé avec succès');
}