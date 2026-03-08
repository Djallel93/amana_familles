/**
 * @file src/services/reverseContactSyncService2.js (v8.0)
 * Partie 2 : Application des décisions, extraction et détection des changements
 */

// ─── Application des décisions admin ─────────────────────────────────────────

function applyContactSyncDecisions(decisions) {
    try {
        logInfo(`Application des décisions : ${decisions.length} famille(s)`);
        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (!sheet) return { success: false, error: 'Feuille Famille introuvable' };

        const data = sheet.getDataRange().getValues();
        const results = { accepted: 0, rejected: 0, errors: 0 };

        decisions.forEach(familyDecision => {
            try {
                _applyFamilyDecision(sheet, data, familyDecision, results);
            } catch (e) {
                logError(`Erreur décision famille ${familyDecision.familyId}`, e);
                results.errors++;
            }
        });

        logInfo('Décisions appliquées', results);
        return { success: true, results };

    } catch (e) {
        logError('Échec application des décisions', e);
        return { success: false, error: e.toString() };
    }
}

function _applyFamilyDecision(sheet, data, familyDecision, results) {
    const { familyId, fields } = familyDecision;

    let targetRow = -1;
    let existingData = null;

    for (let i = 1; i < data.length; i++) {
        if (data[i][OUTPUT_COLUMNS.ID] == familyId) {
            targetRow = i + 1;
            existingData = data[i];
            break;
        }
    }

    if (targetRow === -1) {
        logAvertissement(`Famille ${familyId} introuvable lors de l'application`);
        return;
    }

    const acceptedFields = fields.filter(f => f.action === 'accept');
    const rejectedFields = fields.filter(f => f.action === 'reject');

    acceptedFields.forEach(f => {
        const rawValue = f.rawContactValue !== undefined ? f.rawContactValue : f.contactValue;
        sheet.getRange(targetRow, f.column + 1).setValue(rawValue);
        results.accepted++;
    });

    const acceptedLabels = acceptedFields.map(f => f.label);
    const rejectedLabels = rejectedFields.map(f => f.label);

    let commentParts = [];
    if (acceptedLabels.length > 0) commentParts.push(`✅ Accepté: ${acceptedLabels.join(', ')}`);
    if (rejectedLabels.length > 0) commentParts.push(`❌ Conservé: ${rejectedLabels.join(', ')}`);

    if (commentParts.length > 0) {
        appendSheetComment(sheet, targetRow, '🔄', `Sync confirmé — ${commentParts.join(' | ')}`);
    }

    if (rejectedFields.length > 0) {
        const updatedRow = sheet.getRange(targetRow, 1, 1, sheet.getLastColumn()).getValues()[0];
        _rebuildContactFromSheet(updatedRow, familyId);
        results.rejected += rejectedFields.length;
    }
}

function _rebuildContactFromSheet(rowData, familyId) {
    try {
        const familyData = {
            id: familyId,
            nom: safeGetColumn(rowData, OUTPUT_COLUMNS.NOM),
            prenom: safeGetColumn(rowData, OUTPUT_COLUMNS.PRENOM),
            email: safeGetColumn(rowData, OUTPUT_COLUMNS.EMAIL),
            telephone: String(safeGetColumn(rowData, OUTPUT_COLUMNS.TELEPHONE, '')),
            phoneBis: String(safeGetColumn(rowData, OUTPUT_COLUMNS.TELEPHONE_BIS, '')),
            adresse: safeGetColumn(rowData, OUTPUT_COLUMNS.ADRESSE),
            idQuartier: safeGetColumn(rowData, OUTPUT_COLUMNS.ID_QUARTIER),
            nombreAdulte: parseInt(safeGetColumn(rowData, OUTPUT_COLUMNS.NOMBRE_ADULTE, 0)) || 0,
            nombreEnfant: parseInt(safeGetColumn(rowData, OUTPUT_COLUMNS.NOMBRE_ENFANT, 0)) || 0,
            criticite: parseInt(safeGetColumn(rowData, OUTPUT_COLUMNS.CRITICITE, 0)) || 0,
            zakatElFitr: rowData[OUTPUT_COLUMNS.ZAKAT_EL_FITR] === true,
            sadaqa: rowData[OUTPUT_COLUMNS.SADAQA] === true,
            langue: safeGetColumn(rowData, OUTPUT_COLUMNS.LANGUE, CONFIG.LANGUAGES.FR),
            seDeplace: rowData[OUTPUT_COLUMNS.SE_DEPLACE] === true
        };

        syncFamilyContact(familyData);
        logInfo(`Contact reconstruit depuis la feuille pour la famille ${familyId}`);
    } catch (e) {
        logError(`Échec reconstruction contact famille ${familyId}`, e);
    }
}

// ─── Extraction des données contact ──────────────────────────────────────────

function extractContactData(contact) {
    const data = { firstName: '', lastName: '', phone: '', phoneBis: '', email: '', addressCanonical: '' };

    if (contact.names && contact.names.length > 0) {
        data.firstName = contact.names[0].middleName || '';
        data.lastName = contact.names[0].familyName || '';
    }

    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
        data.phone = normalizePhone(contact.phoneNumbers[0].value);
        if (contact.phoneNumbers.length > 1) {
            data.phoneBis = normalizePhone(contact.phoneNumbers[1].value);
        }
    }

    if (contact.emailAddresses && contact.emailAddresses.length > 0) {
        data.email = contact.emailAddresses[0].value;
    }

    if (contact.addresses && contact.addresses.length > 0) {
        const addr = contact.addresses[0];
        data.addressCanonical = formatAddressCanonical(
            addr.streetAddress || '',
            addr.postalCode || '',
            addr.city || ''
        );
    }

    return data;
}

// ─── Détection des changements ────────────────────────────────────────────────

function detectChanges(existingData, contactData, metadata) {
    const changes = [];

    const checks = [
        {
            field: 'prenom', column: OUTPUT_COLUMNS.PRENOM,
            sheetVal: () => (existingData[OUTPUT_COLUMNS.PRENOM] || '').trim(),
            contactVal: () => contactData.firstName,
            condition: (s, c) => c && c !== s
        },
        {
            field: 'nom', column: OUTPUT_COLUMNS.NOM,
            sheetVal: () => (existingData[OUTPUT_COLUMNS.NOM] || '').trim(),
            contactVal: () => contactData.lastName,
            condition: (s, c) => c && c !== s
        },
        {
            field: 'telephone', column: OUTPUT_COLUMNS.TELEPHONE,
            sheetVal: () => normalizePhone(String(existingData[OUTPUT_COLUMNS.TELEPHONE] || '')).replace(/[\s()]/g, ''),
            contactVal: () => contactData.phone.replace(/[\s()]/g, ''),
            condition: (s, c) => c && c !== s
        },
        {
            field: 'telephone_bis', column: OUTPUT_COLUMNS.TELEPHONE_BIS,
            sheetVal: () => normalizePhone(String(existingData[OUTPUT_COLUMNS.TELEPHONE_BIS] || '')).replace(/[\s()]/g, ''),
            contactVal: () => contactData.phoneBis.replace(/[\s()]/g, ''),
            condition: (s, c) => c !== s
        },
        {
            field: 'email', column: OUTPUT_COLUMNS.EMAIL,
            sheetVal: () => (existingData[OUTPUT_COLUMNS.EMAIL] || '').toLowerCase().trim(),
            contactVal: () => contactData.email.toLowerCase().trim(),
            condition: (s, c) => c && c !== s
        },
        {
            field: 'adresse', column: OUTPUT_COLUMNS.ADRESSE,
            sheetVal: () => (existingData[OUTPUT_COLUMNS.ADRESSE] || '').trim(),
            contactVal: () => contactData.addressCanonical,
            condition: (s, c) => c && c !== s && c.length > 0
        },
        {
            field: 'criticite', column: OUTPUT_COLUMNS.CRITICITE,
            sheetVal: () => parseInt(existingData[OUTPUT_COLUMNS.CRITICITE]) || 0,
            contactVal: () => metadata.criticite,
            condition: (s, c) => c !== s
        },
        {
            field: 'nombre_adulte', column: OUTPUT_COLUMNS.NOMBRE_ADULTE,
            sheetVal: () => parseInt(existingData[OUTPUT_COLUMNS.NOMBRE_ADULTE]) || 0,
            contactVal: () => metadata.nombreAdulte,
            condition: (s, c) => c !== s
        },
        {
            field: 'nombre_enfant', column: OUTPUT_COLUMNS.NOMBRE_ENFANT,
            sheetVal: () => parseInt(existingData[OUTPUT_COLUMNS.NOMBRE_ENFANT]) || 0,
            contactVal: () => metadata.nombreEnfant,
            condition: (s, c) => c !== s
        },
        {
            field: 'zakat_el_fitr', column: OUTPUT_COLUMNS.ZAKAT_EL_FITR,
            sheetVal: () => existingData[OUTPUT_COLUMNS.ZAKAT_EL_FITR] === true,
            contactVal: () => metadata.zakatElFitr === true,
            condition: (s, c) => c !== s
        },
        {
            field: 'sadaqa', column: OUTPUT_COLUMNS.SADAQA,
            sheetVal: () => existingData[OUTPUT_COLUMNS.SADAQA] === true,
            contactVal: () => metadata.sadaqa === true,
            condition: (s, c) => c !== s
        },
        {
            field: 'langue', column: OUTPUT_COLUMNS.LANGUE,
            sheetVal: () => existingData[OUTPUT_COLUMNS.LANGUE] || CONFIG.LANGUAGES.FR,
            contactVal: () => metadata.langue,
            condition: (s, c) => c !== s
        },
        {
            field: 'se_deplace', column: OUTPUT_COLUMNS.SE_DEPLACE,
            sheetVal: () => existingData[OUTPUT_COLUMNS.SE_DEPLACE] === true,
            contactVal: () => metadata.seDeplace === true,
            condition: (s, c) => c !== s
        }
    ];

    checks.forEach(({ field, column, sheetVal, contactVal, condition }) => {
        const s = sheetVal();
        const c = contactVal();
        if (condition(s, c)) {
            changes.push({ field, column, oldValue: s, newValue: c });
        }
    });

    return changes;
}

// ─── Application physique des changements ────────────────────────────────────

function applyChangesToSheet(sheet, row, existingData, contactData, metadata, changes) {
    const householdChanges = changes.filter(c => c.field === 'nombre_adulte' || c.field === 'nombre_enfant');

    if (householdChanges.length > 0) {
        let newAdultes = parseInt(existingData[OUTPUT_COLUMNS.NOMBRE_ADULTE]) || 0;
        let newEnfants = parseInt(existingData[OUTPUT_COLUMNS.NOMBRE_ENFANT]) || 0;

        householdChanges.forEach(c => {
            if (c.field === 'nombre_adulte') newAdultes = c.newValue;
            if (c.field === 'nombre_enfant') newEnfants = c.newValue;
        });

        const validation = validateHouseholdComposition(newAdultes, newEnfants);
        if (!validation.isValid) {
            logAvertissement(`Composition foyer invalide, ignorée : ${validation.error}`);
            changes = changes.filter(c => c.field !== 'nombre_adulte' && c.field !== 'nombre_enfant');
            appendSheetComment(sheet, row, '⚠️', `Sync ignoré : ${validation.error}`);
            if (changes.length === 0) return;
        }
    }

    changes.forEach(change => {
        sheet.getRange(row, change.column + 1).setValue(change.newValue);
    });

    appendSheetComment(sheet, row, '🔄', 'Sync Contact → Feuille');
}

function extractContactName(contact) {
    if (contact.names && contact.names.length > 0) {
        return contact.names[0].displayName || 'Inconnu';
    }
    return 'Inconnu';
}
