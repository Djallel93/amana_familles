/**
 * @file src/services/contactDebugHelpers.js
 * @description Helper functions to debug contact issues
 */

/**
 * List all contacts with their biographies (for debugging)
 * Run this from Script Editor to see what contacts exist
 */
function debugListAllContacts() {
    try {
        console.log('Attempting to list contacts...');
        console.log('==========================================');

        // Use the correct method: People.People.Connections.list
        const response = People.People.Connections.list('people/me', {
            pageSize: 100,
            personFields: 'names,biographies'
        });

        if (!response.connections || response.connections.length === 0) {
            console.log('No contacts found');
            return;
        }

        console.log(`Found ${response.connections.length} contacts:`);
        console.log('==========================================');

        response.connections.forEach((contact, index) => {
            const name = contact.names ? contact.names[0].displayName : 'No name';
            const bio = contact.biographies ? contact.biographies[0].value : 'No biography';

            console.log(`${index + 1}. ${name}`);
            console.log(`   Resource: ${contact.resourceName}`);
            console.log(`   Biography: ${bio}`);
            console.log('------------------------------------------');
        });

        console.log('==========================================');
        console.log('Listing complete');

    } catch (e) {
        console.error('Error listing contacts:', e);
        console.error('Error details:', JSON.stringify(e));
    }
}

/**
 * Search for a specific family ID in contacts
 * @param {string|number} familyId - The family ID to search for
 */
function debugFindContactByFamilyId(familyId) {
    try {
        const searchId = String(familyId);
        console.log(`Searching for family ID: ${searchId}`);
        console.log('==========================================');

        // Only use list method (search API not available)
        console.log('Scanning all connections...');
        const response = People.People.Connections.list('people/me', {
            pageSize: 2000,
            personFields: 'names,biographies,phoneNumbers,emailAddresses'
        });

        if (response.connections && response.connections.length > 0) {
            console.log(`   Scanning ${response.connections.length} contacts...`);

            let found = false;
            response.connections.forEach((contact) => {
                if (contact.biographies) {
                    for (const bio of contact.biographies) {
                        if (bio.value && bio.value.includes(`Family ID: ${searchId}`)) {
                            const name = contact.names ? contact.names[0].displayName : 'No name';
                            const phone = contact.phoneNumbers ? contact.phoneNumbers[0].value : 'No phone';
                            const email = contact.emailAddresses ? contact.emailAddresses[0].value : 'No email';

                            console.log(`\n   ✓ FOUND CONTACT:`);
                            console.log(`      Name: ${name}`);
                            console.log(`      Phone: ${phone}`);
                            console.log(`      Email: ${email}`);
                            console.log(`      Resource: ${contact.resourceName}`);
                            console.log(`      Biography: ${bio.value}`);
                            found = true;
                        }
                    }
                }
            });

            if (!found) {
                console.log(`\n   ✗ No matching contact found for Family ID: ${searchId}`);
                console.log(`\n   💡 This could mean:`);
                console.log(`      - Contact was not created`);
                console.log(`      - Contact was deleted`);
                console.log(`      - Biography field doesn't contain "Family ID: ${searchId}"`);
            }
        } else {
            console.log('   No connections returned');
        }

        console.log('\n==========================================');
        console.log('Search complete');

    } catch (e) {
        console.error('Error in debug search:', e);
        console.error('Error details:', JSON.stringify(e));
    }
}

/**
 * Delete a contact by family ID with detailed logging
 * @param {string|number} familyId - The family ID
 */
function debugDeleteContactByFamilyId(familyId) {
    try {
        console.log(`Attempting to delete contact for family ID: ${familyId}`);
        console.log('==========================================');

        const contact = findContactByFamilyId(familyId);

        if (!contact) {
            console.log('❌ Contact not found');
            return;
        }

        console.log('✓ Contact found:');
        console.log(`  Name: ${contact.names ? contact.names[0].displayName : 'No name'}`);
        console.log(`  Resource: ${contact.resourceName}`);

        // Delete
        People.People.deleteContact({
            resourceName: contact.resourceName
        });

        console.log('✓ Contact deleted successfully');

    } catch (e) {
        console.error('❌ Error deleting contact:', e);
    }
}

/**
 * Test contact creation for a family
 * @param {number} familyId - The family ID from the sheet
 */
function debugTestContactCreation(familyId) {
    try {
        console.log(`Testing contact creation for family ID: ${familyId}`);
        console.log('==========================================');

        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (!sheet) {
            console.log('❌ Famille sheet not found');
            return;
        }

        const data = sheet.getDataRange().getValues();
        let familyRow = null;

        for (let i = 1; i < data.length; i++) {
            if (data[i][OUTPUT_COLUMNS.ID] === familyId) {
                familyRow = data[i];
                break;
            }
        }

        if (!familyRow) {
            console.log(`❌ Family ${familyId} not found in sheet`);
            return;
        }

        console.log('\n✓ Family data found:');
        console.log(`  Nom: ${familyRow[OUTPUT_COLUMNS.NOM]}`);
        console.log(`  Prénom: ${familyRow[OUTPUT_COLUMNS.PRENOM]}`);
        console.log(`  Téléphone: ${familyRow[OUTPUT_COLUMNS.TELEPHONE]}`);
        console.log(`  Email: ${familyRow[OUTPUT_COLUMNS.EMAIL]}`);

        const familyData = {
            id: familyId,
            nom: familyRow[OUTPUT_COLUMNS.NOM],
            prenom: familyRow[OUTPUT_COLUMNS.PRENOM],
            email: familyRow[OUTPUT_COLUMNS.EMAIL],
            telephone: String(familyRow[OUTPUT_COLUMNS.TELEPHONE] || ''),
            phoneBis: String(familyRow[OUTPUT_COLUMNS.TELEPHONE_BIS] || ''),
            adresse: familyRow[OUTPUT_COLUMNS.ADRESSE],
            idQuartier: familyRow[OUTPUT_COLUMNS.ID_QUARTIER]
        };

        console.log('\nAttempting to sync contact...');
        const result = syncFamilyContact(familyData);

        if (result.success) {
            console.log('✓ Contact synced successfully');

            // Try to find it
            console.log('\nVerifying contact was created...');
            const foundContact = findContactByFamilyId(familyId);

            if (foundContact) {
                console.log('✓ Contact verified in Google Contacts');
                console.log(`  Resource: ${foundContact.resourceName}`);
            } else {
                console.log('⚠️ Contact created but not found in search (may need a moment to propagate)');
            }
        } else {
            console.log(`❌ Contact sync failed: ${result.error}`);
        }

    } catch (e) {
        console.error('❌ Error in test:', e);
    }
}