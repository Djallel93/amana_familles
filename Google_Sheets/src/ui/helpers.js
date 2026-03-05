/**
 * @file src/ui/helpers.js
 * @description Helpers UI - formatage, écriture feuille, mise à jour famille
 */

function autoFormatFamilleRow(sheet, row) {
    try {
        const numColumns = sheet.getLastColumn();

        for (let col = 1; col <= numColumns; col++) {
            sheet.autoResizeColumn(col);
            const currentWidth = sheet.getColumnWidth(col);
            if (currentWidth < 80) sheet.setColumnWidth(col, 80);
            if (currentWidth > 400) sheet.setColumnWidth(col, 400);
        }

        sheet.autoResizeRows(row, 1);
        logInfo(`Ligne ${row} formatée dans ${sheet.getName()}`);

    } catch (error) {
        logWarning(`Échec formatage ligne ${row}`, error);
    }
}

function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function calculateStatistics() {
    const data = getFamilySheetData();

    if (!data) {
        return {
            total: 0, validated: 0, inProgress: 0, rejected: 0,
            totalAdults: 0, totalChildren: 0, seDeplace: 0,
            zakatElFitr: 0, sadaqa: 0, byCriticite: {},
            byQuartier: {}, byLangue: {}
        };
    }

    const stats = {
        total: data.length - 1,
        validated: 0, inProgress: 0, rejected: 0,
        totalAdults: 0, totalChildren: 0, seDeplace: 0,
        zakatElFitr: 0, sadaqa: 0,
        byCriticite: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        byQuartier: {},
        byLangue: { 'Français': 0, 'Arabe': 0, 'Anglais': 0, 'inconnu': 0 }
    };

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const status = safeGetColumn(row, OUTPUT_COLUMNS.ETAT_DOSSIER);
        const criticite = parseInt(safeGetColumn(row, OUTPUT_COLUMNS.CRITICITE, 0)) || 0;
        const quartierId = safeGetColumn(row, OUTPUT_COLUMNS.ID_QUARTIER);
        const langue = safeGetColumn(row, OUTPUT_COLUMNS.LANGUE, 'inconnu');

        if (status === CONFIG.STATUS.VALIDATED) stats.validated++;
        if (status === CONFIG.STATUS.IN_PROGRESS) stats.inProgress++;
        if (status === CONFIG.STATUS.REJECTED) stats.rejected++;

        stats.totalAdults += parseInt(safeGetColumn(row, OUTPUT_COLUMNS.NOMBRE_ADULTE, 0)) || 0;
        stats.totalChildren += parseInt(safeGetColumn(row, OUTPUT_COLUMNS.NOMBRE_ENFANT, 0)) || 0;

        if (row[OUTPUT_COLUMNS.SE_DEPLACE] === true) stats.seDeplace++;
        if (row[OUTPUT_COLUMNS.ZAKAT_EL_FITR] === true) stats.zakatElFitr++;
        if (row[OUTPUT_COLUMNS.SADAQA] === true) stats.sadaqa++;

        if (criticite >= 0 && criticite <= 5) stats.byCriticite[criticite]++;

        if (quartierId) {
            stats.byQuartier[quartierId] = (stats.byQuartier[quartierId] || 0) + 1;
        }

        if (['Français', 'Arabe', 'Anglais'].includes(langue)) {
            stats.byLangue[langue]++;
        } else {
            stats.byLangue.inconnu++;
        }
    }

    return stats;
}

function clearAllCaches() {
    clearAllCache();
    SpreadsheetApp.getUi().alert('✅ Cache effacé avec succès');
}

function writeToFamilySheet(formData, options = {}) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) throw new Error('Feuille Famille introuvable');

    const row = buildFamilyRow(formData, options);
    const lastEmptyRow = getLastEmptyRow(sheet);
    sheet.getRange(lastEmptyRow, 1, 1, row.length).setValues([row]);

    const normalizedPhone = normalizePhone(formData.phone);
    const cacheKey = `dup_${normalizedPhone.replace(/[\s\(\)]/g, '')}_${formData.lastName.toLowerCase().trim()}`;
    removeCached(cacheKey);

    logInfo(`Famille écrite en feuille ligne ${lastEmptyRow}`, {
        familyId: options.familyId || row[OUTPUT_COLUMNS.ID],
        statut: options.status || CONFIG.STATUS.IN_PROGRESS,
        langue: options.langue || CONFIG.LANGUAGES.FR
    });

    return lastEmptyRow;
}

/**
 * Met à jour une famille existante suite à une soumission de formulaire (doublon détecté).
 * Met à jour téléphone, adresse, se_deplace, nombre_adulte, nombre_enfant,
 * documents, email et langue si des changements sont détectés.
 */
function updateExistingFamily(duplicate, formData, addressValidation, docValidation) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) return;

    const row = duplicate.row;
    const existingData = duplicate.data;

    const currentStatus = safeGetColumn(existingData, OUTPUT_COLUMNS.ETAT_DOSSIER);

    if (currentStatus === CONFIG.STATUS.REJECTED) {
        logInfo(`Famille ${duplicate.id} rejetée - mise à jour ignorée`);
        appendSheetComment(sheet, row, '🚫', 'Tentative de mise à jour ignorée: famille rejetée');

        notifyAdmin(
            '🚫 Mise à jour ignorée - Famille rejetée',
            `ID: ${duplicate.id}\nNom: ${safeGetColumn(existingData, OUTPUT_COLUMNS.NOM)} ${safeGetColumn(existingData, OUTPUT_COLUMNS.PRENOM)}\nStatut: Rejeté\n\nLa tentative de mise à jour via formulaire a été ignorée.`
        );

        return;
    }

    const changes = [];

    const newPhone = normalizePhone(formData.phone);
    const oldPhone = normalizePhone(String(safeGetColumn(existingData, OUTPUT_COLUMNS.TELEPHONE))).replace(/[\s\(\)]/g, '');

    if (newPhone !== oldPhone) {
        updateFamilyCell(row, OUTPUT_COLUMNS.TELEPHONE, newPhone);
        changes.push('téléphone');
    }

    const newAddress = formatAddressCanonical(formData.address, formData.postalCode, formData.city);
    const oldAddress = safeGetColumn(existingData, OUTPUT_COLUMNS.ADRESSE);

    if (newAddress !== oldAddress) {
        updateFamilyCell(row, OUTPUT_COLUMNS.ADRESSE, newAddress);
        updateFamilyCell(row, OUTPUT_COLUMNS.ID_QUARTIER, addressValidation.quartierId || '');
        changes.push('adresse');
    }

    if (formData.seDeplace !== undefined) {
        const oldSeDeplace = existingData[OUTPUT_COLUMNS.SE_DEPLACE] === true;
        if (formData.seDeplace !== oldSeDeplace) {
            updateFamilyCell(row, OUTPUT_COLUMNS.SE_DEPLACE, formData.seDeplace);
            changes.push('se_deplace');
        }
    }

    if (formData.nombreAdulte !== undefined && formData.nombreAdulte !== null) {
        const newAdultes = parseInt(formData.nombreAdulte) || 0;
        const oldAdultes = parseInt(safeGetColumn(existingData, OUTPUT_COLUMNS.NOMBRE_ADULTE, 0)) || 0;
        if (newAdultes !== oldAdultes) {
            updateFamilyCell(row, OUTPUT_COLUMNS.NOMBRE_ADULTE, newAdultes);
            changes.push('nombre_adulte');
        }
    }

    if (formData.nombreEnfant !== undefined && formData.nombreEnfant !== null) {
        const newEnfants = parseInt(formData.nombreEnfant) || 0;
        const oldEnfants = parseInt(safeGetColumn(existingData, OUTPUT_COLUMNS.NOMBRE_ENFANT, 0)) || 0;
        if (newEnfants !== oldEnfants) {
            updateFamilyCell(row, OUTPUT_COLUMNS.NOMBRE_ENFANT, newEnfants);
            changes.push('nombre_enfant');
        }
    }

    if (docValidation.identityIds && docValidation.identityIds.length > 0) {
        updateFamilyCell(row, OUTPUT_COLUMNS.IDENTITE, formatDocumentLinks(docValidation.identityIds));
        changes.push('documents d\'identité');
    }

    if (docValidation.aidesEtatIds && docValidation.aidesEtatIds.length > 0) {
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

    if (changes.length > 0) {
        appendSheetComment(sheet, row, '🔄', `Mis à jour: ${changes.join(', ')}`);
        updateFamilyCell(row, OUTPUT_COLUMNS.ETAT_DOSSIER, CONFIG.STATUS.IN_PROGRESS);
        autoFormatFamilleRow(sheet, row);
        logInfo('Famille mise à jour', { id: duplicate.id, changes });
    } else {
        logInfo('Aucun changement détecté pour la famille', { id: duplicate.id });
    }
}

function getAllFamilyIds(filterValidated = false) {
    const data = getFamilySheetData();
    if (!data) return [];

    const families = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const status = safeGetColumn(row, OUTPUT_COLUMNS.ETAT_DOSSIER);

        if (filterValidated && status !== CONFIG.STATUS.VALIDATED) continue;

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

function isFamilyRejected(familyId) {
    try {
        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (!sheet) return { isRejected: false };

        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const rowId = safeGetColumn(row, OUTPUT_COLUMNS.ID);
            const status = safeGetColumn(row, OUTPUT_COLUMNS.ETAT_DOSSIER);

            if (rowId == familyId && status === CONFIG.STATUS.REJECTED) {
                return { isRejected: true, row: i + 1 };
            }
        }

        return { isRejected: false };
    } catch (error) {
        logError('Erreur vérification famille rejetée', error);
        return { isRejected: false };
    }
}