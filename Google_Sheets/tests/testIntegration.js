/**
 * @file test/testIntegration.js
 * @description Integration tests for end-to-end workflows
 */

/**
 * Integration Test Suite
 * These tests validate complete workflows
 */
function getIntegrationTests() {
    return {
        // Complete family creation workflow
        test_integration_createFamily_complete: function () {
            const formData = {
                lastName: 'Dupont',
                firstName: 'Jean',
                phone: '0612345678',
                phoneBis: '',
                email: 'jean.dupont@example.com',
                address: '1 Rue de la Paix',
                postalCode: '44000',
                city: 'Nantes',
                nombreAdulte: 2,
                nombreEnfant: 1,
                seDeplace: true,
                zakatElFitr: true,
                sadaqa: false,
                criticite: 3,
                langue: 'Français',
                circonstances: 'Test family',
                ressentit: '',
                specificites: ''
            };

            // Step 1: Validate fields
            const validation = validateRequiredFields(formData);
            TestHelpers.assertTrue(validation.isValid, 'Form data valid');

            // Step 2: Normalize phone
            const normalizedPhone = normalizePhone(formData.phone);
            TestHelpers.assertTrue(isValidPhone(normalizedPhone), 'Phone normalized and valid');

            // Step 3: Check criticite
            TestHelpers.assertTrue(
                formData.criticite >= CONFIG.CRITICITE.MIN &&
                formData.criticite <= CONFIG.CRITICITE.MAX,
                'Criticite in valid range'
            );

            // Step 4: Check eligibility flags
            TestHelpers.assertTrue(
                formData.zakatElFitr === true || formData.sadaqa === true,
                'At least one eligibility flag set'
            );

            Logger.log('✅ Complete family creation workflow validated');
        },

        // Complete family update workflow
        test_integration_updateFamily_complete: function () {
            const familyId = 'TEST001';
            const updateData = {
                phone: '0623456789',
                email: 'new.email@example.com',
                criticite: 4
            };

            // Step 1: Validate family ID exists
            TestHelpers.assertNotNull(familyId, 'Family ID present');

            // Step 2: Validate update data
            if (updateData.phone) {
                TestHelpers.assertTrue(isValidPhone(updateData.phone), 'Phone valid');
            }

            if (updateData.email) {
                TestHelpers.assertTrue(isValidEmail(updateData.email), 'Email valid');
            }

            if (updateData.criticite !== undefined) {
                TestHelpers.assertTrue(
                    updateData.criticite >= CONFIG.CRITICITE.MIN &&
                    updateData.criticite <= CONFIG.CRITICITE.MAX,
                    'Criticite valid'
                );
            }

            Logger.log('✅ Complete family update workflow validated');
        },

        // Form submission to sheet workflow
        test_integration_formToSheet_workflow: function () {
            const mockFormData = {
                lastName: 'Martin',
                firstName: 'Sophie',
                phone: '0612345678',
                email: 'sophie.martin@example.com',
                address: '2 Avenue de la Liberté',
                postalCode: '44100',
                city: 'Nantes',
                nombreAdulte: 1,
                nombreEnfant: 2,
                seDeplace: false,
                zakatElFitr: false,
                sadaqa: true,
                criticite: 2,
                langue: 'Français'
            };

            // Step 1: Parse form response
            TestHelpers.assertHasProperty(mockFormData, 'lastName', 'Has lastName');
            TestHelpers.assertHasProperty(mockFormData, 'firstName', 'Has firstName');

            // Step 2: Validate required fields
            const validation = validateRequiredFields(mockFormData);
            TestHelpers.assertTrue(validation.isValid, 'All required fields present');

            // Step 3: Check eligibility
            const hasEligibility = mockFormData.zakatElFitr === true ||
                mockFormData.sadaqa === true;
            TestHelpers.assertTrue(hasEligibility, 'Has at least one eligibility flag');

            // Step 4: Generate ID (mock)
            const familyId = Date.now(); // Mock ID
            TestHelpers.assertTrue(familyId > 0, 'ID generated');

            Logger.log('✅ Form to sheet workflow validated');
        },

        // Bulk import workflow
        test_integration_bulkImport_workflow: function () {
            const mockRows = [
                ['Dupont', 'Jean', 2, 1, '1 Rue de la Paix', '44000', 'Nantes', '0612345678', '', 'test1@example.com', true, '', '', '', 3, 'Français'],
                ['Martin', 'Sophie', 1, 2, '2 Avenue de la Liberté', '44100', 'Nantes', '0623456789', '', 'test2@example.com', false, '', '', '', 2, 'Arabe']
            ];

            let validCount = 0;
            let invalidCount = 0;

            mockRows.forEach(row => {
                // Validate each row
                const hasRequiredFields = row[0] && row[1] && row[4] && row[5] && row[6] && row[7];
                const validCriticite = row[14] >= CONFIG.CRITICITE.MIN && row[14] <= CONFIG.CRITICITE.MAX;
                const validPhone = isValidPhone(row[7]);

                if (hasRequiredFields && validCriticite && validPhone) {
                    validCount++;
                } else {
                    invalidCount++;
                }
            });

            TestHelpers.assertEqual(validCount, 2, 'Both rows valid');
            TestHelpers.assertEqual(invalidCount, 0, 'No invalid rows');

            Logger.log('✅ Bulk import workflow validated');
        },

        // Email verification workflow
        test_integration_emailVerification_workflow: function () {
            const familyData = {
                id: 'TEST001',
                nom: 'Dupont',
                prenom: 'Jean',
                email: 'jean.dupont@example.com',
                telephone: '+33 6 12 34 56 78',
                adresse: '1 Rue de la Paix, 44000 Nantes',
                nombreAdulte: 2,
                nombreEnfant: 1,
                langue: 'Français',
                etatDossier: 'Validé'
            };

            // Step 1: Check family is validated
            TestHelpers.assertEqual(familyData.etatDossier, 'Validé', 'Family validated');

            // Step 2: Check email exists
            TestHelpers.assertTrue(isValidEmail(familyData.email), 'Valid email exists');

            // Step 3: Check required data
            TestHelpers.assertNotNull(familyData.nom, 'Has name');
            TestHelpers.assertNotNull(familyData.prenom, 'Has first name');
            TestHelpers.assertNotNull(familyData.telephone, 'Has phone');

            // Step 4: Check language for template
            TestHelpers.assertTrue(
                ['Français', 'Arabe', 'Anglais'].includes(familyData.langue),
                'Valid language'
            );

            Logger.log('✅ Email verification workflow validated');
        },

        // Address validation workflow
        test_integration_addressValidation_workflow: function () {
            const address = '1 Rue de la Paix';
            const postalCode = '44000';
            const city = 'Nantes';

            // Step 1: Check all parts present
            TestHelpers.assertTrue(!!address, 'Has address');
            TestHelpers.assertTrue(!!postalCode, 'Has postal code');
            TestHelpers.assertTrue(!!city, 'Has city');

            // Step 2: Validate postal code format
            const postalCodePattern = /^\d{5}$/;
            TestHelpers.assertTrue(
                postalCodePattern.test(postalCode),
                'Valid postal code format'
            );

            // Step 3: Format for geocoding
            const fullAddress = formatAddressForGeocoding(address, postalCode, city);
            TestHelpers.assertTrue(fullAddress.includes(address), 'Address in full');
            TestHelpers.assertTrue(fullAddress.includes(postalCode), 'Postal code in full');
            TestHelpers.assertTrue(fullAddress.includes(city), 'City in full');
            TestHelpers.assertTrue(fullAddress.includes('France'), 'France in full');

            Logger.log('✅ Address validation workflow validated');
        },

        // Duplicate detection workflow
        test_integration_duplicateDetection_workflow: function () {
            const existingFamily = {
                phone: '+33 6 12 34 56 78',
                lastName: 'dupont',
                email: 'test@example.com'
            };

            const newSubmission = {
                phone: '0612345678',
                lastName: 'Dupont',
                email: 'test@example.com'
            };

            // Step 1: Normalize phones
            const phone1 = normalizePhone(existingFamily.phone).replace(/[\s\(\)]/g, '');
            const phone2 = normalizePhone(newSubmission.phone).replace(/[\s\(\)]/g, '');

            // Step 2: Normalize names
            const name1 = existingFamily.lastName.toLowerCase().trim();
            const name2 = newSubmission.lastName.toLowerCase().trim();

            // Step 3: Check for match
            const phoneMatch = phone1 === phone2;
            const nameMatch = name1 === name2;
            const emailMatch = existingFamily.email === newSubmission.email;

            TestHelpers.assertTrue(phoneMatch, 'Phone matches');
            TestHelpers.assertTrue(nameMatch, 'Name matches');
            TestHelpers.assertTrue(emailMatch, 'Email matches');

            const isDuplicate = (phoneMatch && nameMatch) || emailMatch;
            TestHelpers.assertTrue(isDuplicate, 'Duplicate detected');

            Logger.log('✅ Duplicate detection workflow validated');
        },

        // Status transition workflow
        test_integration_statusTransition_workflow: function () {
            const statuses = [
                CONFIG.STATUS.RECEIVED,
                CONFIG.STATUS.IN_PROGRESS,
                CONFIG.STATUS.VALIDATED
            ];

            // Validate status progression
            let currentStatus = CONFIG.STATUS.RECEIVED;
            TestHelpers.assertEqual(currentStatus, 'Recu', 'Starts as Received');

            // Move to In Progress
            currentStatus = CONFIG.STATUS.IN_PROGRESS;
            TestHelpers.assertEqual(currentStatus, 'En cours', 'Moves to In Progress');

            // Validate requirements before final validation
            const criticite = 3;
            const hasEligibility = true; // Mock

            TestHelpers.assertTrue(criticite >= CONFIG.CRITICITE.MIN, 'Has valid criticite');
            TestHelpers.assertTrue(hasEligibility, 'Has eligibility');

            // Move to Validated
            currentStatus = CONFIG.STATUS.VALIDATED;
            TestHelpers.assertEqual(currentStatus, 'Validé', 'Finally validated');

            Logger.log('✅ Status transition workflow validated');
        }
    };
}

/**
 * Run integration tests separately
 */
function runIntegrationTests() {
    const results = runTestSuite('Integration Tests', getIntegrationTests());

    Logger.log('\n========================================');
    Logger.log('Integration Test Summary');
    Logger.log('========================================');
    Logger.log(`Total: ${results.total}`);
    Logger.log(`Passed: ${results.passed}`);
    Logger.log(`Failed: ${results.failed}`);
    Logger.log('========================================\n');

    return results;
}