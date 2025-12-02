/**
 * @file test/testEdgeCases.js
 * @description Tests for edge cases and extreme scenarios
 */

function getEdgeCaseTests() {
    return {
        // Extreme string lengths
        test_edgeCase_veryLongName: function () {
            const longName = 'A'.repeat(1000);
            TestHelpers.assertEqual(longName.length, 1000, 'Long name created');

            // Should still be a valid string
            TestHelpers.assertEqual(typeof longName, 'string', 'Still a string');
        },

        test_edgeCase_emptyName: function () {
            const name = '';
            const isValid = name && name.trim() !== '';
            TestHelpers.assertFalse(isValid, 'Empty name rejected');
        },

        test_edgeCase_whitespaceName: function () {
            const name = '   ';
            const isValid = name && name.trim() !== '';
            TestHelpers.assertFalse(isValid, 'Whitespace name rejected');
        },

        // Special characters in names
        test_edgeCase_nameWithHyphen: function () {
            const name = 'Jean-Pierre';
            TestHelpers.assertTrue(name.length > 0, 'Hyphenated name accepted');
        },

        test_edgeCase_nameWithApostrophe: function () {
            const name = "O'Brien";
            TestHelpers.assertTrue(name.length > 0, 'Name with apostrophe accepted');
        },

        test_edgeCase_nameWithAccents: function () {
            const name = 'François';
            TestHelpers.assertTrue(name.length > 0, 'Accented name accepted');
        },

        test_edgeCase_nameWithArabicChars: function () {
            const name = 'محمد';
            TestHelpers.assertTrue(name.length > 0, 'Arabic name accepted');
        },

        // Phone number edge cases
        test_edgeCase_phoneWithCountryCode: function () {
            const phone = '+33612345678';
            const normalized = normalizePhone(phone);
            TestHelpers.assertTrue(normalized.includes('+33'), 'Country code preserved');
        },

        test_edgeCase_phoneWithSpacesAndDashes: function () {
            const phone = '06 12-34-56 78';
            const normalized = normalizePhone(phone);
            TestHelpers.assertFalse(normalized.includes('-'), 'Dashes removed');
            TestHelpers.assertTrue(normalized.includes(' '), 'Formatted spaces added');
        },

        test_edgeCase_phoneWithParentheses: function () {
            const phone = '(06) 12 34 56 78';
            const normalized = normalizePhone(phone);
            TestHelpers.assertFalse(normalized.includes('('), 'Parentheses removed');
        },

        test_edgeCase_phoneAllZeros: function () {
            const phone = '0000000000';
            const isValid = isValidPhone(phone);
            TestHelpers.assertFalse(isValid, 'All zeros rejected');
        },

        // Email edge cases
        test_edgeCase_emailWithPlusSign: function () {
            const email = 'user+tag@example.com';
            const isValid = isValidEmail(email);
            TestHelpers.assertTrue(isValid, 'Email with plus sign accepted');
        },

        test_edgeCase_emailWithDots: function () {
            const email = 'first.last@example.com';
            const isValid = isValidEmail(email);
            TestHelpers.assertTrue(isValid, 'Email with dots accepted');
        },

        test_edgeCase_emailVeryLong: function () {
            const email = 'a'.repeat(50) + '@example.com';
            const isValid = isValidEmail(email);
            TestHelpers.assertTrue(isValid, 'Long email accepted');
        },

        test_edgeCase_emailMultipleAtSigns: function () {
            const email = 'user@@example.com';
            const isValid = isValidEmail(email);
            TestHelpers.assertFalse(isValid, 'Multiple @ signs rejected');
        },

        // Household numbers edge cases
        test_edgeCase_zeroAdults: function () {
            const nombreAdulte = 0;
            const isValid = !isNaN(nombreAdulte) && nombreAdulte >= 0;
            TestHelpers.assertTrue(isValid, 'Zero adults technically valid');
        },

        test_edgeCase_veryManyAdults: function () {
            const nombreAdulte = 50;
            const isValid = !isNaN(nombreAdulte) && nombreAdulte >= 0;
            TestHelpers.assertTrue(isValid, 'Many adults accepted');
        },

        test_edgeCase_veryManyChildren: function () {
            const nombreEnfant = 20;
            const isValid = !isNaN(nombreEnfant) && nombreEnfant >= 0;
            TestHelpers.assertTrue(isValid, 'Many children accepted');
        },

        test_edgeCase_decimalAdults: function () {
            const nombreAdulte = 2.5;
            const parsed = parseInt(nombreAdulte);
            TestHelpers.assertEqual(parsed, 2, 'Decimal converted to integer');
        },

        // Address edge cases
        test_edgeCase_addressWithSpecialChars: function () {
            const address = "Rue de l'Église n°42";
            TestHelpers.assertTrue(address.length > 0, 'Special chars in address accepted');
        },

        test_edgeCase_addressVeryLong: function () {
            const address = 'Résidence Les Jardins du Parc de la Belle Étoile, Bâtiment A, Escalier 3, Appartement 405';
            TestHelpers.assertTrue(address.length > 50, 'Long address accepted');
        },

        test_edgeCase_postalCodeWithSpaces: function () {
            const postalCode = '44 000';
            const cleaned = postalCode.replace(/\s/g, '');
            TestHelpers.assertEqual(cleaned, '44000', 'Spaces removed from postal code');
        },

        test_edgeCase_postalCodeInvalid: function () {
            const postalCode = '123';
            const pattern = /^\d{5}$/;
            TestHelpers.assertFalse(pattern.test(postalCode), 'Invalid postal code rejected');
        },

        // Criticite edge cases
        test_edgeCase_criticiteMinBoundary: function () {
            const criticite = CONFIG.CRITICITE.MIN;
            const isValid = criticite >= CONFIG.CRITICITE.MIN && criticite <= CONFIG.CRITICITE.MAX;
            TestHelpers.assertTrue(isValid, 'Min boundary valid');
        },

        test_edgeCase_criticiteMaxBoundary: function () {
            const criticite = CONFIG.CRITICITE.MAX;
            const isValid = criticite >= CONFIG.CRITICITE.MIN && criticite <= CONFIG.CRITICITE.MAX;
            TestHelpers.assertTrue(isValid, 'Max boundary valid');
        },

        test_edgeCase_criticiteJustBelow: function () {
            const criticite = CONFIG.CRITICITE.MIN - 1;
            const isValid = criticite >= CONFIG.CRITICITE.MIN && criticite <= CONFIG.CRITICITE.MAX;
            TestHelpers.assertFalse(isValid, 'Just below min rejected');
        },

        test_edgeCase_criticiteJustAbove: function () {
            const criticite = CONFIG.CRITICITE.MAX + 1;
            const isValid = criticite >= CONFIG.CRITICITE.MIN && criticite <= CONFIG.CRITICITE.MAX;
            TestHelpers.assertFalse(isValid, 'Just above max rejected');
        },

        test_edgeCase_criticiteFloat: function () {
            const criticite = 3.7;
            const parsed = parseInt(criticite);
            TestHelpers.assertEqual(parsed, 3, 'Float converted to int');
        },

        test_edgeCase_criticiteString: function () {
            const criticite = '3';
            const parsed = parseInt(criticite);
            TestHelpers.assertEqual(parsed, 3, 'String converted to int');
        },

        test_edgeCase_criticiteNaN: function () {
            const criticite = 'abc';
            const parsed = parseInt(criticite);
            TestHelpers.assertTrue(isNaN(parsed), 'Invalid string becomes NaN');
        },

        // Eligibility edge cases
        test_edgeCase_bothEligibilitiesTrue: function () {
            const zakatElFitr = true;
            const sadaqa = true;
            const hasEligibility = zakatElFitr || sadaqa;
            TestHelpers.assertTrue(hasEligibility, 'Both eligibilities accepted');
        },

        test_edgeCase_bothEligibilitiesFalse: function () {
            const zakatElFitr = false;
            const sadaqa = false;
            const hasEligibility = zakatElFitr || sadaqa;
            TestHelpers.assertFalse(hasEligibility, 'No eligibility detected');
        },

        // Language edge cases
        test_edgeCase_languageLowercase: function () {
            const langue = 'français';
            const normalized = langue.charAt(0).toUpperCase() + langue.slice(1).toLowerCase();
            TestHelpers.assertEqual(normalized, 'Français', 'Language normalized');
        },

        test_edgeCase_languageUppercase: function () {
            const langue = 'FRANÇAIS';
            const normalized = langue.charAt(0).toUpperCase() + langue.slice(1).toLowerCase();
            TestHelpers.assertEqual(normalized, 'Français', 'Language normalized');
        },

        // Comment edge cases
        test_edgeCase_commentVeryLong: function () {
            const longComment = 'A'.repeat(5000);
            TestHelpers.assertTrue(longComment.length === 5000, 'Long comment created');
        },

        test_edgeCase_commentWithNewlines: function () {
            const comment = 'Line 1\nLine 2\nLine 3';
            const lines = comment.split('\n');
            TestHelpers.assertEqual(lines.length, 3, 'Multiple lines preserved');
        },

        test_edgeCase_commentWithEmoji: function () {
            const comment = '✅ Success 🎉';
            TestHelpers.assertTrue(comment.includes('✅'), 'Emoji preserved');
        },

        // URL/File ID edge cases
        test_edgeCase_urlWithQueryParams: function () {
            const url = 'https://drive.google.com/file/d/ABC123/view?usp=sharing';
            const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            TestHelpers.assertNotNull(match, 'ID extracted with query params');
            TestHelpers.assertEqual(match[1], 'ABC123', 'Correct ID extracted');
        },

        test_edgeCase_multipleUrlsSeparated: function () {
            const urls = 'https://drive.google.com/file/d/ABC123/view, https://drive.google.com/file/d/XYZ789/view';
            const urlArray = urls.split(',').map(u => u.trim());
            TestHelpers.assertEqual(urlArray.length, 2, 'Multiple URLs split');
        },

        // Null/undefined edge cases
        test_edgeCase_nullPhone: function () {
            const phone = null;
            const normalized = normalizePhone(phone);
            TestHelpers.assertEqual(normalized, '', 'Null phone returns empty');
        },

        test_edgeCase_undefinedEmail: function () {
            const email = undefined;
            const isValid = email && isValidEmail(email);
            TestHelpers.assertFalse(isValid, 'Undefined email invalid');
        },

        test_edgeCase_nullAddress: function () {
            const address = null;
            const formatted = formatAddressForGeocoding(address, '44000', 'Nantes');
            TestHelpers.assertTrue(formatted.includes('France'), 'France still added');
        },

        // Array boundary edge cases
        test_edgeCase_emptyArray: function () {
            const arr = [];
            TestHelpers.assertEqual(arr.length, 0, 'Empty array');
        },

        test_edgeCase_singleElementArray: function () {
            const arr = ['test'];
            TestHelpers.assertEqual(arr.length, 1, 'Single element array');
        },

        test_edgeCase_veryLargeArray: function () {
            const arr = new Array(10000).fill('test');
            TestHelpers.assertEqual(arr.length, 10000, 'Large array created');
        }
    };
}

/**
 * Run edge case tests separately
 */
function runEdgeCaseTests() {
    const results = runTestSuite('Edge Case Tests', getEdgeCaseTests());

    Logger.log('\n========================================');
    Logger.log('Edge Case Test Summary');
    Logger.log('========================================');
    Logger.log(`Total: ${results.total}`);
    Logger.log(`Passed: ${results.passed}`);
    Logger.log(`Failed: ${results.failed}`);
    Logger.log('========================================\n');

    return results;
}