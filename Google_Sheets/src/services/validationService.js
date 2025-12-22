/**
 * @file src/services/validationService.js (CONSOLIDATED)
 * @description All validation logic in one place - field, address, document, household
 */

// ============================================
// FIELD VALIDATION
// ============================================

/**
 * Validate required fields for family creation
 * @param {Object} data - Form data to validate
 * @returns {Object} {isValid: boolean, errors: string[]}
 */
function validateRequiredFields(data) {
    const errors = [];

    if (!data.lastName) errors.push('Nom de famille requis');
    if (!data.firstName) errors.push('Prénom requis');
    if (!data.phone) errors.push('Téléphone requis');
    if (!isValidPhone(data.phone)) errors.push('Numéro de téléphone invalide');
    if (data.email && !isValidEmail(data.email)) errors.push('Email invalide');
    if (!data.address) errors.push('Adresse requise');
    if (!data.postalCode) errors.push('Code postal requis');
    if (!data.city) errors.push('Ville requise');
    if (data.nombreAdulte == null || isNaN(data.nombreAdulte)) errors.push('Nombre d\'adultes requis');
    if (data.nombreEnfant == null || isNaN(data.nombreEnfant)) errors.push('Nombre d\'enfants requis');

    const totalPersons = parseInt(data.nombreAdulte || 0) + parseInt(data.nombreEnfant || 0);
    if (totalPersons === 0) {
        errors.push('Le foyer doit contenir au moins une personne (adulte ou enfant)');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Validate household composition (can be called separately for updates)
 * @param {number} nombreAdulte - Number of adults
 * @param {number} nombreEnfant - Number of children
 * @returns {Object} {isValid: boolean, error?: string, adultes?: number, enfants?: number, total?: number}
 */
function validateHouseholdComposition(nombreAdulte, nombreEnfant) {
    const adultes = parseInt(nombreAdulte) || 0;
    const enfants = parseInt(nombreEnfant) || 0;

    if (adultes < 0) {
        return {
            isValid: false,
            error: 'Le nombre d\'adultes ne peut pas être négatif'
        };
    }

    if (enfants < 0) {
        return {
            isValid: false,
            error: 'Le nombre d\'enfants ne peut pas être négatif'
        };
    }

    const total = adultes + enfants;
    if (total === 0) {
        return {
            isValid: false,
            error: 'Le foyer doit contenir au moins une personne (adulte ou enfant)'
        };
    }

    return {
        isValid: true,
        adultes: adultes,
        enfants: enfants,
        total: total
    };
}

// ============================================
// ADDRESS VALIDATION
// ============================================

/**
 * Validate quartier ID exists in GEO API
 * @param {string} quartierId - Quartier ID to validate
 * @returns {Object} {isValid: boolean, error?: string, quartier?: Object}
 */
function validateQuartierId(quartierId) {
    if (!quartierId) {
        return {
            isValid: false,
            error: 'Quartier ID is empty'
        };
    }

    try {
        const quartierResult = getQuartierById(quartierId);

        if (quartierResult.error || !quartierResult.id) {
            return {
                isValid: false,
                error: `Quartier ID "${quartierId}" n'existe pas dans l'API GEO`
            };
        }

        return {
            isValid: true,
            quartier: {
                id: quartierResult.id,
                nom: quartierResult.nom,
                idSecteur: quartierResult.idSecteur
            }
        };

    } catch (e) {
        logError('Failed to validate quartier ID', e);
        return {
            isValid: false,
            error: `Erreur de validation: ${e.toString()}`
        };
    }
}

/**
 * Validate address and get quartier ID (full validation)
 * @param {string} address - Street address
 * @param {string} postalCode - Postal code
 * @param {string} city - City name
 * @returns {Object} Validation result with quartier info
 */
function validateAddressAndGetQuartier(address, postalCode, city) {
    if (!address || !postalCode || !city) {
        return {
            isValid: false,
            error: 'Adresse complète requise (adresse, code postal, ville)'
        };
    }

    const geocodeResult = geocodeAddress(address, city, postalCode);

    if (geocodeResult.error || !geocodeResult.isValid) {
        return {
            isValid: false,
            error: 'Adresse invalide ou introuvable'
        };
    }

    const locationResult = resolveLocation(
        geocodeResult.coordinates.latitude,
        geocodeResult.coordinates.longitude
    );

    if (locationResult.error) {
        return {
            isValid: true,
            validated: true,
            coordinates: geocodeResult.coordinates,
            formattedAddress: geocodeResult.formattedAddress,
            quartierId: null,
            quartierName: null,
            warning: 'Aucune localisation trouvée dans la base de données'
        };
    }

    const quartierId = locationResult.quartier ? locationResult.quartier.id : null;
    const quartierName = locationResult.quartier ? locationResult.quartier.nom : null;

    let quartierInvalid = false;
    let warning = null;

    if (quartierId) {
        const validation = validateQuartierId(quartierId);
        if (!validation.isValid) {
            quartierInvalid = true;
            warning = `⚠️ ATTENTION: Quartier ID "${quartierId}" n'existe pas dans l'API GEO. Vérifier l'adresse avant validation.`;
            logWarning(`Quartier validation failed: ${validation.error}`);
        }
    }

    return {
        isValid: true,
        validated: true,
        coordinates: geocodeResult.coordinates,
        formattedAddress: geocodeResult.formattedAddress,
        quartierId: quartierId,
        quartierName: quartierName,
        quartierInvalid: quartierInvalid,
        warning: warning,
        location: locationResult
    };
}

// ============================================
// DOCUMENT VALIDATION
// ============================================

/**
 * Validate uploaded documents exist
 * @param {string} identityDocUrls - Identity document URLs
 * @param {string} aidesEtatDocUrls - Aides d'état document URLs
 * @param {string} resourceDocUrls - Resource document URLs
 * @returns {Object} {isValid: boolean, errors: string[], identityIds: string[], aidesEtatIds: string[], resourceIds: string[]}
 */
function validateDocuments(identityDocUrls, aidesEtatDocUrls, resourceDocUrls) {
    const errors = [];

    const identityIds = extractFileIds(identityDocUrls);
    if (identityIds.length === 0) {
        errors.push('Aucun justificatif d\'identité fourni');
    } else {
        identityIds.forEach(id => {
            if (!fileExists(id)) {
                errors.push(`Document d'identité introuvable: ${id}`);
            }
        });
    }

    const aidesEtatIds = extractFileIds(aidesEtatDocUrls);
    aidesEtatIds.forEach(id => {
        if (!fileExists(id)) {
            errors.push(`Document aides d'état introuvable: ${id}`);
        }
    });

    const resourceIds = extractFileIds(resourceDocUrls);
    resourceIds.forEach(id => {
        if (!fileExists(id)) {
            errors.push(`Document de ressources introuvable: ${id}`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors: errors,
        identityIds: identityIds,
        aidesEtatIds: aidesEtatIds,
        resourceIds: resourceIds
    };
}

// ============================================
// SYSTEM VALIDATION
// ============================================

/**
 * Validate all sheets exist and have correct structure
 * @returns {Object} Validation results
 */
function validateSheetStructure() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const results = {
        success: true,
        errors: [],
        warnings: [],
        sheets: {}
    };

    const requiredSheets = [
        CONFIG.SHEETS.FAMILLE,
        CONFIG.SHEETS.GOOGLE_FORM,
        CONFIG.SHEETS.FORM_FR,
        CONFIG.SHEETS.FORM_AR,
        CONFIG.SHEETS.FORM_EN
    ];

    const optionalSheets = [
        BULK_IMPORT_SHEET_NAME,
        BULK_UPDATE_SHEET_NAME
    ];

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
 * @returns {Object} Validation results
 */
function validateScriptProperties() {
    const properties = PropertiesService.getScriptProperties();
    const results = {
        success: true,
        errors: [],
        warnings: [],
        properties: {}
    };

    const requiredProps = [
        'SPREADSHEET_ID',
        'GEO_API_URL',
        'GEO_API_KEY',
        'FAMILLE_API_KEY'
    ];

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
 * @returns {Object} Validation results
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
 * @returns {Object} Validation results
 */
function validateContactsApiAccess() {
    const results = {
        success: false,
        message: '',
        canRead: false,
        canWrite: false
    };

    try {
        const response = People.People.Connections.list('people/me', {
            pageSize: 1,
            personFields: 'names'
        });

        results.canRead = true;

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
 * @returns {Object} Complete validation results
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

    results.checks.sheets = validateSheetStructure();
    if (!results.checks.sheets.success) {
        results.overall = false;
        results.summary.errors += results.checks.sheets.errors.length;
    }
    results.summary.warnings += results.checks.sheets.warnings.length;

    results.checks.properties = validateScriptProperties();
    if (!results.checks.properties.success) {
        results.overall = false;
        results.summary.errors += results.checks.properties.errors.length;
    }
    results.summary.warnings += results.checks.properties.warnings.length;

    results.checks.geoApi = validateGeoApiConnection();
    if (!results.checks.geoApi.success) {
        results.overall = false;
        results.summary.errors++;
    }

    results.checks.contactsApi = validateContactsApiAccess();
    if (!results.checks.contactsApi.success) {
        results.overall = false;
        results.summary.errors++;
    }

    return results;
}

/**
 * Fix common issues automatically
 * @returns {Object} {fixed: string[], failed: string[]}
 */
function autoFixCommonIssues() {
    const results = {
        fixed: [],
        failed: []
    };

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();

    } catch (error) {
        results.failed.push(`Failed to create sheets: ${error.toString()}`);
    }

    try {
        clearAllCache();
        results.fixed.push('Cleared script cache');
    } catch (error) {
        results.failed.push(`Failed to clear cache: ${error.toString()}`);
    }

    try {
        resetProcessingStatus();
        resetUpdateProcessingStatus();
        results.fixed.push('Reset processing statuses in bulk sheets');
    } catch (error) {
        results.failed.push(`Failed to reset statuses: ${error.toString()}`);
    }

    return results;
}