/**
 * @file src/services/reverseContactSyncService.js (UPDATED v6.0)
 * @description Reverse sync with CANONICAL address formatting
 * CHANGE: Uses formatAddressCanonical for consistent address comparison
 */

/**
 * Main reverse sync function - fetch all contacts and sync to sheet
 */
function reverseContactSync() {
    try {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔄 STARTING REVERSE CONTACT SYNC (Contacts → Sheet)');
        console.log('═══════════════════════════════════════════════════════════');

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
            console.log('⚠️ No family contacts found in "Famille dans le besoin" group');
            return {
                success: true,
                message: 'No contacts to sync',
                results: results
            };
        }

        console.log(`✅ Found ${familyContacts.length} family contacts to check`);
        results.total = familyContacts.length;

        familyContacts.forEach((contact, index) => {
            console.log(`\n───────────────────────────────────────────────────────────`);
            console.log(`📇 Processing contact ${index + 1}/${familyContacts.length}`);
            console.log(`───────────────────────────────────────────────────────────`);

            try {
                const syncResult = syncContactToSheet(contact);

                if (syncResult.updated) {
                    results.updated++;
                    results.details.push({
                        familyId: syncResult.familyId,
                        status: 'updated',
                        changes: syncResult.changes
                    });
                    console.log(`✅ UPDATED: Family ${syncResult.familyId} - ${syncResult.changes.length} changes`);
                } else if (syncResult.notFound) {
                    results.notFound++;
                    results.details.push({
                        familyId: syncResult.familyId,
                        status: 'not_found'
                    });
                    console.log(`❓ NOT FOUND: Family ${syncResult.familyId} not in sheet`);
                } else {
                    results.unchanged++;
                    console.log(`➖ UNCHANGED: Family ${syncResult.familyId || 'Unknown'}`);
                }

            } catch (error) {
                results.errors++;
                console.error('❌ ERROR processing contact:', error);
                results.details.push({
                    contact: extractContactName(contact),
                    status: 'error',
                    error: error.toString()
                });
            }
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📊 REVERSE SYNC RESULTS');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`Total processed: ${results.total}`);
        console.log(`✅ Updated: ${results.updated}`);
        console.log(`➖ Unchanged: ${results.unchanged}`);
        console.log(`❓ Not found: ${results.notFound}`);
        console.log(`❌ Errors: ${results.errors}`);
        console.log(`⏱️ Duration: ${duration}s`);
        console.log('═══════════════════════════════════════════════════════════\n');

        if (results.updated > 0) {
            notifyAdmin(
                '🔄 Reverse Contact Sync Completed',
                `Synchronisation Contacts → Feuille terminée\n\n` +
                `Total traité: ${results.total}\n` +
                `✅ Mis à jour: ${results.updated}\n` +
                `➖ Inchangés: ${results.unchanged}\n` +
                `❓ Non trouvés: ${results.notFound}\n` +
                `❌ Erreurs: ${results.errors}\n\n` +
                `Durée: ${duration}s`
            );
        }

        return {
            success: true,
            results: results,
            duration: duration
        };

    } catch (error) {
        console.error('❌ FATAL ERROR in reverse sync:', error);
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
        console.log('📋 Fetching family contacts...');

        const mainGroupId = getOrCreateContactGroup('Famille dans le besoin');
        console.log(`   Group ID: ${mainGroupId}`);

        if (!mainGroupId) {
            console.error('❌ Main contact group not found');
            return [];
        }

        const response = People.People.Connections.list('people/me', {
            pageSize: 2000,
            personFields: 'names,emailAddresses,phoneNumbers,addresses,userDefined,memberships'
        });

        if (!response.connections || response.connections.length === 0) {
            console.log('⚠️ No connections found');
            return [];
        }

        console.log(`   Total connections: ${response.connections.length}`);

        const familyContacts = response.connections.filter(contact => {
            if (!contact.memberships) return false;

            return contact.memberships.some(m =>
                m.contactGroupMembership &&
                m.contactGroupMembership.contactGroupResourceName === mainGroupId
            );
        });

        console.log(`   Family contacts: ${familyContacts.length}`);
        return familyContacts;

    } catch (error) {
        console.error('❌ Failed to fetch family contacts:', error);
        return [];
    }
}

/**
 * Sync single contact to sheet
 * UPDATED: Uses formatAddressCanonical for comparison
 */
function syncContactToSheet(contact) {
    console.log('\n🔍 Extracting contact data...');

    // Parse family ID from givenName (format: "{ID} -")
    let familyId = null;
    if (contact.names && contact.names.length > 0) {
        const givenName = contact.names[0].givenName || '';
        const match = givenName.match(/^(\d+)\s*-/);
        if (match) {
            familyId = match[1];
            console.log(`✅ Family ID parsed from givenName: ${familyId}`);
        } else {
            console.log(`⚠️ Could not parse Family ID from givenName: "${givenName}"`);
        }
    }

    // Parse metadata from custom fields
    const metadata = parseFamilyMetadataFromContact(contact.userDefined);

    console.log('📋 Contact Metadata:');
    console.log(`   Family ID (from givenName): ${familyId}`);
    console.log(`   Criticité: ${metadata.criticite}`);
    console.log(`   Adultes: ${metadata.nombreAdulte}`);
    console.log(`   Enfants: ${metadata.nombreEnfant}`);
    console.log(`   Zakat El Fitr: ${metadata.zakatElFitr} (type: ${typeof metadata.zakatElFitr})`);
    console.log(`   Sadaqa: ${metadata.sadaqa} (type: ${typeof metadata.sadaqa})`);
    console.log(`   Langue: ${metadata.langue}`);
    console.log(`   Se Déplace: ${metadata.seDeplace} (type: ${typeof metadata.seDeplace})`);
    console.log(`   Last Update: ${metadata.lastUpdate}`);

    if (!familyId) {
        console.log('⚠️ Contact without Family ID, skipping');
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
        console.log(`❓ Family ${familyId} not found in sheet`);
        return { updated: false, notFound: true, familyId: familyId };
    }

    console.log(`✅ Found family in sheet at row ${targetRow}`);

    // Log existing sheet data
    console.log('\n📊 Current Sheet Data:');
    console.log(`   Nom: "${existingData[OUTPUT_COLUMNS.NOM]}"`);
    console.log(`   Prénom: "${existingData[OUTPUT_COLUMNS.PRENOM]}"`);
    console.log(`   Téléphone: "${existingData[OUTPUT_COLUMNS.TELEPHONE]}"`);
    console.log(`   Téléphone Bis: "${existingData[OUTPUT_COLUMNS.TELEPHONE_BIS]}"`);
    console.log(`   Email: "${existingData[OUTPUT_COLUMNS.EMAIL]}"`);
    console.log(`   Adresse: "${existingData[OUTPUT_COLUMNS.ADRESSE]}"`);
    console.log(`   Criticité: ${existingData[OUTPUT_COLUMNS.CRITICITE]} (type: ${typeof existingData[OUTPUT_COLUMNS.CRITICITE]})`);
    console.log(`   Adultes: ${existingData[OUTPUT_COLUMNS.NOMBRE_ADULTE]} (type: ${typeof existingData[OUTPUT_COLUMNS.NOMBRE_ADULTE]})`);
    console.log(`   Enfants: ${existingData[OUTPUT_COLUMNS.NOMBRE_ENFANT]} (type: ${typeof existingData[OUTPUT_COLUMNS.NOMBRE_ENFANT]})`);
    console.log(`   Zakat El Fitr: ${existingData[OUTPUT_COLUMNS.ZAKAT_EL_FITR]} (type: ${typeof existingData[OUTPUT_COLUMNS.ZAKAT_EL_FITR]})`);
    console.log(`   Sadaqa: ${existingData[OUTPUT_COLUMNS.SADAQA]} (type: ${typeof existingData[OUTPUT_COLUMNS.SADAQA]})`);
    console.log(`   Langue: "${existingData[OUTPUT_COLUMNS.LANGUE]}"`);
    console.log(`   Se Déplace: ${existingData[OUTPUT_COLUMNS.SE_DEPLACE]} (type: ${typeof existingData[OUTPUT_COLUMNS.SE_DEPLACE]})`);

    const contactData = extractContactData(contact);

    console.log('\n📇 Contact Data (names, phones, email, address):');
    console.log(`   First Name: "${contactData.firstName}"`);
    console.log(`   Last Name: "${contactData.lastName}"`);
    console.log(`   Phone: "${contactData.phone}"`);
    console.log(`   Phone Bis: "${contactData.phoneBis}"`);
    console.log(`   Email: "${contactData.email}"`);
    console.log(`   Address : "${contactData.addressCanonical}"`);

    console.log('\n🔍 Detecting changes...');
    const changes = detectChanges(existingData, contactData, metadata);

    console.log(`📝 Changes detected: ${changes.length}`);
    if (changes.length > 0) {
        changes.forEach((change, idx) => {
            console.log(`   ${idx + 1}. ${change.field}: "${change.oldValue}" → "${change.newValue}"`);
        });
    } else {
        console.log('   ✅ No changes detected');
    }

    if (changes.length === 0) {
        return { updated: false, familyId: familyId };
    }

    console.log('\n💾 Applying changes to sheet...');
    applyChangesToSheet(sheet, targetRow, existingData, contactData, metadata, changes);

    console.log(`✅ Contact synced successfully for family ${familyId}`);

    return {
        updated: true,
        familyId: familyId,
        changes: changes
    };
}

/**
 * Extract relevant data from contact
 * UPDATED: Uses formatAddressCanonical for consistent formatting
 */
function extractContactData(contact) {
    const data = {
        firstName: '',
        lastName: '',
        phone: '',
        phoneBis: '',
        email: '',
        addressCanonical: ''  // CHANGED: Store canonical address
    };

    // Extract firstName from middleName and lastName from familyName
    if (contact.names && contact.names.length > 0) {
        data.firstName = contact.names[0].middleName || '';
        data.lastName = contact.names[0].familyName || '';
        console.log(`   Raw name data - middleName: "${contact.names[0].middleName}", familyName: "${contact.names[0].familyName}"`);
    }

    // Phone numbers
    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
        data.phone = normalizePhone(contact.phoneNumbers[0].value);
        console.log(`   Raw phone[0]: "${contact.phoneNumbers[0].value}" → normalized: "${data.phone}"`);

        if (contact.phoneNumbers.length > 1) {
            data.phoneBis = normalizePhone(contact.phoneNumbers[1].value);
            console.log(`   Raw phone[1]: "${contact.phoneNumbers[1].value}" → normalized: "${data.phoneBis}"`);
        }
    }

    // Email
    if (contact.emailAddresses && contact.emailAddresses.length > 0) {
        data.email = contact.emailAddresses[0].value;
        console.log(`   Email: "${data.email}"`);
    }

    // CRITICAL FIX: Use canonical address formatting
    if (contact.addresses && contact.addresses.length > 0) {
        const addr = contact.addresses[0];
        const street = addr.streetAddress || '';
        const postalCode = addr.postalCode || '';
        const city = addr.city || '';

        // Use canonical formatter for consistency
        data.addressCanonical = formatAddressCanonical(street, postalCode, city);

        console.log(`   Raw address - street: "${street}", postal: "${postalCode}", city: "${city}"`);
        console.log(`   Canonical address: "${data.addressCanonical}"`);
    }

    return data;
}

/**
 * Detect changes between sheet data and contact data
 * UPDATED: Compares canonical addresses
 */
function detectChanges(existingData, contactData, metadata) {
    const changes = [];

    console.log('\n🔎 DETAILED COMPARISON:');

    // Compare names
    const sheetFirstName = (existingData[OUTPUT_COLUMNS.PRENOM] || '').trim();
    const sheetLastName = (existingData[OUTPUT_COLUMNS.NOM] || '').trim();

    console.log(`\n1️⃣ First Name: Sheet="${sheetFirstName}" vs Contact="${contactData.firstName}"`);
    if (contactData.firstName && contactData.firstName !== sheetFirstName) {
        console.log('   ✅ CHANGE DETECTED!');
        changes.push({
            field: 'prenom',
            column: OUTPUT_COLUMNS.PRENOM,
            oldValue: sheetFirstName,
            newValue: contactData.firstName
        });
    } else {
        console.log('   ➖ No change');
    }

    console.log(`\n2️⃣ Last Name: Sheet="${sheetLastName}" vs Contact="${contactData.lastName}"`);
    if (contactData.lastName && contactData.lastName !== sheetLastName) {
        console.log('   ✅ CHANGE DETECTED!');
        changes.push({
            field: 'nom',
            column: OUTPUT_COLUMNS.NOM,
            oldValue: sheetLastName,
            newValue: contactData.lastName
        });
    } else {
        console.log('   ➖ No change');
    }

    // Compare phone
    const sheetPhone = normalizePhone(String(existingData[OUTPUT_COLUMNS.TELEPHONE] || '')).replace(/[\s\(\)]/g, '');
    const contactPhone = contactData.phone.replace(/[\s\(\)]/g, '');

    console.log(`\n3️⃣ Phone: Sheet="${sheetPhone}" vs Contact="${contactPhone}"`);
    if (contactPhone && contactPhone !== sheetPhone) {
        console.log('   ✅ CHANGE DETECTED!');
        changes.push({
            field: 'telephone',
            column: OUTPUT_COLUMNS.TELEPHONE,
            oldValue: existingData[OUTPUT_COLUMNS.TELEPHONE],
            newValue: contactData.phone
        });
    } else {
        console.log('   ➖ No change');
    }

    // Compare phone bis
    const sheetPhoneBis = normalizePhone(String(existingData[OUTPUT_COLUMNS.TELEPHONE_BIS] || '')).replace(/[\s\(\)]/g, '');
    const contactPhoneBis = contactData.phoneBis.replace(/[\s\(\)]/g, '');

    console.log(`\n4️⃣ Phone Bis: Sheet="${sheetPhoneBis}" vs Contact="${contactPhoneBis}"`);
    if (contactPhoneBis !== sheetPhoneBis) {
        console.log('   ✅ CHANGE DETECTED!');
        changes.push({
            field: 'telephone_bis',
            column: OUTPUT_COLUMNS.TELEPHONE_BIS,
            oldValue: existingData[OUTPUT_COLUMNS.TELEPHONE_BIS],
            newValue: contactData.phoneBis
        });
    } else {
        console.log('   ➖ No change');
    }

    // Compare email
    const sheetEmail = (existingData[OUTPUT_COLUMNS.EMAIL] || '').toLowerCase().trim();
    const contactEmail = contactData.email.toLowerCase().trim();

    console.log(`\n5️⃣ Email: Sheet="${sheetEmail}" vs Contact="${contactEmail}"`);
    if (contactEmail && contactEmail !== sheetEmail) {
        console.log('   ✅ CHANGE DETECTED!');
        changes.push({
            field: 'email',
            column: OUTPUT_COLUMNS.EMAIL,
            oldValue: existingData[OUTPUT_COLUMNS.EMAIL],
            newValue: contactData.email
        });
    } else {
        console.log('   ➖ No change');
    }

    // CRITICAL FIX: Compare canonical addresses
    const sheetAddress = (existingData[OUTPUT_COLUMNS.ADRESSE] || '').trim();
    const contactAddress = contactData.addressCanonical;

    console.log(`\n6️⃣ Address : Sheet="${sheetAddress}" vs Contact="${contactAddress}"`);
    if (contactAddress && contactAddress !== sheetAddress && contactAddress.length > 0) {
        console.log('   ✅ CHANGE DETECTED!');
        changes.push({
            field: 'adresse',
            column: OUTPUT_COLUMNS.ADRESSE,
            oldValue: sheetAddress,
            newValue: contactAddress
        });
    } else {
        console.log('   ➖ No change');
    }

    // Compare criticité
    const sheetCriticite = parseInt(existingData[OUTPUT_COLUMNS.CRITICITE]) || 0;
    console.log(`\n7️⃣ Criticité: Sheet=${sheetCriticite} (${typeof sheetCriticite}) vs Contact=${metadata.criticite} (${typeof metadata.criticite})`);
    console.log(`   Comparison: ${metadata.criticite} !== ${sheetCriticite} = ${metadata.criticite !== sheetCriticite}`);
    if (metadata.criticite !== sheetCriticite) {
        console.log('   ✅ CHANGE DETECTED!');
        changes.push({
            field: 'criticite',
            column: OUTPUT_COLUMNS.CRITICITE,
            oldValue: sheetCriticite,
            newValue: metadata.criticite
        });
    } else {
        console.log('   ➖ No change');
    }

    // Compare household composition
    const sheetAdultes = parseInt(existingData[OUTPUT_COLUMNS.NOMBRE_ADULTE]) || 0;
    console.log(`\n8️⃣ Adultes: Sheet=${sheetAdultes} vs Contact=${metadata.nombreAdulte}`);
    if (metadata.nombreAdulte !== sheetAdultes) {
        console.log('   ✅ CHANGE DETECTED!');
        changes.push({
            field: 'nombre_adulte',
            column: OUTPUT_COLUMNS.NOMBRE_ADULTE,
            oldValue: sheetAdultes,
            newValue: metadata.nombreAdulte
        });
    } else {
        console.log('   ➖ No change');
    }

    const sheetEnfants = parseInt(existingData[OUTPUT_COLUMNS.NOMBRE_ENFANT]) || 0;
    console.log(`\n9️⃣ Enfants: Sheet=${sheetEnfants} vs Contact=${metadata.nombreEnfant}`);
    if (metadata.nombreEnfant !== sheetEnfants) {
        console.log('   ✅ CHANGE DETECTED!');
        changes.push({
            field: 'nombre_enfant',
            column: OUTPUT_COLUMNS.NOMBRE_ENFANT,
            oldValue: sheetEnfants,
            newValue: metadata.nombreEnfant
        });
    } else {
        console.log('   ➖ No change');
    }

    // Compare Zakat El Fitr
    const sheetZakat = existingData[OUTPUT_COLUMNS.ZAKAT_EL_FITR] === true;
    console.log(`\n🔟 Zakat El Fitr: Sheet=${sheetZakat} (${typeof sheetZakat}) vs Contact=${metadata.zakatElFitr} (${typeof metadata.zakatElFitr})`);
    console.log(`   Raw sheet value: "${existingData[OUTPUT_COLUMNS.ZAKAT_EL_FITR]}" (type: ${typeof existingData[OUTPUT_COLUMNS.ZAKAT_EL_FITR]})`);
    console.log(`   Comparison: ${metadata.zakatElFitr} !== ${sheetZakat} = ${metadata.zakatElFitr !== sheetZakat}`);
    if (metadata.zakatElFitr !== sheetZakat) {
        console.log('   ✅ CHANGE DETECTED!');
        changes.push({
            field: 'zakat_el_fitr',
            column: OUTPUT_COLUMNS.ZAKAT_EL_FITR,
            oldValue: sheetZakat,
            newValue: metadata.zakatElFitr
        });
    } else {
        console.log('   ➖ No change');
    }

    // Compare Sadaqa
    const sheetSadaqa = existingData[OUTPUT_COLUMNS.SADAQA] === true;
    console.log(`\n1️⃣1️⃣ Sadaqa: Sheet=${sheetSadaqa} (${typeof sheetSadaqa}) vs Contact=${metadata.sadaqa} (${typeof metadata.sadaqa})`);
    console.log(`   Raw sheet value: "${existingData[OUTPUT_COLUMNS.SADAQA]}" (type: ${typeof existingData[OUTPUT_COLUMNS.SADAQA]})`);
    console.log(`   Comparison: ${metadata.sadaqa} !== ${sheetSadaqa} = ${metadata.sadaqa !== sheetSadaqa}`);
    if (metadata.sadaqa !== sheetSadaqa) {
        console.log('   ✅ CHANGE DETECTED!');
        changes.push({
            field: 'sadaqa',
            column: OUTPUT_COLUMNS.SADAQA,
            oldValue: sheetSadaqa,
            newValue: metadata.sadaqa
        });
    } else {
        console.log('   ➖ No change');
    }

    // Compare langue
    const sheetLangue = existingData[OUTPUT_COLUMNS.LANGUE] || CONFIG.LANGUAGES.FR;
    console.log(`\n1️⃣2️⃣ Langue: Sheet="${sheetLangue}" vs Contact="${metadata.langue}"`);
    if (metadata.langue !== sheetLangue) {
        console.log('   ✅ CHANGE DETECTED!');
        changes.push({
            field: 'langue',
            column: OUTPUT_COLUMNS.LANGUE,
            oldValue: sheetLangue,
            newValue: metadata.langue
        });
    } else {
        console.log('   ➖ No change');
    }

    // Compare se déplace
    const sheetSeDeplace = existingData[OUTPUT_COLUMNS.SE_DEPLACE] === true;
    console.log(`\n1️⃣3️⃣ Se Déplace: Sheet=${sheetSeDeplace} (${typeof sheetSeDeplace}) vs Contact=${metadata.seDeplace} (${typeof metadata.seDeplace})`);
    console.log(`   Raw sheet value: "${existingData[OUTPUT_COLUMNS.SE_DEPLACE]}" (type: ${typeof existingData[OUTPUT_COLUMNS.SE_DEPLACE]})`);
    console.log(`   Comparison: ${metadata.seDeplace} !== ${sheetSeDeplace} = ${metadata.seDeplace !== sheetSeDeplace}`);
    if (metadata.seDeplace !== sheetSeDeplace) {
        console.log('   ✅ CHANGE DETECTED!');
        changes.push({
            field: 'se_deplace',
            column: OUTPUT_COLUMNS.SE_DEPLACE,
            oldValue: sheetSeDeplace,
            newValue: metadata.seDeplace
        });
    } else {
        console.log('   ➖ No change');
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
            console.log(`⚠️ Skipping household update: ${validation.error}`);

            changes = changes.filter(c => c.field !== 'nombre_adulte' && c.field !== 'nombre_enfant');
            appendSheetComment(sheet, row, '⚠️', `Sync Contact ignoré: ${validation.error}`);

            if (changes.length === 0) {
                console.log('⚠️ No valid changes remaining after validation');
                return;
            }
        }
    }

    // Apply each change
    console.log(`💾 Applying ${changes.length} changes to row ${row}...`);
    changes.forEach((change, idx) => {
        console.log(`   ${idx + 1}. Setting ${change.field} to "${change.newValue}" at column ${change.column + 1}`);
        sheet.getRange(row, change.column + 1).setValue(change.newValue);
    });
    appendSheetComment(sheet, row, '🔄', 'Sync Contact → Feuille');
    console.log(`✅ Applied ${changes.length} changes successfully`);
}

/**
 * Extract contact name for logging
 */
function extractContactName(contact) {
    if (contact.names && contact.names.length > 0) {
        const name = contact.names[0];
        if (name.displayName) {
            return name.displayName;
        }
        const parts = [name.middleName, name.familyName].filter(p => p);
        return parts.join(' ') || 'Unknown';
    }
    return 'Unknown';
}