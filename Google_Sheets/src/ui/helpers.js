/**
 * @file src/ui/helpers.js (UPDATED for GEO API v5.0)
 * @description 🛠️ Fonctions utilitaires UI avec support hiérarchie 3 niveaux
 */

/**
 * 📝 Traiter une entrée manuelle de famille (appelée depuis l'UI)
 */
function processManualEntry(formData) {
    try {
        logInfo('📝 Traitement d\'une entrée manuelle', formData);

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

        const familyId = generateFamilyId();

        writeToFamilySheet(formData, {
            status: CONFIG.STATUS.VALIDATED,
            familyId: familyId,
            villeId: addressValidation.villeId,
            secteurId: addressValidation.secteurId,
            quartierId: addressValidation.quartierId,
            villeName: addressValidation.villeName,
            secteurName: addressValidation.secteurName,
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
            adresse: `${formData.address}, ${formData.postalCode} ${formData.city}`
        };

        syncFamilyContact(contactData);

        notifyAdmin(
            '✅ Nouvelle famille ajoutée manuellement',
            `ID: ${familyId}\nNom: ${formData.lastName} ${formData.firstName}\nTéléphone: ${normalizePhone(formData.phone)}\nAdresse: ${formData.address}, ${formData.postalCode} ${formData.city}\nVille: ${addressValidation.villeName || 'Non assignée'}\nSecteur: ${addressValidation.secteurName || 'Non assigné'}\nQuartier: ${addressValidation.quartierName || 'Non assigné'}\nCriticité: ${criticite}`
        );

        logInfo('✅ Entrée manuelle traitée avec succès', { familyId, criticite });

        return {
            success: true,
            familyId: familyId,
            villeId: addressValidation.villeId,
            secteurId: addressValidation.secteurId,
            quartierId: addressValidation.quartierId,
            villeName: addressValidation.villeName,
            secteurName: addressValidation.secteurName,
            quartierName: addressValidation.quartierName,
            criticite: criticite
        };

    } catch (error) {
        logError('❌ Échec du traitement de l\'entrée manuelle', error);
        notifyAdmin('❌ Erreur d\'entrée manuelle', `Erreur: ${error.toString()}\nFamille: ${formData.lastName} ${formData.firstName}`);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * 🔄 Mettre à jour une entrée manuelle si un formulaire est soumis plus tard
 */
function updateManualEntryWithFormData(manualFamilyId, formData, docValidation) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
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
        logError('❌ Famille manuelle introuvable', manualFamilyId);
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
    const newComment = existingComment ?
        `${existingComment}\nDocuments ajoutés via formulaire - ${new Date().toLocaleString('fr-FR')}` :
        `Documents ajoutés via formulaire - ${new Date().toLocaleString('fr-FR')}`;
    sheet.getRange(targetRow, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);

    logInfo('✅ Entrée manuelle mise à jour avec les documents du formulaire', manualFamilyId);
    return true;
}

/**
 * 📄 Inclure le contenu d'un fichier (pour <?!= include('file') ?> dans HTML)
 */
function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 📊 Calculer les statistiques de la feuille Famille
 */
function calculateStatistics() {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) {
        return {
            total: 0,
            validated: 0,
            inProgress: 0,
            rejected: 0,
            totalAdults: 0,
            totalChildren: 0,
            byCriticite: {},
            byVille: {},
            bySecteur: {}
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
        byCriticite: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        byVille: {},
        bySecteur: {}
    };

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const status = row[OUTPUT_COLUMNS.ETAT_DOSSIER];
        const criticite = parseInt(row[OUTPUT_COLUMNS.CRITICITE]) || 0;
        const villeId = row[OUTPUT_COLUMNS.ID_VILLE];
        const secteurId = row[OUTPUT_COLUMNS.ID_SECTEUR];

        if (status === CONFIG.STATUS.VALIDATED) stats.validated++;
        if (status === CONFIG.STATUS.IN_PROGRESS) stats.inProgress++;
        if (status === CONFIG.STATUS.REJECTED) stats.rejected++;

        stats.totalAdults += parseInt(row[OUTPUT_COLUMNS.NOMBRE_ADULTE]) || 0;
        stats.totalChildren += parseInt(row[OUTPUT_COLUMNS.NOMBRE_ENFANT]) || 0;

        if (criticite >= 0 && criticite <= 5) {
            stats.byCriticite[criticite]++;
        }

        if (villeId) {
            stats.byVille[villeId] = (stats.byVille[villeId] || 0) + 1;
        }

        if (secteurId) {
            stats.bySecteur[secteurId] = (stats.bySecteur[secteurId] || 0) + 1;
        }
    }

    return stats;
}

/**
 * 🗑️ Effacer tous les caches
 */
function clearAllCaches() {
    CacheService.getScriptCache().removeAll([]);
    SpreadsheetApp.getUi().alert('✅ Cache effacé avec succès');
}

/**
 * 💾 Écrire des données dans la feuille Famille (DERNIÈRE LIGNE VIDE)
 * UPDATED: Now includes Ville and Secteur IDs
 */
function writeToFamilySheet(formData, options = {}) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) {
        throw new Error('❌ Feuille Famille introuvable');
    }

    const {
        status = CONFIG.STATUS.IN_PROGRESS,
        comment = '',
        familyId = generateFamilyId(),
        villeId = null,
        secteurId = null,
        quartierId = null,
        villeName = '',
        secteurName = '',
        quartierName = '',
        identityIds = [],
        cafIds = [],
        resourceIds = [],
        criticite = 0
    } = options;

    const normalizedPhone = normalizePhone(formData.phone);
    const normalizedPhoneBis = formData.phoneBis ? normalizePhone(formData.phoneBis) : '';

    // UPDATED: Array now has 23 elements (added villeId and secteurId)
    const row = Array(23).fill('');
    row[OUTPUT_COLUMNS.ID] = familyId;
    row[OUTPUT_COLUMNS.NOM] = formData.lastName || '';
    row[OUTPUT_COLUMNS.PRENOM] = formData.firstName || '';
    row[OUTPUT_COLUMNS.ZAKAT_EL_FITR] = false;
    row[OUTPUT_COLUMNS.SADAQA] = false;
    row[OUTPUT_COLUMNS.NOMBRE_ADULTE] = parseInt(formData.nombreAdulte) || 0;
    row[OUTPUT_COLUMNS.NOMBRE_ENFANT] = parseInt(formData.nombreEnfant) || 0;
    row[OUTPUT_COLUMNS.ADRESSE] = `${formData.address}, ${formData.postalCode} ${formData.city}`;
    row[OUTPUT_COLUMNS.ID_VILLE] = villeId || '';           // NEW
    row[OUTPUT_COLUMNS.ID_SECTEUR] = secteurId || '';       // NEW
    row[OUTPUT_COLUMNS.ID_QUARTIER] = quartierId || '';
    row[OUTPUT_COLUMNS.SE_DEPLACE] = false;
    row[OUTPUT_COLUMNS.EMAIL] = formData.email || '';
    row[OUTPUT_COLUMNS.TELEPHONE] = normalizedPhone;
    row[OUTPUT_COLUMNS.TELEPHONE_BIS] = normalizedPhoneBis;
    row[OUTPUT_COLUMNS.IDENTITE] = formatDocumentLinks(identityIds);
    row[OUTPUT_COLUMNS.CAF] = formatDocumentLinks(cafIds);
    row[OUTPUT_COLUMNS.CIRCONSTANCES] = formData.circonstances || '';
    row[OUTPUT_COLUMNS.RESSENTIT] = '';
    row[OUTPUT_COLUMNS.SPECIFICITES] = '';
    row[OUTPUT_COLUMNS.CRITICITE] = criticite;
    row[OUTPUT_COLUMNS.ETAT_DOSSIER] = status;
    row[OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] = comment;

    const lastEmptyRow = getLastEmptyRow(sheet);
    sheet.getRange(lastEmptyRow, 1, 1, row.length).setValues([row]);

    const cache = CacheService.getScriptCache();
    const cacheKey = `dup_${normalizedPhone.replace(/[\s\(\)]/g, '')}_${formData.lastName.toLowerCase().trim()}`;
    cache.remove(cacheKey);

    logInfo(`💾 Famille écrite dans la feuille à la ligne ${lastEmptyRow}`, { familyId, status });

    return familyId;
}

/**
 * 🔄 Mettre à jour une famille existante
 * UPDATED: Now updates Ville and Secteur IDs
 */
function updateExistingFamily(duplicate, formData, addressValidation, docValidation) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) return;

    const row = duplicate.row;
    const existingData = duplicate.data;
    const changes = [];

    const newPhone = normalizePhone(formData.phone);
    const oldPhone = normalizePhone(String(existingData[OUTPUT_COLUMNS.TELEPHONE]));
    if (newPhone !== oldPhone) {
        sheet.getRange(row, OUTPUT_COLUMNS.TELEPHONE + 1).setValue(newPhone);
        changes.push('téléphone');
    }

    const newAddress = `${formData.address}, ${formData.postalCode} ${formData.city}`;
    const oldAddress = existingData[OUTPUT_COLUMNS.ADRESSE] || '';
    if (newAddress !== oldAddress) {
        sheet.getRange(row, OUTPUT_COLUMNS.ADRESSE + 1).setValue(newAddress);
        sheet.getRange(row, OUTPUT_COLUMNS.ID_VILLE + 1).setValue(addressValidation.villeId || '');
        sheet.getRange(row, OUTPUT_COLUMNS.ID_SECTEUR + 1).setValue(addressValidation.secteurId || '');
        sheet.getRange(row, OUTPUT_COLUMNS.ID_QUARTIER + 1).setValue(addressValidation.quartierId || '');
        changes.push('adresse');
    }

    if (docValidation.identityIds.length > 0) {
        sheet.getRange(row, OUTPUT_COLUMNS.IDENTITE + 1).setValue(formatDocumentLinks(docValidation.identityIds));
        changes.push('documents d\'identité');
    }

    if (docValidation.cafIds.length > 0) {
        sheet.getRange(row, OUTPUT_COLUMNS.CAF + 1).setValue(formatDocumentLinks(docValidation.cafIds));
        changes.push('documents CAF');
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

    logInfo(`🔄 Famille mise à jour`, { id: duplicate.id, changes });
}

/**
 * 📋 Obtenir toutes les familles avec leurs IDs (pour dropdown UI)
 */
function getAllFamilyIds() {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    const families = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[OUTPUT_COLUMNS.ID]) {
            families.push({
                id: row[OUTPUT_COLUMNS.ID],
                nom: row[OUTPUT_COLUMNS.NOM],
                prenom: row[OUTPUT_COLUMNS.PRENOM],
                telephone: row[OUTPUT_COLUMNS.TELEPHONE],
                email: row[OUTPUT_COLUMNS.EMAIL],
                adresse: row[OUTPUT_COLUMNS.ADRESSE],
                nombreAdulte: row[OUTPUT_COLUMNS.NOMBRE_ADULTE],
                nombreEnfant: row[OUTPUT_COLUMNS.NOMBRE_ENFANT],
                criticite: row[OUTPUT_COLUMNS.CRITICITE],
                circonstances: row[OUTPUT_COLUMNS.CIRCONSTANCES],
                ressentit: row[OUTPUT_COLUMNS.RESSENTIT],
                specificites: row[OUTPUT_COLUMNS.SPECIFICITES]
            });
        }
    }

    return families;
}