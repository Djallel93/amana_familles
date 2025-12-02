/**
 * @file test/testConfig.js
 * @description Test configuration and utilities
 */

const TEST_CONFIG = {
    // Test data
    VALID_PHONE: '0612345678',
    VALID_PHONE_NORMALIZED: '+33 6 12 34 56 78',
    INVALID_PHONES: ['123', '06123', 'abcdefghij', ''],

    VALID_EMAIL: 'test@example.com',
    INVALID_EMAILS: ['invalid', '@example.com', 'test@', 'test @example.com'],

    VALID_ADDRESS: '1 Rue de la Paix',
    VALID_POSTAL_CODE: '44000',
    VALID_CITY: 'Nantes',

    VALID_CRITICITE: [0, 1, 2, 3, 4, 5],
    INVALID_CRITICITE: [-1, 6, 'abc', null, undefined],

    LANGUAGES: ['Français', 'Arabe', 'Anglais'],

    // Mock family data
    MOCK_FAMILY: {
        id: 'TEST001',
        nom: 'Dupont',
        prenom: 'Jean',
        email: 'jean.dupont@example.com',
        telephone: '+33 6 12 34 56 78',
        telephoneBis: '',
        adresse: '1 Rue de la Paix, 44000 Nantes',
        idQuartier: 'Q001',
        nombreAdulte: 2,
        nombreEnfant: 1,
        seDeplace: true,
        zakatElFitr: true,
        sadaqa: false,
        criticite: 3,
        langue: 'Français',
        etatDossier: 'Validé'
    },

    // Test sheet names
    TEST_SHEET: 'TestData',

    // Timeout settings
    TIMEOUT_SHORT: 1000,
    TIMEOUT_MEDIUM: 5000,
    TIMEOUT_LONG: 10000
};

/**
 * Test helper utilities
 */
const TestHelpers = {
    /**
     * Assert that two values are equal
     */
    assertEqual: function (actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
        }
    },

    /**
     * Assert that a value is true
     */
    assertTrue: function (value, message) {
        if (!value) {
            throw new Error(`${message || 'Assertion failed'}: expected true, got ${value}`);
        }
    },

    /**
     * Assert that a value is false
     */
    assertFalse: function (value, message) {
        if (value) {
            throw new Error(`${message || 'Assertion failed'}: expected false, got ${value}`);
        }
    },

    /**
     * Assert that a value is null
     */
    assertNull: function (value, message) {
        if (value !== null) {
            throw new Error(`${message || 'Assertion failed'}: expected null, got ${value}`);
        }
    },

    /**
     * Assert that a value is not null
     */
    assertNotNull: function (value, message) {
        if (value === null) {
            throw new Error(`${message || 'Assertion failed'}: expected not null`);
        }
    },

    /**
     * Assert that a function throws an error
     */
    assertThrows: function (fn, message) {
        let thrown = false;
        try {
            fn();
        } catch (e) {
            thrown = true;
        }
        if (!thrown) {
            throw new Error(`${message || 'Expected function to throw an error'}`);
        }
    },

    /**
     * Assert that an object has a property
     */
    assertHasProperty: function (obj, property, message) {
        if (!obj.hasOwnProperty(property)) {
            throw new Error(`${message || 'Object missing property'}: ${property}`);
        }
    },

    /**
     * Assert that an array contains a value
     */
    assertContains: function (array, value, message) {
        if (!array.includes(value)) {
            throw new Error(`${message || 'Array does not contain value'}: ${value}`);
        }
    },

    /**
     * Create a mock sheet for testing
     */
    createMockSheet: function (name, data) {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let sheet = ss.getSheetByName(name);

        if (!sheet) {
            sheet = ss.insertSheet(name);
        } else {
            sheet.clear();
        }

        if (data && data.length > 0) {
            sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
        }

        return sheet;
    },

    /**
     * Delete test sheet
     */
    deleteMockSheet: function (name) {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(name);
        if (sheet) {
            ss.deleteSheet(sheet);
        }
    },

    /**
     * Create mock family data
     */
    createMockFamilyData: function (overrides = {}) {
        return Object.assign({}, TEST_CONFIG.MOCK_FAMILY, overrides);
    },

    /**
     * Log test result
     */
    logTestResult: function (testName, passed, error = null) {
        const status = passed ? '✅ PASS' : '❌ FAIL';
        const message = `${status} - ${testName}`;

        if (passed) {
            Logger.log(message);
        } else {
            Logger.log(`${message}: ${error}`);
        }

        return passed;
    }
};

/**
 * Test runner
 */
function runTestSuite(suiteName, tests) {
    Logger.log(`\n========================================`);
    Logger.log(`Running Test Suite: ${suiteName}`);
    Logger.log(`========================================\n`);

    const results = {
        total: 0,
        passed: 0,
        failed: 0,
        errors: []
    };

    Object.keys(tests).forEach(testName => {
        results.total++;

        try {
            tests[testName]();
            results.passed++;
            TestHelpers.logTestResult(testName, true);
        } catch (error) {
            results.failed++;
            TestHelpers.logTestResult(testName, false, error.message);
            results.errors.push({ test: testName, error: error.message });
        }
    });

    Logger.log(`\n========================================`);
    Logger.log(`Test Suite Complete: ${suiteName}`);
    Logger.log(`Total: ${results.total} | Passed: ${results.passed} | Failed: ${results.failed}`);
    Logger.log(`========================================\n`);

    if (results.errors.length > 0) {
        Logger.log('\nFailed Tests:');
        results.errors.forEach(err => {
            Logger.log(`  - ${err.test}: ${err.error}`);
        });
    }

    return results;
}

/**
 * Run all test suites
 */
function runAllTests() {
    Logger.log('\n🧪 Starting Full Test Suite\n');

    const allResults = [];

    // Run each test suite
    allResults.push(runTestSuite('Utils Tests', getUtilsTests()));
    allResults.push(runTestSuite('Config Tests', getConfigTests()));
    allResults.push(runTestSuite('Validation Tests', getValidationTests()));
    allResults.push(runTestSuite('GeoService Tests', getGeoServiceTests()));
    allResults.push(runTestSuite('Family Update Tests', getFamilyUpdateTests()));
    allResults.push(runTestSuite('Bulk Import Tests', getBulkImportTests()));

    // Summary
    const totalTests = allResults.reduce((sum, r) => sum + r.total, 0);
    const totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);

    Logger.log('\n========================================');
    Logger.log('FINAL SUMMARY');
    Logger.log('========================================');
    Logger.log(`Total Tests: ${totalTests}`);
    Logger.log(`Passed: ${totalPassed} (${Math.round(totalPassed / totalTests * 100)}%)`);
    Logger.log(`Failed: ${totalFailed}`);
    Logger.log('========================================\n');

    if (totalFailed === 0) {
        Logger.log('✅ All tests passed!');
    } else {
        Logger.log('❌ Some tests failed. Review logs above.');
    }
}