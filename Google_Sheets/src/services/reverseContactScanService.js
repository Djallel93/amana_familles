/**
 * @file src/services/reverseContactSyncService.js (v8.0)
 * Partie 1 : Scan des différences et synchronisation directe
 */

// ─── Scan lecture seule ───────────────────────────────────────────────────────

function scanContactChanges() {
    try {
        logInfo('Démarrage du scan Contact → Feuille (lecture seule)');
        const contacts = fetchAllFamilyContacts();

        if (!contacts || contacts.length === 0) {
            logInfo('Aucun contact famille trouvé dans le groupe');
            return { success: true, changes: [] };
        }

        const results = [];

        contacts.forEach(contact => {
            try {
                const diff = computeContactDiff(contact);
                if (diff && diff.changes.length > 0) {
                    results.push(diff);
                }
            } catch (e) {
                logError('Erreur lors du scan du contact', e);
            }
        });

        logInfo(`Scan terminé : ${results.length} famille(s) avec des modifications`);
        return { success: true, changes: results };

    } catch (e) {
        logError('Échec du scan des contacts', e);
        return { success: false, error: e.toString() };
    }
}

function computeContactDiff(contact) {
    let familyId = null;

    if (contact.names && contact.names.length > 0) {
        const match = (contact.names[0].givenName || '').match(/^(\d+)\s*-/);
        if (match) familyId = match[1];
    }

    if (!familyId) return null;

    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) throw new Error('Feuille Famille introuvable');

    const data = sheet.getDataRange().getValues();
    let existingData = null;

    for (let i = 1; i < data.length; i++) {
        if (data[i][OUTPUT_COLUMNS.ID] == familyId) {
            existingData = data[i];
            break;
        }
    }

    if (!existingData) return null;

    const contactData = extractContactData(contact);
    const metadata = parseFamilyMetadataFromContact(contact.userDefined);
    const changes = detectChanges(existingData, contactData, metadata);

    if (changes.length === 0) return null;

    const prenom = existingData[OUTPUT_COLUMNS.PRENOM] || '';
    const nom = existingData[OUTPUT_COLUMNS.NOM] || '';

    return {
        familyId: familyId,
        familyName: `${familyId} - ${prenom} ${nom}`.trim(),
        changes: changes.map(c => ({
            field: c.field,
            column: c.column,
            label: getFieldLabel(c.field),
            sheetValue: formatValueForDisplay(c.oldValue),
            contactValue: formatValueForDisplay(c.newValue)
        }))
    };
}

function getFieldLabel(field) {
    const labels = {
        prenom: 'Prénom',
        nom: 'Nom',
        telephone: 'Téléphone',
        telephone_bis: 'Téléphone secondaire',
        email: 'Email',
        adresse: 'Adresse',
        criticite: 'Criticité',
        nombre_adulte: 'Adultes',
        nombre_enfant: 'Enfants',
        zakat_el_fitr: 'Zakat El Fitr',
        sadaqa: 'Sadaqa',
        langue: 'Langue',
        se_deplace: 'Se déplace'
    };
    return labels[field] || field;
}

function formatValueForDisplay(value) {
    if (value === true) return 'Oui';
    if (value === false) return 'Non';
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
}

// ─── Synchronisation directe (flux original) ─────────────────────────────────

function reverseContactSync() {
    try {
        logInfo('Démarrage de la synchronisation Contact → Feuille');
        const startTime = Date.now();

        const results = {
            total: 0, updated: 0, unchanged: 0, errors: 0, notFound: 0, details: []
        };

        const familyContacts = fetchAllFamilyContacts();

        if (!familyContacts || familyContacts.length === 0) {
            logInfo('Aucun contact famille trouvé');
            return { success: true, message: 'Aucun contact à synchroniser', results };
        }

        results.total = familyContacts.length;

        familyContacts.forEach(contact => {
            try {
                const syncResult = syncContactToSheet(contact);
                if (syncResult.updated) {
                    results.updated++;
                    results.details.push({ familyId: syncResult.familyId, status: 'updated', changes: syncResult.changes });
                } else if (syncResult.notFound) {
                    results.notFound++;
                } else {
                    results.unchanged++;
                }
            } catch (e) {
                results.errors++;
                logError('Erreur traitement contact', e);
            }
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logInfo(`Synchronisation terminée en ${duration}s`, results);

        if (results.updated > 0) {
            notifyAdmin('🔄 Sync Contact → Feuille terminée',
                `Traités: ${results.total}\nMis à jour: ${results.updated}\nInchangés: ${results.unchanged}\nNon trouvés: ${results.notFound}\nErreurs: ${results.errors}`);
        }

        return { success: true, results, duration };

    } catch (e) {
        logError('Erreur fatale dans reverseContactSync', e);
        return { success: false, error: e.toString() };
    }
}

function fetchAllFamilyContacts() {
    try {
        const mainGroupId = getOrCreateContactGroup('Famille dans le besoin');
        if (!mainGroupId) return [];

        const response = People.People.Connections.list('people/me', {
            pageSize: 2000,
            personFields: 'names,emailAddresses,phoneNumbers,addresses,userDefined,memberships'
        });

        if (!response.connections || response.connections.length === 0) return [];

        return response.connections.filter(contact =>
            contact.memberships && contact.memberships.some(m =>
                m.contactGroupMembership &&
                m.contactGroupMembership.contactGroupResourceName === mainGroupId
            )
        );
    } catch (e) {
        logError('Échec récupération contacts famille', e);
        return [];
    }
}

function syncContactToSheet(contact) {
    let familyId = null;

    if (contact.names && contact.names.length > 0) {
        const match = (contact.names[0].givenName || '').match(/^(\d+)\s*-/);
        if (match) familyId = match[1];
    }

    if (!familyId) return { updated: false, notFound: false };

    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) throw new Error('Feuille Famille introuvable');

    const data = sheet.getDataRange().getValues();
    let targetRow = -1;
    let existingData = null;

    for (let i = 1; i < data.length; i++) {
        if (data[i][OUTPUT_COLUMNS.ID] == familyId) {
            targetRow = i + 1;
            existingData = data[i];
            break;
        }
    }

    if (targetRow === -1) return { updated: false, notFound: true, familyId };

    const contactData = extractContactData(contact);
    const metadata = parseFamilyMetadataFromContact(contact.userDefined);
    const changes = detectChanges(existingData, contactData, metadata);

    if (changes.length === 0) return { updated: false, familyId };

    applyChangesToSheet(sheet, targetRow, existingData, contactData, metadata, changes);
    return { updated: true, familyId, changes };
}