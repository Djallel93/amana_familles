/**
 * @file test/testConfigValidation.js
 * @description Tests for config and validation functions
 */

function getConfigTests() {
    return {
        // Config constants tests
        test_config_statusValues: function () {
            TestHelpers.assertNotNull(CONFIG.STATUS.VALIDATED, 'VALIDATED status exists');
            TestHelpers.assertNotNull(CONFIG.STATUS.REJECTED, 'REJECTED status exists');
            TestHelpers.assertNotNull(CONFIG.STATUS.IN_PROGRESS, 'IN_PROGRESS status exists');
        },

        test_config_criticiteRange: function () {
            TestHelpers.assertEqual(CONFIG.CRITICITE.MIN, 0, 'Min criticite is 0');
            TestHelpers.assertEqual(CONFIG.CRITICITE.MAX, 5, 'Max criticite is 5');
        },

        test_config_languages: function () {
            TestHelpers.assertEqual(CONFIG.LANGUAGES.FR, 'Français', 'French language');
            TestHelpers.assertEqual(CONFIG.LANGUAGES.AR, 'Arabe', 'Arabic language');
            TestHelpers.assertEqual(CONFIG.LANGUAGES.EN, 'Anglais', 'English language');
        },

        test_config_sheetNames: function () {
            TestHelpers.assertNotNull(CONFIG.SHEETS.FAMILLE, 'Famille sheet name exists');
            TestHelpers.assertNotNull(CONFIG.SHEETS.GOOGLE_FORM, 'Google Form sheet name exists');
        },

        // Generate Family ID tests
        test_generateFamilyId_isNumeric: function () {
            const id = generateFamilyId();
            TestHelpers.assertTrue(!isNaN(id), 'ID is numeric');
        },

        test_generateFamilyId_isPositive: function () {
            const id = generateFamilyId();
            TestHelpers.assertTrue(id > 0, 'ID is positive');
        },

        // Detect language tests
        test_detectLanguageFromSheet_french: function () {
            const result = detectLanguageFromSheet(CONFIG.SHEETS.FORM_FR);
            TestHelpers.assertEqual(result, CONFIG.LANGUAGES.FR, 'French detected');
        },

        test_detectLanguageFromSheet_arabic: function () {
            const result = detectLanguageFromSheet(CONFIG.SHEETS.FORM_AR);
            TestHelpers.assertEqual(result, CONFIG.LANGUAGES.AR, 'Arabic detected');
        },

        test_detectLanguageFromSheet_english: function () {
            const result = detectLanguageFromSheet(CONFIG.SHEETS.FORM_EN);
            TestHelpers.assertEqual(result, CONFIG.LANGUAGES.EN, 'English detected');
        },

        test_detectLanguageFromSheet_unknown: function () {
            const result = detectLanguageFromSheet('Unknown Sheet');
            TestHelpers.assertEqual(result, CONFIG.LANGUAGES.FR, 'Defaults to French');
        },

        // Parse SeDeplace tests
        test_parseSeDeplace_oui: function () {
            TestHelpers.assertTrue(parseSeDeplace('Oui'), 'Oui = true');
        },

        test_parseSeDeplace_non: function () {
            TestHelpers.assertFalse(parseSeDeplace('Non'), 'Non = false');
        },

        test_parseSeDeplace_yes: function () {
            TestHelpers.assertTrue(parseSeDeplace('Yes'), 'Yes = true');
        },

        test_parseSeDeplace_no: function () {
            TestHelpers.assertFalse(parseSeDeplace('No'), 'No = false');
        },

        test_parseSeDeplace_arabic_yes: function () {
            TestHelpers.assertTrue(parseSeDeplace('نعم'), 'Arabic yes = true');
        },

        test_parseSeDeplace_arabic_no: function () {
            TestHelpers.assertFalse(parseSeDeplace('لا'), 'Arabic no = false');
        },

        test_parseSeDeplace_boolean: function () {
            TestHelpers.assertTrue(parseSeDeplace(true), 'Boolean true preserved');
            TestHelpers.assertFalse(parseSeDeplace(false), 'Boolean false preserved');
        },

        test_parseSeDeplace_unknown: function () {
            TestHelpers.assertFalse(parseSeDeplace('unknown'), 'Unknown defaults to false');
        },

        // Parse Eligibility tests
        test_parseEligibility_sadaqaOnly: function () {
            const result = parseEligibility('Sadaqa');
            TestHelpers.assertTrue(result.sadaqa, 'Sadaqa detected');
            TestHelpers.assertFalse(result.zakatElFitr, 'Zakat not detected');
        },

        test_parseEligibility_zakatOnly: function () {
            const result = parseEligibility('Zakat El Fitr');
            TestHelpers.assertTrue(result.zakatElFitr, 'Zakat detected');
            TestHelpers.assertFalse(result.sadaqa, 'Sadaqa not detected');
        },

        test_parseEligibility_both: function () {
            const result = parseEligibility('Sadaqa, Zakat El Fitr');
            TestHelpers.assertTrue(result.sadaqa, 'Sadaqa detected');
            TestHelpers.assertTrue(result.zakatElFitr, 'Zakat detected');
        },

        test_parseEligibility_empty: function () {
            const result = parseEligibility('');
            TestHelpers.assertFalse(result.sadaqa, 'Sadaqa false for empty');
            TestHelpers.assertFalse(result.zakatElFitr, 'Zakat false for empty');
        },

        test_parseEligibility_caseInsensitive: function () {
            const result = parseEligibility('SADAQA, zakat el fitr');
            TestHelpers.assertTrue(result.sadaqa, 'Case insensitive Sadaqa');
            TestHelpers.assertTrue(result.zakatElFitr, 'Case insensitive Zakat');
        }
    };
}

function getValidationTests() {
    return {
        // Validate required fields tests
        test_validateRequiredFields_allPresent: function () {
            const data = {
                lastName: 'Dupont',
                firstName: 'Jean',
                phone: '0612345678',
                email: 'jean@example.com',
                address: '1 Rue de la Paix',
                postalCode: '44000',
                city: 'Nantes',
                nombreAdulte: 2,
                nombreEnfant: 1
            };

            const result = validateRequiredFields(data);
            TestHelpers.assertTrue(result.isValid, 'All fields valid');
            TestHelpers.assertEqual(result.errors.length, 0, 'No errors');
        },

        test_validateRequiredFields_missingLastName: function () {
            const data = {
                firstName: 'Jean',
                phone: '0612345678',
                address: '1 Rue de la Paix',
                postalCode: '44000',
                city: 'Nantes',
                nombreAdulte: 2,
                nombreEnfant: 1
            };

            const result = validateRequiredFields(data);
            TestHelpers.assertFalse(result.isValid, 'Invalid without lastName');
            TestHelpers.assertTrue(result.errors.length > 0, 'Has errors');
        },

        test_validateRequiredFields_missingPhone: function () {
            const data = {
                lastName: 'Dupont',
                firstName: 'Jean',
                address: '1 Rue de la Paix',
                postalCode: '44000',
                city: 'Nantes',
                nombreAdulte: 2,
                nombreEnfant: 1
            };

            const result = validateRequiredFields(data);
            TestHelpers.assertFalse(result.isValid, 'Invalid without phone');
        },

        test_validateRequiredFields_invalidPhone: function () {
            const data = {
                lastName: 'Dupont',
                firstName: 'Jean',
                phone: '123', // Invalid
                address: '1 Rue de la Paix',
                postalCode: '44000',
                city: 'Nantes',
                nombreAdulte: 2,
                nombreEnfant: 1
            };

            const result = validateRequiredFields(data);
            TestHelpers.assertFalse(result.isValid, 'Invalid phone rejected');
        },

        test_validateRequiredFields_invalidEmail: function () {
            const data = {
                lastName: 'Dupont',
                firstName: 'Jean',
                phone: '0612345678',
                email: 'invalid-email', // Invalid
                address: '1 Rue de la Paix',
                postalCode: '44000',
                city: 'Nantes',
                nombreAdulte: 2,
                nombreEnfant: 1
            };

            const result = validateRequiredFields(data);
            TestHelpers.assertFalse(result.isValid, 'Invalid email rejected');
        },

        test_validateRequiredFields_missingAddress: function () {
            const data = {
                lastName: 'Dupont',
                firstName: 'Jean',
                phone: '0612345678',
                postalCode: '44000',
                city: 'Nantes',
                nombreAdulte: 2,
                nombreEnfant: 1
            };

            const result = validateRequiredFields(data);
            TestHelpers.assertFalse(result.isValid, 'Invalid without address');
        },

        test_validateRequiredFields_missingNumbers: function () {
            const data = {
                lastName: 'Dupont',
                firstName: 'Jean',
                phone: '0612345678',
                address: '1 Rue de la Paix',
                postalCode: '44000',
                city: 'Nantes'
            };

            const result = validateRequiredFields(data);
            TestHelpers.assertFalse(result.isValid, 'Invalid without household numbers');
        },

        // Criticite validation tests
        test_criticite_validValues: function () {
            TEST_CONFIG.VALID_CRITICITE.forEach(value => {
                TestHelpers.assertTrue(
                    value >= CONFIG.CRITICITE.MIN && value <= CONFIG.CRITICITE.MAX,
                    `Criticite ${value} is valid`
                );
            });
        },

        test_criticite_invalidValues: function () {
            [-1, 6].forEach(value => {
                TestHelpers.assertTrue(
                    value < CONFIG.CRITICITE.MIN || value > CONFIG.CRITICITE.MAX,
                    `Criticite ${value} is invalid`
                );
            });
        }
    };
}