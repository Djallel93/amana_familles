/**
 * @file tests/tests.js
 * @description Unit tests for core functions
 */

/**
 * Test phone normalization
 */
function testNormalizePhone() {
    const tests = [
        { input: '06 12 34 56 78', expected: '0612345678' },
        { input: '06.12.34.56.78', expected: '0612345678' },
        { input: '06-12-34-56-78', expected: '0612345678' },
        { input: '(06) 12 34 56 78', expected: '0612345678' },
        { input: '+33 6 12 34 56 78', expected: '+33612345678' }
    ];

    tests.forEach(test => {
        const result = normalizePhone(test.input);
        console.log(`Input: ${test.input} -> Output: ${result} (Expected: ${test.expected}) - ${result === test.expected ? '✓' : '✗'}`);
    });
}

/**
 * Test email validation
 */
function testIsValidEmail() {
    const tests = [
        { input: 'test@example.com', expected: true },
        { input: 'invalid.email', expected: false },
        { input: 'test@', expected: false },
        { input: '@example.com', expected: false },
        { input: 'test+tag@example.com', expected: true }
    ];

    tests.forEach(test => {
        const result = isValidEmail(test.input);
        console.log(`Input: ${test.input} -> ${result} (Expected: ${test.expected}) - ${result === test.expected ? '✓' : '✗'}`);
    });
}

/**
 * Test phone validation
 */
function testIsValidPhone() {
    const tests = [
        { input: '0612345678', expected: true },
        { input: '06 12 34 56 78', expected: true },
        { input: '+33612345678', expected: true },
        { input: '1234567890', expected: false },
        { input: '06123', expected: false }
    ];

    tests.forEach(test => {
        const result = isValidPhone(test.input);
        console.log(`Input: ${test.input} -> ${result} (Expected: ${test.expected}) - ${result === test.expected ? '✓' : '✗'}`);
    });
}

/**
 * Test file ID extraction
 */
function testExtractFileIds() {
    const tests = [
        {
            input: 'https://drive.google.com/file/d/ABC123/view',
            expected: ['ABC123']
        },
        {
            input: 'https://drive.google.com/open?id=XYZ789',
            expected: ['XYZ789']
        },
        {
            input: 'https://drive.google.com/file/d/ABC123/view, https://drive.google.com/file/d/DEF456/view',
            expected: ['ABC123', 'DEF456']
        }
    ];

    tests.forEach((test, index) => {
        const result = extractFileIds(test.input);
        const match = JSON.stringify(result) === JSON.stringify(test.expected);
        console.log(`Test ${index + 1}: ${match ? '✓' : '✗'}`);
        console.log(`  Input: ${test.input}`);
        console.log(`  Result: ${JSON.stringify(result)}`);
        console.log(`  Expected: ${JSON.stringify(test.expected)}`);
    });
}

/**
 * Test family ID generation
 */
function testGenerateFamilyId() {
    const ids = [];
    for (let i = 0; i < 5; i++) {
        const id = generateFamilyId();
        ids.push(id);
        console.log(`Generated ID ${i + 1}: ${id}`);
    }

    // Check uniqueness
    const unique = new Set(ids).size === ids.length;
    console.log(`All IDs unique: ${unique ? '✓' : '✗'}`);
}

/**
 * Test address formatting
 */
function testFormatAddressForGeocoding() {
    const tests = [
        {
            address: '1 Rue de la Paix',
            postalCode: '44000',
            city: 'Nantes',
            expected: '1 Rue de la Paix, 44000, Nantes, France'
        },
        {
            address: '10 Avenue des Champs',
            postalCode: '75008',
            city: 'Paris',
            expected: '10 Avenue des Champs, 75008, Paris, France'
        }
    ];

    tests.forEach((test, index) => {
        const result = formatAddressForGeocoding(test.address, test.postalCode, test.city);
        const match = result === test.expected;
        console.log(`Test ${index + 1}: ${match ? '✓' : '✗'}`);
        console.log(`  Result: ${result}`);
        console.log(`  Expected: ${test.expected}`);
    });
}

/**
 * Run all tests
 */
function runAllTests() {
    console.log('=== Running All Tests ===\n');

    console.log('--- Test Phone Normalization ---');
    testNormalizePhone();

    console.log('\n--- Test Email Validation ---');
    testIsValidEmail();

    console.log('\n--- Test Phone Validation ---');
    testIsValidPhone();

    console.log('\n--- Test File ID Extraction ---');
    testExtractFileIds();

    console.log('\n--- Test Family ID Generation ---');
    testGenerateFamilyId();

    console.log('\n--- Test Address Formatting ---');
    testFormatAddressForGeocoding();

    console.log('\n=== All Tests Complete ===');
}