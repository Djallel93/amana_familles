/**
 * @file src/ui/helpers.js (UPDATED v3.0)
 * @description UI helpers using canonical address formatting
 * CHANGE: Uses formatAddressCanonical throughout
 */

/**
 * Auto-format row in Famille sheet (resize columns and rows)
 * @param {Sheet} sheet - Sheet object
 * @param {number} row - Row number to format
 */
function autoFormatFamilleRow(sheet, row) {
    try {
        const numColumns = sheet.getLastColumn();

        for (let col = 1; col <= numColumns; col++) {
            sheet.autoResizeColumn(col);

            const currentWidth = sheet.getColumnWidth(col);
            if (currentWidth < 80) {
                sheet.setColumnWidth(col, 80);
            }

            if (currentWidth > 400) {
                sheet.setColumnWidth(col, 400);
            }
        }

        sheet.autoResizeRows(row, 1);

        logInfo(`Formatted row ${row} in ${sheet.getName()}`);

    } catch (error) {
        logWarning(`Failed to auto-format row ${row}`, error);
    }
}

/**
 * Process manual entry with eligibility checkboxes
 * @param {Object} formData - Form data from UI
 * @returns {Object} {success: boolean, familyId?: string, error?: string, ...}
 */
function processManualEntry(formData) {
    try {
        logInfo('Processing manual entry', formData);

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

        const duplicate = findDuplicateFamily(
            formData.phone,
            formData.lastName,
            formData.email
        );

        if (duplicate.exists) {
            const familyId = generateFamilyId();
            const comment = formatComment('🚫', `Doublon détecté - Famille existante ID: ${duplicate.id}`);
            const langue = formData.langue || CONFIG.LANGUAGES.FR;

            const rowNumber = writeToFamilySheet(formData, {
                status: CONFIG.STATUS.REJECTED,
                comment: comment,
                familyId: familyId,
                quartierId: null,
                quartierName: null,
                criticite: criticite,
                langue: langue,
                zakatElFitr: formData.zakatElFitr || false,
                sadaqa: formData.sadaqa || false,
                seDeplace: formData.seDeplace || false
            });

            const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
            if (sheet) {
                autoFormatFamilleRow(sheet, rowNumber);
            }

            notifyAdmin(
                '🚫 Doublon détecté',
                `Nouvelle tentative d'inscription rejetée\nID créé: ${familyId}\nFamille existante: ${duplicate.id}\nNom: ${formData.lastName} ${formData.firstName}\nTéléphone: ${normalizePhone(formData.phone)}\nLangue: ${langue}`
            );

            return {
                success: false,
                warning: true,
                duplicate: true,
                message: `Une famille avec ce téléphone et nom existe déjà (ID: ${duplicate.id})`,
                familyId: duplicate.id,
                newId: familyId
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

        const familyId = generateFamilyId();
        let status = CONFIG.STATUS.IN_PROGRESS;
        const langue = formData.langue || CONFIG.LANGUAGES.FR;

        let comment = formatComment('➕', 'Créé manuellement');

        if (addressValidation.quartierInvalid) {
            appendSheetComment(sheet, row, '⚠️', addressValidation.warning);
        }

        const rowNumber = writeToFamilySheet(formData, {
            status: status,
            comment: comment,
            familyId: familyId,
            quartierId: addressValidation.quartierId,
            quartierName: addressValidation.quartierName,
            criticite: criticite,
            langue: langue,
            zakatElFitr: formData.zakatElFitr || false,
            sadaqa: formData.sadaqa || false,
            seDeplace: formData.seDeplace || false
        });

        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (sheet) {
            autoFormatFamilleRow(sheet, rowNumber);
        }

        notifyAdmin(
            '✅ Nouvelle famille ajoutée manuellement',
            `ID: ${familyId}\nNom: ${formData.lastName} ${formData.firstName}\nTéléphone: ${normalizePhone(formData.phone)}\nAdresse: ${formData.address}, ${formData.postalCode} ${formData.city}\nQuartier: ${addressValidation.quartierName || 'Non assigné'}\nCriticité: ${criticite}\nLangue: ${langue}\nZakat El Fitr: ${formData.zakatElFitr ? 'Oui' : 'Non'}\nSadaqa: ${formData.sadaqa ? 'Oui' : 'Non'}\nSe Déplace: ${formData.seDeplace ? 'Oui' : 'Non'}\n\n⚠️ Statut: En cours (nécessite validation manuelle)`
        );

        logInfo('Manual entry processed successfully', { familyId, criticite, status, langue });

        return {
            success: true,
            familyId: familyId,
            quartierId: addressValidation.quartierId,
            quartierName: addressValidation.quartierName,
            criticite: criticite,
            langue: langue,
            zakatElFitr: formData.zakatElFitr || false,
            sadaqa: formData.sadaqa || false,
            seDeplace: formData.seDeplace || false,
            status: status,
            message: `Famille créée avec succès. Changez le statut à "Validé" pour créer le contact Google.`
        };

    } catch (error) {
        logError('Manual entry processing failed', error);
        notifyAdmin('❌ Erreur d\'entrée manuelle', `Erreur: ${error.toString()}\nFamille: ${formData.lastName} ${formData.firstName}`);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Update manual entry if form is submitted later with documents
 * @param {string} manualFamilyId - Family ID
 * @param {Object} formData - Form data
 * @param {Object} docValidation - Document validation result
 * @returns {boolean} Success status
 */
function updateManualEntryWithFormData(manualFamilyId, formData, docValidation) {
    const result = findFamilyRowById(manualFamilyId);

    if (!result) {
        logError('Manual family not found', manualFamilyId);
        return false;
    }

    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) return false;

    const targetRow = result.row;

    if (docValidation.identityIds.length > 0) {
        updateFamilyCell(targetRow - 1, OUTPUT_COLUMNS.IDENTITE, formatDocumentLinks(docValidation.identityIds));
    }

    if (docValidation.aidesEtatIds.length > 0) {
        updateFamilyCell(targetRow - 1, OUTPUT_COLUMNS.AIDES_ETAT, formatDocumentLinks(docValidation.aidesEtatIds));
    }

    organizeDocuments(
        manualFamilyId,
        docValidation.identityIds,
        docValidation.aidesEtatIds,
        docValidation.resourceIds
    );

    appendSheetComment(sheet, targetRow, '📄', 'Documents ajoutés via formulaire');
    autoFormatFamilleRow(sheet, targetRow);

    logInfo('Manual entry updated with form documents', manualFamilyId);
    return true;
}

/**
 * Include file content (for HTML templates)
 * @param {string} filename - Filename to include
 * @returns {string} File content
 */
function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Calculate statistics from Famille sheet
 * @returns {Object} Statistics object
 */
function calculateStatistics() {
    const data = getFamilySheetData();

    if (!data) {
        return {
            total: 0,
            validated: 0,
            inProgress: 0,
            rejected: 0,
            totalAdults: 0,
            totalChildren: 0,
            seDeplace: 0,
            zakatElFitr: 0,
            sadaqa: 0,
            byCriticite: {},
            byQuartier: {},
            byLangue: {}
        };
    }

    const stats = {
        total: data.length - 1,
        validated: 0,
        inProgress: 0,
        rejected: 0,
        totalAdults: 0,
        totalChildren: 0,
        seDeplace: 0,
        zakatElFitr: 0,
        sadaqa: 0,
        byCriticite: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        byQuartier: {},
        byLangue: { 'Français': 0, 'Arabe': 0, 'Anglais': 0, 'unknown': 0 }
    };

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const status = safeGetColumn(row, OUTPUT_COLUMNS.ETAT_DOSSIER);
        const criticite = parseInt(safeGetColumn(row, OUTPUT_COLUMNS.CRITICITE, 0)) || 0;
        const quartierId = safeGetColumn(row, OUTPUT_COLUMNS.ID_QUARTIER);
        const langue = safeGetColumn(row, OUTPUT_COLUMNS.LANGUE, 'unknown');
        const seDeplace = row[OUTPUT_COLUMNS.SE_DEPLACE];
        const zakatElFitr = row[OUTPUT_COLUMNS.ZAKAT_EL_FITR];
        const sadaqa = row[OUTPUT_COLUMNS.SADAQA];

        if (status === CONFIG.STATUS.VALIDATED) stats.validated++;
        if (status === CONFIG.STATUS.IN_PROGRESS) stats.inProgress++;
        if (status === CONFIG.STATUS.REJECTED) stats.rejected++;

        stats.totalAdults += parseInt(safeGetColumn(row, OUTPUT_COLUMNS.NOMBRE_ADULTE, 0)) || 0;
        stats.totalChildren += parseInt(safeGetColumn(row, OUTPUT_COLUMNS.NOMBRE_ENFANT, 0)) || 0;

        if (seDeplace === true) stats.seDeplace++;
        if (zakatElFitr === true) stats.zakatElFitr++;
        if (sadaqa === true) stats.sadaqa++;

        if (criticite >= 0 && criticite <= 5) {
            stats.byCriticite[criticite]++;
        }

        if (quartierId) {
            stats.byQuartier[quartierId] = (stats.byQuartier[quartierId] || 0) + 1;
        }

        if (['Français', 'Arabe', 'Anglais'].includes(langue)) {
            stats.byLangue[langue]++;
        } else {
            stats.byLangue.unknown++;
        }
    }

    return stats;
}

/**
 * Clear all caches (wrapper)
 */
function clearAllCaches() {
    clearAllCache();
    SpreadsheetApp.getUi().alert('✅ Cache effacé avec succès');
}

/**
 * Write data to Famille sheet (uses buildFamilyRow)
 * UPDATED: Uses formatAddressCanonical
 * @param {Object} formData - Form data
 * @param {Object} [options={}] - Options
 * @returns {number} Row number
 */
function writeToFamilySheet(formData, options = {}) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) {
        throw new Error('Famille sheet not found');
    }

    const row = buildFamilyRow(formData, options);

    const lastEmptyRow = getLastEmptyRow(sheet);
    sheet.getRange(lastEmptyRow, 1, 1, row.length).setValues([row]);

    const normalizedPhone = normalizePhone(formData.phone);
    const cacheKey = `dup_${normalizedPhone.replace(/[\s\(\)]/g, '')}_${formData.lastName.toLowerCase().trim()}`;
    removeCached(cacheKey);

    logInfo(`Family written to sheet at row ${lastEmptyRow}`, {
        familyId: options.familyId || row[OUTPUT_COLUMNS.ID],
        status: options.status || CONFIG.STATUS.IN_PROGRESS,
        langue: options.langue || CONFIG.LANGUAGES.FR
    });

    return lastEmptyRow;
}

/**
 * Update existing family (uses findFamilyRowById and updateFamilyCell)
 * UPDATED: Uses formatAddressCanonical
 * @param {Object} duplicate - Duplicate result from findDuplicateFamily
 * @param {Object} formData - Form data
 * @param {Object} addressValidation - Address validation result
 * @param {Object} docValidation - Document validation result
 */
function updateExistingFamily(duplicate, formData, addressValidation, docValidation) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) return;

    const row = duplicate.row;
    const existingData = duplicate.data;
    const changes = [];

    const newPhone = normalizePhone(formData.phone);
    const oldPhone = normalizePhone(String(safeGetColumn(existingData, OUTPUT_COLUMNS.TELEPHONE)))
        .replace(/[\s\(\)]/g, '');

    if (newPhone !== oldPhone) {
        updateFamilyCell(row, OUTPUT_COLUMNS.TELEPHONE, newPhone);
        changes.push('téléphone');
    }

    // UPDATED: Use canonical address formatting
    const newAddress = formatAddressCanonical(formData.address, formData.postalCode, formData.city);
    const oldAddress = safeGetColumn(existingData, OUTPUT_COLUMNS.ADRESSE);

    if (newAddress !== oldAddress) {
        updateFamilyCell(row, OUTPUT_COLUMNS.ADRESSE, newAddress);
        updateFamilyCell(row, OUTPUT_COLUMNS.ID_QUARTIER, addressValidation.quartierId || '');
        changes.push('adresse');
    }

    if (formData.seDeplace !== undefined) {
        const oldSeDeplace = existingData[OUTPUT_COLUMNS.SE_DEPLACE] || false;
        if (formData.seDeplace !== oldSeDeplace) {
            updateFamilyCell(row, OUTPUT_COLUMNS.SE_DEPLACE, formData.seDeplace);
            changes.push('se_deplace');
        }
    }

    if (docValidation.identityIds.length > 0) {
        updateFamilyCell(row, OUTPUT_COLUMNS.IDENTITE, formatDocumentLinks(docValidation.identityIds));
        changes.push('documents d\'identité');
    }

    if (docValidation.aidesEtatIds.length > 0) {
        updateFamilyCell(row, OUTPUT_COLUMNS.AIDES_ETAT, formatDocumentLinks(docValidation.aidesEtatIds));
        changes.push('documents aides d\'état');
    }

    if (formData.email) {
        const newEmail = formData.email.toLowerCase().trim();
        const oldEmail = safeGetColumn(existingData, OUTPUT_COLUMNS.EMAIL, '').toLowerCase().trim();
        if (newEmail !== oldEmail) {
            updateFamilyCell(row, OUTPUT_COLUMNS.EMAIL, formData.email);
            changes.push('email');
        }
    }

    if (formData.langue) {
        const oldLangue = safeGetColumn(existingData, OUTPUT_COLUMNS.LANGUE);
        if (formData.langue !== oldLangue) {
            updateFamilyCell(row, OUTPUT_COLUMNS.LANGUE, formData.langue);
            changes.push('langue');
        }
    }

    appendSheetComment(sheet, row, '🔄', `Mis à jour: ${changes.join(', ')}`);
    updateFamilyCell(row, OUTPUT_COLUMNS.ETAT_DOSSIER, CONFIG.STATUS.IN_PROGRESS);
    autoFormatFamilleRow(sheet, row);

    logInfo('Family updated', { id: duplicate.id, changes });
}

/**
 * Get all family IDs for dropdown UI
 * @param {boolean} [filterValidated=false] - Only return validated families
 * @returns {Array<Object>} Array of family info objects
 */
function getAllFamilyIds(filterValidated = false) {
    const data = getFamilySheetData();
    if (!data) return [];

    const families = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const status = safeGetColumn(row, OUTPUT_COLUMNS.ETAT_DOSSIER);

        if (filterValidated && status !== CONFIG.STATUS.VALIDATED) {
            continue;
        }

        const familyId = safeGetColumn(row, OUTPUT_COLUMNS.ID);
        if (familyId) {
            families.push({
                id: familyId,
                nom: safeGetColumn(row, OUTPUT_COLUMNS.NOM),
                prenom: safeGetColumn(row, OUTPUT_COLUMNS.PRENOM),
                telephone: safeGetColumn(row, OUTPUT_COLUMNS.TELEPHONE),
                email: safeGetColumn(row, OUTPUT_COLUMNS.EMAIL),
                adresse: safeGetColumn(row, OUTPUT_COLUMNS.ADRESSE),
                nombreAdulte: parseInt(safeGetColumn(row, OUTPUT_COLUMNS.NOMBRE_ADULTE, 0)) || 0,
                nombreEnfant: parseInt(safeGetColumn(row, OUTPUT_COLUMNS.NOMBRE_ENFANT, 0)) || 0,
                seDeplace: row[OUTPUT_COLUMNS.SE_DEPLACE] === true,
                zakatElFitr: row[OUTPUT_COLUMNS.ZAKAT_EL_FITR] === true,
                sadaqa: row[OUTPUT_COLUMNS.SADAQA] === true,
                criticite: parseInt(safeGetColumn(row, OUTPUT_COLUMNS.CRITICITE, 0)) || 0,
                langue: safeGetColumn(row, OUTPUT_COLUMNS.LANGUE, CONFIG.LANGUAGES.FR),
                circonstances: safeGetColumn(row, OUTPUT_COLUMNS.CIRCONSTANCES),
                ressentit: safeGetColumn(row, OUTPUT_COLUMNS.RESSENTIT),
                specificites: safeGetColumn(row, OUTPUT_COLUMNS.SPECIFICITES),
                status: status
            });
        }
    }

    return families;
}