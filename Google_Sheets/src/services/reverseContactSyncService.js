/**
 * @file src/services/reverseContactSyncService.js (NEW)
 * @description Reverse sync from Google Contacts to Sheets
 */

/**
 * Main reverse sync function - fetch all contacts and sync to sheet
 * Can be triggered manually or via time-driven trigger
 */
function reverseContactSync() {
    try {
        logInfo('🔄 Starting reverse contact sync (Contacts → Sheet)');

        const startTime = Date.now();
        const results = {
            total: 0,
            updated: 0,
            unchanged: 0,
            errors: 0,
            notFound: 0,
            details: []
        };

        // Get all family contacts from main group
        const familyContacts = fetchAllFamilyContacts();

        if (!familyContacts || familyContacts.length === 0) {
            logWarning('No family contacts found in "Famille dans le besoin" group');
            return {
                success: true,
                message: 'No contacts to sync',
                results: results
            };
        }

        logInfo(`Found ${familyContacts.length} family contacts to check`);
        results.total = familyContacts.length;

        // Process each contact
        familyContacts.forEach(contact => {
            try {
                const syncResult = syncContactToSheet(contact);

                if (syncResult.updated) {
                    results.updated++;
                    results.details.push({
                        familyId: syncResult.familyId,
                        status: 'updated',
                        changes: syncResult.changes
                    });
                } else if (syncResult.notFound) {
                    results.notFound++;
                    results.details.push({
                        familyId: syncResult.familyId,
                        status: 'not_found'
                    });
                } else {
                    results.unchanged++;
                }

            } catch (error) {
                results.errors++;
                logError('Error syncing contact', error);
                results.details.push({
                    contact: extractContactName(contact),
                    status: 'error',
                    error: error.toString()
                });
            }
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logInfo(`✅ Reverse sync completed in ${duration}s`, results);

        // Send notification if updates were made
        if (results.updated > 0) {
            notifyAdmin(
                '🔄 Reverse Contact Sync Completed',
                `Synchronisation Contacts → Feuille terminée\n\n` +
                `Total traité: ${results.total}\n` +
                `✅ Mis à jour: ${results.updated}\n` +
                `➖ Inchangés: ${results.unchanged}\n` +
                `❓ Non trouvés: ${results.notFound}\n` +
                `❌ Erreurs: ${results.errors}\n\n` +
                `Durée: ${duration}s\n\n` +
                `${results.updated > 0 ? 'Consultez les commentaires dans la feuille Famille pour voir les détails des modifications.' : ''}`
            );
        }

        return {
            success: true,
            results: results,
            duration: duration
        };

    } catch (error) {
        logError('❌ Reverse sync failed', error);
        notifyAdmin('❌ Reverse Sync Error', `Error: ${error.toString()}`);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Fetch all family contacts from main group
 */
function fetchAllFamilyContacts() {
    try {
        const mainGroupId = getOrCreateContactGroup('Famille dans le besoin');

        if (!mainGroupId) {
            logError('Main contact group not found');
            return [];
        }

        // Fetch all contacts
        const response = People.People.Connections.list('people/me', {
            pageSize: 2000,
            personFields: 'names,emailAddresses,phoneNumbers,addresses,biographies,memberships'
        });

        if (!response.connections || response.connections.length === 0) {
            return [];
        }

        // Filter only contacts in main family group
        const familyContacts = response.connections.filter(contact => {
            if (!contact.memberships) return false;

            return contact.memberships.some(m =>
                m.contactGroupMembership &&
                m.contactGroupMembership.contactGroupResourceName === mainGroupId
            );
        });

        return familyContacts;

    } catch (error) {
        logError('Failed to fetch family contacts', error);
        return [];
    }
}

/**
 * Sync single contact to sheet
 * Returns { updated: boolean, familyId: string, changes: array }
 */
function syncContactToSheet(contact) {
    const metadata = parseFamilyNotesFromContact(contact.biographies);
    const familyId = metadata.familyId;

    if (!familyId) {
        logWarning('Contact without Family ID found, skipping');
        return { updated: false, notFound: false };
    }

    // Find family in sheet
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) {
        throw new Error('Famille sheet not found');
    }

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

    if (targetRow === -1) {
        logWarning(`Family ${familyId} not found in sheet`);
        return { updated: false, notFound: true, familyId: familyId };
    }

    // Extract contact data
    const contactData = extractContactData(contact);

    // Compare and detect changes
    const changes = detectChanges(existingData, contactData, metadata);

    if (changes.length === 0) {
        // No changes detected
        return { updated: false, familyId: familyId };
    }

    // Apply changes to sheet
    applyChangesToSheet(sheet, targetRow, existingData, contactData, metadata, changes);

    logInfo(`✅ Contact synced to sheet for family ${familyId}`, { changes });

    return {
        updated: true,
        familyId: familyId,
        changes: changes
    };
}

/**
 * Extract relevant data from contact
 */
function extractContactData(contact) {
    const data = {
        firstName: '',
        lastName: '',
        phone: '',
        phoneBis: '',
        email: '',
        address: '',
        postalCode: '',
        city: ''
    };

    // Names
    if (contact.names && contact.names.length > 0) {
        data.firstName = contact.names[0].givenName || '';
        data.lastName = contact.names[0].familyName || '';
    }

    // Phone numbers
    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
        data.phone = normalizePhone(contact.phoneNumbers[0].value);
        if (contact.phoneNumbers.length > 1) {
            data.phoneBis = normalizePhone(contact.phoneNumbers[1].value);
        }
    }

    // Email
    if (contact.emailAddresses && contact.emailAddresses.length > 0) {
        data.email = contact.emailAddresses[0].value;
    }

    // Address
    if (contact.addresses && contact.addresses.length > 0) {
        const addr = contact.addresses[0];
        data.address = addr.streetAddress || '';
        data.postalCode = addr.postalCode || '';
        data.city = addr.city || '';
    }

    return data;
}

/**
 * Detect changes between sheet data and contact data
 */
function detectChanges(existingData, contactData, metadata) {
    const changes = [];

    // Compare names
    const sheetFirstName = (existingData[OUTPUT_COLUMNS.PRENOM] || '').trim();
    const sheetLastName = (existingData[OUTPUT_COLUMNS.NOM] || '').trim();

    if (contactData.firstName && contactData.firstName !== sheetFirstName) {
        changes.push({
            field: 'prenom',
            column: OUTPUT_COLUMNS.PRENOM,
            oldValue: sheetFirstName,
            newValue: contactData.firstName
        });
    }

    if (contactData.lastName && contactData.lastName !== sheetLastName) {
        changes.push({
            field: 'nom',
            column: OUTPUT_COLUMNS.NOM,
            oldValue: sheetLastName,
            newValue: contactData.lastName
        });
    }

    // Compare phone
    const sheetPhone = normalizePhone(String(existingData[OUTPUT_COLUMNS.TELEPHONE] || '')).replace(/[\s\(\)]/g, '');
    const contactPhone = contactData.phone.replace(/[\s\(\)]/g, '');

    if (contactPhone && contactPhone !== sheetPhone) {
        changes.push({
            field: 'telephone',
            column: OUTPUT_COLUMNS.TELEPHONE,
            oldValue: existingData[OUTPUT_COLUMNS.TELEPHONE],
            newValue: contactData.phone
        });
    }

    // Compare phone bis
    const sheetPhoneBis = normalizePhone(String(existingData[OUTPUT_COLUMNS.TELEPHONE_BIS] || '')).replace(/[\s\(\)]/g, '');
    const contactPhoneBis = contactData.phoneBis.replace(/[\s\(\)]/g, '');

    if (contactPhoneBis !== sheetPhoneBis) {
        changes.push({
            field: 'telephone_bis',
            column: OUTPUT_COLUMNS.TELEPHONE_BIS,
            oldValue: existingData[OUTPUT_COLUMNS.TELEPHONE_BIS],
            newValue: contactData.phoneBis
        });
    }

    // Compare email
    const sheetEmail = (existingData[OUTPUT_COLUMNS.EMAIL] || '').toLowerCase().trim();
    const contactEmail = contactData.email.toLowerCase().trim();

    if (contactEmail && contactEmail !== sheetEmail) {
        changes.push({
            field: 'email',
            column: OUTPUT_COLUMNS.EMAIL,
            oldValue: existingData[OUTPUT_COLUMNS.EMAIL],
            newValue: contactData.email
        });
    }

    // Compare address (full address string)
    if (contactData.address || contactData.postalCode || contactData.city) {
        const contactFullAddress = `${contactData.address}, ${contactData.postalCode} ${contactData.city}`.trim();
        const sheetAddress = (existingData[OUTPUT_COLUMNS.ADRESSE] || '').trim();

        if (contactFullAddress !== sheetAddress && contactFullAddress !== ', ') {
            changes.push({
                field: 'adresse',
                column: OUTPUT_COLUMNS.ADRESSE,
                oldValue: sheetAddress,
                newValue: contactFullAddress
            });
        }
    }

    // Compare criticité (from metadata)
    const sheetCriticite = parseInt(existingData[OUTPUT_COLUMNS.CRITICITE]) || 0;
    if (metadata.criticite !== sheetCriticite) {
        changes.push({
            field: 'criticite',
            column: OUTPUT_COLUMNS.CRITICITE,
            oldValue: sheetCriticite,
            newValue: metadata.criticite
        });
    }

    // Compare household composition
    const sheetAdultes = parseInt(existingData[OUTPUT_COLUMNS.NOMBRE_ADULTE]) || 0;
    if (metadata.nombreAdulte !== sheetAdultes) {
        changes.push({
            field: 'nombre_adulte',
            column: OUTPUT_COLUMNS.NOMBRE_ADULTE,
            oldValue: sheetAdultes,
            newValue: metadata.nombreAdulte
        });
    }

    const sheetEnfants = parseInt(existingData[OUTPUT_COLUMNS.NOMBRE_ENFANT]) || 0;
    if (metadata.nombreEnfant !== sheetEnfants) {
        changes.push({
            field: 'nombre_enfant',
            column: OUTPUT_COLUMNS.NOMBRE_ENFANT,
            oldValue: sheetEnfants,
            newValue: metadata.nombreEnfant
        });
    }

    // Compare eligibility
    const sheetZakat = existingData[OUTPUT_COLUMNS.ZAKAT_EL_FITR] === true;
    if (metadata.zakatElFitr !== sheetZakat) {
        changes.push({
            field: 'zakat_el_fitr',
            column: OUTPUT_COLUMNS.ZAKAT_EL_FITR,
            oldValue: sheetZakat,
            newValue: metadata.zakatElFitr
        });
    }

    const sheetSadaqa = existingData[OUTPUT_COLUMNS.SADAQA] === true;
    if (metadata.sadaqa !== sheetSadaqa) {
        changes.push({
            field: 'sadaqa',
            column: OUTPUT_COLUMNS.SADAQA,
            oldValue: sheetSadaqa,
            newValue: metadata.sadaqa
        });
    }

    // Compare langue
    const sheetLangue = existingData[OUTPUT_COLUMNS.LANGUE] || CONFIG.LANGUAGES.FR;
    if (metadata.langue !== sheetLangue) {
        changes.push({
            field: 'langue',
            column: OUTPUT_COLUMNS.LANGUE,
            oldValue: sheetLangue,
            newValue: metadata.langue
        });
    }

    return changes;
}

/**
 * Apply detected changes to sheet
 */
function applyChangesToSheet(sheet, row, existingData, contactData, metadata, changes) {
    // Apply each change
    changes.forEach(change => {
        sheet.getRange(row, change.column + 1).setValue(change.newValue);
    });

    // Build change summary for comment
    const changeSummary = changes.map(c => {
        const displayValue = (val) => {
            if (typeof val === 'boolean') return val ? 'Oui' : 'Non';
            if (val === '') return '(vide)';
            return val;
        };
        return `${c.field}: ${displayValue(c.oldValue)} → ${displayValue(c.newValue)}`;
    }).join(', ');

    // Add comment
    const existingComment = existingData[OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';
    const newComment = addComment(
        existingComment,
        formatComment('🔄', `Sync Contact → Feuille: ${changeSummary}`)
    );
    sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);

    logInfo(`Applied ${changes.length} changes to sheet for family at row ${row}`);
}

/**
 * Extract contact name for logging
 */
function extractContactName(contact) {
    if (contact.names && contact.names.length > 0) {
        return `${contact.names[0].givenName || ''} ${contact.names[0].familyName || ''}`.trim();
    }
    return 'Unknown';
}