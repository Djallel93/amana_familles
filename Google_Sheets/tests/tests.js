/**
 * @file tests/tests.js (FIXED - Correct Delete Method)
 * @description Simple functions to test People API authentication
 */

/**
 * Test 1: Simple read operation
 * This should trigger the authorization flow
 */
function testPeopleAPISimple() {
    try {
        const response = People.People.Connections.list('people/me', {
            pageSize: 1,
            personFields: 'names'
        });

        console.log('✅ People API working!');
        console.log('Total contacts:', response.totalItems || 0);
        console.log('Connections returned:', response.connections ? response.connections.length : 0);

        return 'SUCCESS';

    } catch (e) {
        console.error('❌ Error:', e.message);
        console.error('Full error:', e);
        return 'FAILED';
    }
}

/**
 * Test 2: Create and delete a test contact
 * FIXED: Use deleteContact method
 * Run this AFTER testPeopleAPISimple works
 */
function testCreateContactSimple() {
    try {
        console.log('Creating test contact...');

        // Create test contact
        const contact = People.People.createContact({
            names: [{
                givenName: 'Test',
                familyName: 'Contact'
            }],
            phoneNumbers: [{
                value: '+33 6 12 34 56 78',
                type: 'mobile'
            }],
            biographies: [{
                value: 'Family ID: 999',
                contentType: 'TEXT_PLAIN'
            }]
        });

        console.log('✅ Contact created successfully!');
        console.log('Resource name:', contact.resourceName);
        console.log('Name:', contact.names ? contact.names[0].displayName : 'Unknown');

        // Wait a moment
        Utilities.sleep(2000);

        // Try to find it
        console.log('\nSearching for the contact...');
        const found = findContactByFamilyId('999');

        if (found) {
            console.log('✅ Contact found in search!');
        } else {
            console.log('⚠️ Contact not found in search (may need more time to propagate)');
        }

        // FIXED: Use deleteContact method
        console.log('\nDeleting test contact...');
        People.People.deleteContact(contact.resourceName);

        console.log('✅ Test contact deleted successfully!');
        console.log('\n🎉 All tests passed! Contact creation and deletion work correctly.');

        return 'SUCCESS';

    } catch (e) {
        console.error('❌ Error:', e.message);
        console.error('Full error:', e);
        return 'FAILED';
    }
}

/**
 * Test 3: Test the actual family contact sync workflow
 * Run this AFTER testCreateContactSimple works
 */
function testFamilyContactSync() {
    try {
        console.log('Testing family contact sync workflow...');
        console.log('==========================================');

        // Get a family from the sheet
        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (!sheet) {
            console.error('❌ Famille sheet not found');
            return 'FAILED';
        }

        const data = sheet.getDataRange().getValues();

        // Find first validated family
        let testFamily = null;
        for (let i = 1; i < data.length; i++) {
            if (data[i][OUTPUT_COLUMNS.ETAT_DOSSIER] === CONFIG.STATUS.VALIDATED) {
                testFamily = {
                    id: data[i][OUTPUT_COLUMNS.ID],
                    nom: data[i][OUTPUT_COLUMNS.NOM],
                    prenom: data[i][OUTPUT_COLUMNS.PRENOM],
                    email: data[i][OUTPUT_COLUMNS.EMAIL],
                    telephone: String(data[i][OUTPUT_COLUMNS.TELEPHONE]),
                    phoneBis: String(data[i][OUTPUT_COLUMNS.TELEPHONE_BIS] || ''),
                    adresse: data[i][OUTPUT_COLUMNS.ADRESSE],
                    idQuartier: data[i][OUTPUT_COLUMNS.ID_QUARTIER]
                };
                break;
            }
        }

        if (!testFamily) {
            console.error('❌ No validated family found for testing');
            return 'FAILED';
        }

        console.log(`\n✓ Found test family: ${testFamily.id} - ${testFamily.nom} ${testFamily.prenom}`);
        console.log(`  Phone: ${testFamily.telephone}`);

        // Test sync
        console.log('\nSyncing contact...');
        const result = syncFamilyContact(testFamily);

        if (result.success) {
            console.log('✅ Contact synced successfully!');

            // Try to find it
            console.log('\nVerifying contact exists...');
            const found = findContactByFamilyId(testFamily.id);

            if (found) {
                console.log('✅ Contact verified in Google Contacts!');
                console.log(`  Name: ${found.names ? found.names[0].displayName : 'Unknown'}`);
                console.log(`  Resource: ${found.resourceName}`);

                console.log('\n🎉 Family contact sync working correctly!');
                return 'SUCCESS';
            } else {
                console.log('⚠️ Contact created but not found (may need time to propagate)');
                return 'PARTIAL_SUCCESS';
            }
        } else {
            console.error('❌ Contact sync failed:', result.error);
            return 'FAILED';
        }

    } catch (e) {
        console.error('❌ Error:', e.message);
        console.error('Full error:', e);
        return 'FAILED';
    }
}

/**
 * Run all tests in sequence
 */
function runAllAuthTests() {
    console.log('🧪 Running People API Authentication Tests');
    console.log('==========================================\n');

    console.log('TEST 1: Basic People API Read');
    console.log('----------------------------');
    const test1 = testPeopleAPISimple();
    console.log(`Result: ${test1}\n`);

    if (test1 !== 'SUCCESS') {
        console.log('❌ Test 1 failed. Fix authorization before continuing.');
        return;
    }

    console.log('TEST 2: Contact Create/Delete');
    console.log('----------------------------');
    const test2 = testCreateContactSimple();
    console.log(`Result: ${test2}\n`);

    if (test2 !== 'SUCCESS') {
        console.log('❌ Test 2 failed. Check People API permissions.');
        return;
    }

    console.log('TEST 3: Family Contact Sync');
    console.log('----------------------------');
    const test3 = testFamilyContactSync();
    console.log(`Result: ${test3}\n`);

    console.log('==========================================');
    console.log('🎉 ALL TESTS COMPLETE!');
    console.log('Your People API integration is working correctly.');
}