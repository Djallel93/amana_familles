/**
 * @file test/testUtils.js
 * @description Tests for utility functions
 */

function getUtilsTests() {
    return {
        // Phone normalization tests
        test_normalizePhone_validFrenchFormat: function () {
            const result = normalizePhone('0612345678');
            TestHelpers.assertEqual(result, '+33 6 12 34 56 78', 'French format normalization');
        },

        test_normalizePhone_withInternationalPrefix: function () {
            const result = normalizePhone('0033612345678');
            TestHelpers.assertEqual(result, '+33 6 12 34 56 78', 'International prefix normalization');
        },

        test_normalizePhone_with33Prefix: function () {
            const result = normalizePhone('33612345678');
            TestHelpers.assertEqual(result, '+33 6 12 34 56 78', '33 prefix normalization');
        },

        test_normalizePhone_withSpaces: function () {
            const result = normalizePhone('06 12 34 56 78');
            TestHelpers.assertEqual(result, '+33 6 12 34 56 78', 'Spaces removed');
        },

        test_normalizePhone_withParentheses: function () {
            const result = normalizePhone('(06) 12 34 56 78');
            TestHelpers.assertEqual(result, '+33 6 12 34 56 78', 'Parentheses removed');
        },

        test_normalizePhone_emptyString: function () {
            const result = normalizePhone('');
            TestHelpers.assertEqual(result, '', 'Empty string handled');
        },

        test_normalizePhone_null: function () {
            const result = normalizePhone(null);
            TestHelpers.assertEqual(result, '', 'Null handled');
        },

        // Phone validation tests
        test_isValidPhone_validFormat: function () {
            const result = isValidPhone('0612345678');
            TestHelpers.assertTrue(result, 'Valid phone accepted');
        },

        test_isValidPhone_invalidShort: function () {
            const result = isValidPhone('06123');
            TestHelpers.assertFalse(result, 'Too short rejected');
        },

        test_isValidPhone_invalidLong: function () {
            const result = isValidPhone('061234567890');
            TestHelpers.assertFalse(result, 'Too long rejected');
        },

        test_isValidPhone_invalidChars: function () {
            const result = isValidPhone('06abc45678');
            TestHelpers.assertFalse(result, 'Letters rejected');
        },

        test_isValidPhone_invalidStartDigit: function () {
            const result = isValidPhone('0012345678');
            TestHelpers.assertFalse(result, 'Invalid start digit rejected');
        },

        // Email validation tests
        test_isValidEmail_validFormat: function () {
            const result = isValidEmail('test@example.com');
            TestHelpers.assertTrue(result, 'Valid email accepted');
        },

        test_isValidEmail_missingAt: function () {
            const result = isValidEmail('testexample.com');
            TestHelpers.assertFalse(result, 'Missing @ rejected');
        },

        test_isValidEmail_missingDomain: function () {
            const result = isValidEmail('test@');
            TestHelpers.assertFalse(result, 'Missing domain rejected');
        },

        test_isValidEmail_missingUser: function () {
            const result = isValidEmail('@example.com');
            TestHelpers.assertFalse(result, 'Missing user rejected');
        },

        test_isValidEmail_withSpaces: function () {
            const result = isValidEmail('test @example.com');
            TestHelpers.assertFalse(result, 'Spaces rejected');
        },

        // Comment formatting tests
        test_formatComment_withEmoji: function () {
            const result = formatComment('✅', 'Test message');
            TestHelpers.assertTrue(result.includes('✅'), 'Emoji included');
            TestHelpers.assertTrue(result.includes('Test message'), 'Message included');
        },

        test_formatComment_withDate: function () {
            const result = formatComment('📝', 'Update');
            const datePattern = /\d{4}-\d{2}-\d{2}/;
            TestHelpers.assertTrue(datePattern.test(result), 'Date format correct');
        },

        // Add comment tests
        test_addComment_toEmpty: function () {
            const result = addComment('', 'New comment');
            TestHelpers.assertEqual(result, 'New comment', 'Comment added to empty');
        },

        test_addComment_toExisting: function () {
            const existing = 'Old comment';
            const result = addComment(existing, 'New comment');
            TestHelpers.assertTrue(result.includes('New comment'), 'New comment added');
            TestHelpers.assertTrue(result.includes('Old comment'), 'Old comment preserved');
        },

        test_addComment_maxFiveComments: function () {
            let comments = '';
            for (let i = 1; i <= 10; i++) {
                comments = addComment(comments, `Comment ${i}`);
            }
            const commentArray = comments.split('\n').filter(c => c.trim());
            TestHelpers.assertTrue(commentArray.length <= 5, 'Max 5 comments preserved');
        },

        // Extract file IDs tests
        test_extractFileIds_singleUrl: function () {
            const url = 'https://drive.google.com/file/d/ABC123/view';
            const result = extractFileIds(url);
            TestHelpers.assertEqual(result.length, 1, 'One ID extracted');
            TestHelpers.assertEqual(result[0], 'ABC123', 'Correct ID extracted');
        },

        test_extractFileIds_multipleUrls: function () {
            const urls = 'https://drive.google.com/file/d/ABC123/view, https://drive.google.com/file/d/XYZ789/view';
            const result = extractFileIds(urls);
            TestHelpers.assertEqual(result.length, 2, 'Two IDs extracted');
            TestHelpers.assertContains(result, 'ABC123', 'First ID present');
            TestHelpers.assertContains(result, 'XYZ789', 'Second ID present');
        },

        test_extractFileIds_emptyString: function () {
            const result = extractFileIds('');
            TestHelpers.assertEqual(result.length, 0, 'Empty array for empty string');
        },

        test_extractFileIds_invalidUrl: function () {
            const result = extractFileIds('https://example.com');
            TestHelpers.assertEqual(result.length, 0, 'No IDs from invalid URL');
        },

        // Format address tests
        test_formatAddressForGeocoding_allParts: function () {
            const result = formatAddressForGeocoding('1 Rue de la Paix', '44000', 'Nantes');
            TestHelpers.assertTrue(result.includes('1 Rue de la Paix'), 'Address included');
            TestHelpers.assertTrue(result.includes('44000'), 'Postal code included');
            TestHelpers.assertTrue(result.includes('Nantes'), 'City included');
            TestHelpers.assertTrue(result.includes('France'), 'France appended');
        },

        test_formatAddressForGeocoding_missingParts: function () {
            const result = formatAddressForGeocoding('1 Rue de la Paix', '', '');
            TestHelpers.assertTrue(result.includes('1 Rue de la Paix'), 'Address preserved');
            TestHelpers.assertTrue(result.includes('France'), 'France still appended');
        },

        // Normalize field name tests
        test_normalizeFieldName_trimSpaces: function () {
            const result = normalizeFieldName('  test  ');
            TestHelpers.assertEqual(result, 'test', 'Spaces trimmed');
        },

        test_normalizeFieldName_replaceQuotes: function () {
            const result = normalizeFieldName('test\'s');
            TestHelpers.assertEqual(result, "test's", 'Smart quotes replaced');
        },

        // Build URL tests
        test_buildUrlWithParams_singleParam: function () {
            const result = buildUrlWithParams('https://api.example.com', 'test', { key: 'value' });
            TestHelpers.assertTrue(result.includes('action=test'), 'Action parameter added');
            TestHelpers.assertTrue(result.includes('key=value'), 'Custom parameter added');
        },

        test_buildUrlWithParams_multipleParams: function () {
            const result = buildUrlWithParams('https://api.example.com', 'test', {
                key1: 'value1',
                key2: 'value2'
            });
            TestHelpers.assertTrue(result.includes('key1=value1'), 'First param added');
            TestHelpers.assertTrue(result.includes('key2=value2'), 'Second param added');
        },

        test_buildUrlWithParams_nullParam: function () {
            const result = buildUrlWithParams('https://api.example.com', 'test', {
                key1: 'value1',
                key2: null
            });
            TestHelpers.assertTrue(result.includes('key1=value1'), 'Valid param added');
            TestHelpers.assertFalse(result.includes('key2'), 'Null param excluded');
        }
    };
}