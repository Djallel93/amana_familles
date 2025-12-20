/**
 * @file src/services/reverseContactSyncService.js (FIXED v3.0)
 * @description Reverse sync from Google Contacts to Sheets with proper name/address parsing
 * 
 * CHANGES:
 * - Fixed name extraction from new structure (givenName has ID, middleName/familyName have real names)
 * - Uses shared address parsing logic (no trailing comma)
 * - Refactored contact data extraction
 */

/**
 * Main reverse sync function - fetch all contacts and sync to sheet
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

        const response = People.People.Connections.list('people/me', {
            pageSize: 2000,
            personFields: 'names,emailAddresses,phoneNumbers,addresses,userDefined,memberships'
        });

        if (!response.connections || response.connections.length === 0) {
            return [];
        }

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
 */
function syncContactToSheet(contact) {
    const metadata = parseFamilyMetadataFromContact(contact.userDefined);
    const familyId = metadata.familyId;

    if (!familyId) {
        logWarning('Contact without Family ID found, skipping');
        return { updated: false, notFound: false };
    }

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

    const contactData = extractContactData(contact);

    const changes = detectChanges(existingData, contactData, metadata);

    if (changes.length === 0) {
        return { updated: false, familyId: familyId };
    }

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
 * FIXED: Extract names from new structure (middleName + familyName)
 * FIXED: Use shared address parsing (no trailing comma)
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

    // FIXED: Extract from middleName and familyName (not givenName which has ID)
    if (contact.names && contact.names.length > 0) {
        data.firstName = contact.names[0].middleName || '';
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

    // FIXED: Reconstruct clean address without trailing comma
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

    // FIXED: Compare address properly (rebuild without trailing comma)
    if (contactData.address || contactData.postalCode || contactData.city) {
        // Rebuild full address from parts (clean, no trailing comma)
        const parts = [contactData.address, contactData.postalCode, contactData.city]
            .filter(p => p && p.trim().length > 0);
        const contactFullAddress = parts.join(', ');

        const sheetAddress = (existingData[OUTPUT_COLUMNS.ADRESSE] || '').trim();

        if (contactFullAddress !== sheetAddress && contactFullAddress.length > 0) {
            changes.push({
                field: 'adresse',
                column: OUTPUT_COLUMNS.ADRESSE,
                oldValue: sheetAddress,
                newValue: contactFullAddress
            });
        }
    }

    // Compare criticité
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

    // Compare se déplace
    const sheetSeDeplace = existingData[OUTPUT_COLUMNS.SE_DEPLACE] === true;
    if (metadata.seDeplace !== sheetSeDeplace) {
        changes.push({
            field: 'se_deplace',
            column: OUTPUT_COLUMNS.SE_DEPLACE,
            oldValue: sheetSeDeplace,
            newValue: metadata.seDeplace
        });
    }

    return changes;
}

/**
 * Apply detected changes to sheet
 */
function applyChangesToSheet(sheet, row, existingData, contactData, metadata, changes) {
    // Check if household composition changes would result in zero persons
    const householdChanges = changes.filter(c => c.field === 'nombre_adulte' || c.field === 'nombre_enfant');

    if (householdChanges.length > 0) {
        let newAdultes = parseInt(existingData[OUTPUT_COLUMNS.NOMBRE_ADULTE]) || 0;
        let newEnfants = parseInt(existingData[OUTPUT_COLUMNS.NOMBRE_ENFANT]) || 0;

        householdChanges.forEach(change => {
            if (change.field === 'nombre_adulte') {
                newAdultes = change.newValue;
            } else if (change.field === 'nombre_enfant') {
                newEnfants = change.newValue;
            }
        });

        const validation = validateHouseholdComposition(newAdultes, newEnfants);

        if (!validation.isValid) {
            logWarning(`Skipping household update for family at row ${row}: ${validation.error}`);

            changes = changes.filter(c => c.field !== 'nombre_adulte' && c.field !== 'nombre_enfant');

            const existingComment = existingData[OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';
            const warningComment = addComment(
                existingComment,
                formatComment('⚠️', `Sync Contact ignoré: ${validation.error}`)
            );
            sheet.getRange(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(warningComment);

            if (changes.length === 0) {
                return;
            }
        }
    }

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
 * FIXED: Handle new name structure
 */
function extractContactName(contact) {
    if (contact.names && contact.names.length > 0) {
        const name = contact.names[0];
        // Try displayName first, fallback to building from parts
        if (name.displayName) {
            return name.displayName;
        }
        const parts = [name.middleName, name.familyName].filter(p => p);
        return parts.join(' ') || 'Unknown';
    }
    return 'Unknown';
}