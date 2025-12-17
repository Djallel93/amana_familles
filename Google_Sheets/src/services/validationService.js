/**
 * @file src/services/validationService.js (NEW)
 * @description Validate sheet structures and script properties
 */

/**
 * Validate all sheets exist and have correct structure
 */
function validateSheetStructure() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const results = {
        success: true,
        errors: [],
        warnings: [],
        sheets: {}
    };

    // Required sheets
    const requiredSheets = [
        CONFIG.SHEETS.FAMILLE,
        CONFIG.SHEETS.GOOGLE_FORM,
        CONFIG.SHEETS.FORM_FR,
        CONFIG.SHEETS.FORM_AR,
        CONFIG.SHEETS.FORM_EN
    ];

    // Optional sheets
    const optionalSheets = [
        BULK_IMPORT_SHEET_NAME,
        BULK_UPDATE_SHEET_NAME
    ];

    // Check required sheets
    requiredSheets.forEach(sheetName => {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            results.success = false;
            results.errors.push(`❌ Required sheet missing: "${sheetName}"`);
            results.sheets[sheetName] = { exists: false, required: true };
        } else {
            results.sheets[sheetName] = {
                exists: true,
                required: true,
                rows: sheet.getLastRow(),
                columns: sheet.getLastColumn()
            };
        }
    });

    // Check optional sheets
    optionalSheets.forEach(sheetName => {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            results.warnings.push(`⚠️ Optional sheet missing: "${sheetName}" (can be created via menu)`);
            results.sheets[sheetName] = { exists: false, required: false };
        } else {
            results.sheets[sheetName] = {
                exists: true,
                required: false,
                rows: sheet.getLastRow(),
                columns: sheet.getLastColumn()
            };
        }
    });

    // Validate Famille sheet structure
    const familleSheet = ss.getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (familleSheet) {
        const headers = familleSheet.getRange(1, 1, 1, familleSheet.getLastColumn()).getValues()[0];
        const expectedHeaders = [
            'id', 'nom', 'prenom', 'zakat_el_fitr', 'sadaqa', 'nombre_adulte', 'nombre_enfant',
            'adresse', 'id_quartier', 'se_deplace', 'email', 'telephone', 'telephone_bis',
            'identite', 'aides_etat', 'circonstances', 'ressentit', 'specificites',
            'criticite', 'langue', 'etat_dossier', 'commentaire_dossier'
        ];

        const missingHeaders = [];
        expectedHeaders.forEach((header, index) => {
            if (headers[index] !== header) {
                missingHeaders.push(`Column ${index + 1}: expected "${header}", found "${headers[index] || 'empty'}"`);
            }
        });

        if (missingHeaders.length > 0) {
            results.warnings.push(`⚠️ Famille sheet structure issues: ${missingHeaders.join(', ')}`);
        }
    }

    return results;
}

/**
 * Validate script properties are configured
 */
function validateScriptProperties() {
    const properties = PropertiesService.getScriptProperties();
    const results = {
        success: true,
        errors: [],
        warnings: [],
        properties: {}
    };

    // Required properties
    const requiredProps = [
        'SPREADSHEET_ID',
        'GEO_API_URL',
        'GEO_API_KEY',
        'FAMILLE_API_KEY'
    ];

    // Optional but recommended properties
    const optionalProps = [
        'GESTION_FAMILLES_FOLDER_ID',
        'ADMIN_EMAIL',
        'FORM_URL_FR',
        'FORM_URL_AR',
        'FORM_URL_EN',
        'WEB_APP_URL',
        'CLIENT_ID',
        'CLIENT_SECRET'
    ];

    // Check required properties
    requiredProps.forEach(prop => {
        const value = properties.getProperty(prop);
        if (!value) {
            results.success = false;
            results.errors.push(`❌ Required property missing: "${prop}"`);
            results.properties[prop] = { exists: false, required: true };
        } else {
            results.properties[prop] = {
                exists: true,
                required: true,
                length: value.length,
                preview: value.substring(0, 20) + (value.length > 20 ? '...' : '')
            };
        }
    });

    // Check optional properties
    optionalProps.forEach(prop => {
        const value = properties.getProperty(prop);
        if (!value) {
            results.warnings.push(`⚠️ Optional property not set: "${prop}"`);
            results.properties[prop] = { exists: false, required: false };
        } else {
            results.properties[prop] = {
                exists: true,
                required: false,
                length: value.length,
                preview: value.substring(0, 20) + (value.length > 20 ? '...' : '')
            };
        }
    });

    return results;
}

/**
 * Validate GEO API connectivity
 */
function validateGeoApiConnection() {
    const results = {
        success: false,
        message: '',
        responseTime: 0
    };

    try {
        const startTime = Date.now();
        const response = pingGeoApi();
        const endTime = Date.now();

        results.responseTime = endTime - startTime;

        if (response.error) {
            results.success = false;
            results.message = `❌ GEO API Error: ${response.message || 'Unknown error'}`;
        } else {
            results.success = true;
            results.message = `✅ GEO API Connected (${results.responseTime}ms)`;
            results.version = response.version || 'unknown';
        }
    } catch (error) {
        results.success = false;
        results.message = `❌ GEO API Connection Failed: ${error.toString()}`;
    }

    return results;
}

/**
 * Validate Google Contacts API access
 */
function validateContactsApiAccess() {
    const results = {
        success: false,
        message: '',
        canRead: false,
        canWrite: false
    };

    try {
        // Try to read contacts
        const response = People.People.Connections.list('people/me', {
            pageSize: 1,
            personFields: 'names'
        });

        results.canRead = true;

        // Try to get contact groups (write check)
        const groups = People.ContactGroups.list({
            pageSize: 1
        });

        results.canWrite = true;
        results.success = true;
        results.message = '✅ Google Contacts API accessible (read & write)';

    } catch (error) {
        results.success = false;
        if (error.toString().includes('insufficient')) {
            results.message = '❌ Insufficient permissions for Google Contacts API';
        } else if (error.toString().includes('not enabled')) {
            results.message = '❌ Google Contacts API not enabled';
        } else {
            results.message = `❌ Google Contacts API Error: ${error.toString()}`;
        }
    }

    return results;
}

/**
 * Comprehensive system validation
 */
function runSystemValidation() {
    const results = {
        overall: true,
        timestamp: new Date().toISOString(),
        checks: {
            sheets: null,
            properties: null,
            geoApi: null,
            contactsApi: null
        },
        summary: {
            errors: 0,
            warnings: 0
        }
    };

    // 1. Validate sheets
    results.checks.sheets = validateSheetStructure();
    if (!results.checks.sheets.success) {
        results.overall = false;
        results.summary.errors += results.checks.sheets.errors.length;
    }
    results.summary.warnings += results.checks.sheets.warnings.length;

    // 2. Validate properties
    results.checks.properties = validateScriptProperties();
    if (!results.checks.properties.success) {
        results.overall = false;
        results.summary.errors += results.checks.properties.errors.length;
    }
    results.summary.warnings += results.checks.properties.warnings.length;

    // 3. Validate GEO API
    results.checks.geoApi = validateGeoApiConnection();
    if (!results.checks.geoApi.success) {
        results.overall = false;
        results.summary.errors++;
    }

    // 4. Validate Contacts API
    results.checks.contactsApi = validateContactsApiAccess();
    if (!results.checks.contactsApi.success) {
        results.overall = false;
        results.summary.errors++;
    }

    return results;
}

/**
 * Fix common issues automatically
 */
function autoFixCommonIssues() {
    const results = {
        fixed: [],
        failed: []
    };

    // 1. Create missing bulk sheets
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        if (!ss.getSheetByName(BULK_IMPORT_SHEET_NAME)) {
            getOrCreateBulkImportSheet();
            results.fixed.push('Created Bulk Import sheet');
        }

        if (!ss.getSheetByName(BULK_UPDATE_SHEET_NAME)) {
            getOrCreateBulkUpdateSheet();
            results.fixed.push('Created Bulk Update sheet');
        }
    } catch (error) {
        results.failed.push(`Failed to create sheets: ${error.toString()}`);
    }

    // 2. Clear all caches
    try {
        CacheService.getScriptCache().removeAll([]);
        results.fixed.push('Cleared script cache');
    } catch (error) {
        results.failed.push(`Failed to clear cache: ${error.toString()}`);
    }

    // 3. Reset processing statuses
    try {
        resetProcessingStatus();
        resetUpdateProcessingStatus();
        results.fixed.push('Reset processing statuses in bulk sheets');
    } catch (error) {
        results.failed.push(`Failed to reset statuses: ${error.toString()}`);
    }

    return results;
}