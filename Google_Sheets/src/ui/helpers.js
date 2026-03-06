/**
 * @file src/ui/helpers.js
 * @description Helpers UI - formatage, écriture feuille, mise à jour famille existante
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
    } catch (error) {
        logAvertissement(`Échec formatage ligne ${row}`, error);
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
        if (quartierId) stats.byQuartier[quartierId] = (stats.byQuartier[quartierId] || 0) + 1;
        if (['Français', 'Arabe', 'Anglais'].includes(langue)) stats.byLangue[langue]++;
        else stats.byLangue.inconnu++;
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
    const cacheKey = `dup_${normalizedPhone.replace(/[\s\(\)]/g, '')}_${(formData.lastName || '').toLowerCase().trim()}`;
    removeCached(cacheKey);

    logInfo(`Famille écrite en feuille ligne ${lastEmptyRow}`, {
        familyId: options.familyId || row[OUTPUT_COLUMNS.ID],
        statut: options.status || CONFIG.STATUS.IN_PROGRESS,
        langue: options.langue || CONFIG.LANGUAGES.FR
    });

    return lastEmptyRow;
}

/**
 * Met à jour une famille existante suite à une soumission de formulaire.
 * Compare champ par champ, valide l'adresse si elle change.
 * Retourne { changes: string[] }
 */
function updateExistingFamily(duplicate, formData, addressValidationHint, docValidation) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) return { changes: [] };

    const row = duplicate.row;
    const existingData = duplicate.data;
    const currentStatus = safeGetColumn(existingData, OUTPUT_COLUMNS.ETAT_DOSSIER);

    if (currentStatus === CONFIG.STATUS.REJECTED) {
        logInfo(`Famille ${duplicate.id} rejetée - mise à jour ignorée`);
        appendSheetComment(sheet, row, '🚫', 'Tentative de mise à jour ignorée: famille rejetée');
        notifyAdmin(
            '🚫 Mise à jour ignorée - Famille rejetée',
            `ID: ${duplicate.id}\nNom: ${safeGetColumn(existingData, OUTPUT_COLUMNS.NOM)} ${safeGetColumn(existingData, OUTPUT_COLUMNS.PRENOM)}\nStatut: Rejeté`
        );
        return { changes: [] };
    }

    const changes = [];

    // Téléphone principal
    const newPhone = normalizePhone(formData.phone || '');
    const oldPhone = normalizePhone(String(safeGetColumn(existingData, OUTPUT_COLUMNS.TELEPHONE) || ''));
    if (newPhone && newPhone !== oldPhone) {
        updateFamilyCell(row, OUTPUT_COLUMNS.TELEPHONE, newPhone);
        changes.push('téléphone');
    }

    // Téléphone secondaire
    if (formData.phoneBis) {
        const newPhoneBis = normalizePhone(formData.phoneBis);
        const oldPhoneBis = normalizePhone(String(safeGetColumn(existingData, OUTPUT_COLUMNS.TELEPHONE_BIS) || ''));
        if (newPhoneBis && newPhoneBis !== oldPhoneBis) {
            updateFamilyCell(row, OUTPUT_COLUMNS.TELEPHONE_BIS, newPhoneBis);
            changes.push('téléphone_bis');
        }
    }

    // Email
    if (formData.email) {
        const newEmail = formData.email.toLowerCase().trim();
        const oldEmail = safeGetColumn(existingData, OUTPUT_COLUMNS.EMAIL, '').toLowerCase().trim();
        if (newEmail !== oldEmail) {
            updateFamilyCell(row, OUTPUT_COLUMNS.EMAIL, formData.email);
            changes.push('email');
        }
    }

    // Adresse - validation GEO si changement détecté
    if (formData.address && formData.postalCode && formData.city) {
        const newAddress = formatAddressCanonical(formData.address, formData.postalCode, formData.city);
        const oldAddress = safeGetColumn(existingData, OUTPUT_COLUMNS.ADRESSE, '');
        if (newAddress !== oldAddress) {
            const addressValidation = validateAddressAndGetQuartier(formData.address, formData.postalCode, formData.city);
            if (addressValidation.isValid) {
                updateFamilyCell(row, OUTPUT_COLUMNS.ADRESSE, newAddress);
                updateFamilyCell(row, OUTPUT_COLUMNS.ID_QUARTIER, addressValidation.quartierId || '');
                changes.push('adresse');
                if (addressValidation.quartierInvalid) {
                    appendSheetComment(sheet, row, '⚠️', addressValidation.warning);
                }
            } else {
                logAvertissement(`Adresse invalide lors de la mise à jour famille ${duplicate.id}: ${addressValidation.error}`);
                appendSheetComment(sheet, row, '⚠️', `Adresse soumise invalide, conservée: ${addressValidation.error}`);
            }
        }
    }

    // Se déplace
    if (formData.seDeplace !== undefined) {
        const oldSeDeplace = existingData[OUTPUT_COLUMNS.SE_DEPLACE] === true;
        if (formData.seDeplace !== oldSeDeplace) {
            updateFamilyCell(row, OUTPUT_COLUMNS.SE_DEPLACE, formData.seDeplace);
            changes.push('se_déplace');
        }
    }

    // Composition du foyer
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

    // Documents
    if (docValidation && docValidation.identityIds && docValidation.identityIds.length > 0) {
        updateFamilyCell(row, OUTPUT_COLUMNS.IDENTITE, formatDocumentLinks(docValidation.identityIds));
        changes.push('documents_identité');
    }
    if (docValidation && docValidation.aidesEtatIds && docValidation.aidesEtatIds.length > 0) {
        updateFamilyCell(row, OUTPUT_COLUMNS.AIDES_ETAT, formatDocumentLinks(docValidation.aidesEtatIds));
        changes.push('documents_aides_état');
    }

    // Langue
    if (formData.langue) {
        const oldLangue = safeGetColumn(existingData, OUTPUT_COLUMNS.LANGUE);
        if (formData.langue !== oldLangue) {
            updateFamilyCell(row, OUTPUT_COLUMNS.LANGUE, formData.langue);
            changes.push('langue');
        }
    }

    // Circonstances
    if (formData.circonstances) {
        const oldCirconstances = safeGetColumn(existingData, OUTPUT_COLUMNS.CIRCONSTANCES, '');
        if (formData.circonstances !== oldCirconstances) {
            updateFamilyCell(row, OUTPUT_COLUMNS.CIRCONSTANCES, formData.circonstances);
            changes.push('circonstances');
        }
    }

    if (changes.length > 0) {
        updateFamilyCell(row, OUTPUT_COLUMNS.ETAT_DOSSIER, CONFIG.STATUS.IN_PROGRESS);
        appendSheetComment(sheet, row, '🔄', `Mis à jour: ${changes.join(', ')}`);
        autoFormatFamilleRow(sheet, row);
        logInfo(`Famille ${duplicate.id} mise à jour`, { changes });
    } else {
        logInfo(`Aucun changement détecté pour la famille ${duplicate.id}`);
    }

    return { changes };
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
            if (safeGetColumn(row, OUTPUT_COLUMNS.ID) == familyId &&
                safeGetColumn(row, OUTPUT_COLUMNS.ETAT_DOSSIER) === CONFIG.STATUS.REJECTED) {
                return { isRejected: true, row: i + 1 };
            }
        }
        return { isRejected: false };
    } catch (error) {
        logError('Erreur vérification famille rejetée', error);
        return { isRejected: false };
    }
}