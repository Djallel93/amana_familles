/**
 * @file src/api/familyApiHandler.js
 * @description REST API endpoints for external access
 */

/**
 * Main doGet handler for API requests
 */
function doGet(e) {
    try {
        const action = e.parameter.action;

        if (!action) {
            return jsonResponse({ error: 'Missing action parameter' }, 400);
        }

        switch (action.toLowerCase()) {
            case 'allfamilies':
                return getAllFamilies(e);

            case 'familybyid':
                return getFamilyById(e);

            case 'familyaddressbyid':
                return getFamilyAddressById(e);

            case 'familieszakatfitr':
                return getFamiliesForZakatFitr(e);

            case 'familiessadaka':
                return getFamiliesForSadaka(e);

            case 'familiesbyquartier':
                return getFamiliesByQuartier(e);

            case 'familiessedeplace':
                return getFamiliesSeDeplace(e);

            case 'ping':
                return jsonResponse({
                    status: 'ok',
                    message: 'Famille API operational',
                    timestamp: new Date().toISOString()
                });

            default:
                return jsonResponse({ error: 'Unknown action' }, 400);
        }

    } catch (error) {
        logError('API request failed', error);
        return jsonResponse({ error: error.toString() }, 500);
    }
}

/**
 * Get all validated families
 */
function getAllFamilies(e) {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'api_all_families';

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
    if (!sheet) {
        return jsonResponse({ error: 'Sheet not found' }, 404);
    }

    const data = sheet.getDataRange().getValues();
    const families = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] === CONFIG.STATUS.VALIDATED) {
            families.push(rowToFamilyObject(row));
        }
    }

    const result = jsonResponse({
        count: families.length,
        families: families
    });

    cache.put(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);

    return result;
}

/**
 * Get family by ID
 */
function getFamilyById(e) {
    const id = e.parameter.id;
    if (!id) {
        return jsonResponse({ error: 'Missing id parameter' }, 400);
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = `api_family_${id}`;

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const family = findFamilyById(id);
    if (!family) {
        return jsonResponse({ error: 'Family not found' }, 404);
    }

    const result = jsonResponse(family);
    cache.put(cacheKey, result.getContent(), CONFIG.CACHE.MEDIUM);

    return result;
}

/**
 * Get family address by ID
 */
function getFamilyAddressById(e) {
    const id = e.parameter.id;
    if (!id) {
        return jsonResponse({ error: 'Missing id parameter' }, 400);
    }

    const family = findFamilyById(id);
    if (!family) {
        return jsonResponse({ error: 'Family not found' }, 404);
    }

    return jsonResponse({
        id: family.id,
        nom: family.nom,
        prenom: family.prenom,
        adresse: family.adresse,
        idQuartier: family.idQuartier
    });
}

/**
 * Get families eligible for Zakat El Fitr
 */
function getFamiliesForZakatFitr(e) {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'api_zakat_fitr';

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const families = getValidatedFamilies(row => row[OUTPUT_COLUMNS.ZAKAT_EL_FITR] === true);

    const result = jsonResponse({
        count: families.length,
        families: families
    });

    cache.put(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
    return result;
}

/**
 * Get families eligible for Sadaqa
 */
function getFamiliesForSadaka(e) {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'api_sadaka';

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const families = getValidatedFamilies(row => row[OUTPUT_COLUMNS.SADAQA] === true);

    const result = jsonResponse({
        count: families.length,
        families: families
    });

    cache.put(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
    return result;
}

/**
 * Get families by quartier
 */
function getFamiliesByQuartier(e) {
    const quartierId = e.parameter.quartierId;
    if (!quartierId) {
        return jsonResponse({ error: 'Missing quartierId parameter' }, 400);
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = `api_quartier_${quartierId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const families = getValidatedFamilies(
        row => row[OUTPUT_COLUMNS.ID_QUARTIER] == quartierId
    );

    const result = jsonResponse({
        quartierId: quartierId,
        count: families.length,
        families: families
    });

    cache.put(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
    return result;
}

/**
 * Get families who can travel (se_deplace = true)
 */
function getFamiliesSeDeplace(e) {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'api_se_deplace_true';

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const families = getValidatedFamilies(row => row[OUTPUT_COLUMNS.SE_DEPLACE] === true);

    const result = jsonResponse({
        count: families.length,
        families: families
    });

    cache.put(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
    return result;
}

/**
 * Helper: Find family by ID
 */
function findFamilyById(id) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
    if (!sheet) return null;

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[OUTPUT_COLUMNS.ID] === id &&
            row[OUTPUT_COLUMNS.ETAT_DOSSIER] === CONFIG.STATUS.VALIDATED) {
            return rowToFamilyObject(row);
        }
    }

    return null;
}

/**
 * Helper: Get validated families with optional filter
 */
function getValidatedFamilies(filterFn = null) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    const families = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];

        if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] !== CONFIG.STATUS.VALIDATED) {
            continue;
        }

        if (filterFn && !filterFn(row)) {
            continue;
        }

        families.push(rowToFamilyObject(row));
    }

    return families;
}

/**
 * Helper: Convert row to family object
 */
function rowToFamilyObject(row) {
    return {
        id: row[OUTPUT_COLUMNS.ID],
        nom: row[OUTPUT_COLUMNS.NOM],
        prenom: row[OUTPUT_COLUMNS.PRENOM],
        zakatElFitr: row[OUTPUT_COLUMNS.ZAKAT_EL_FITR] || false,
        sadaqa: row[OUTPUT_COLUMNS.SADAQA] || false,
        nombreAdulte: row[OUTPUT_COLUMNS.NOMBRE_ADULTE] || 0,
        nombreEnfant: row[OUTPUT_COLUMNS.NOMBRE_ENFANT] || 0,
        adresse: row[OUTPUT_COLUMNS.ADRESSE],
        idQuartier: row[OUTPUT_COLUMNS.ID_QUARTIER],
        seDeplace: row[OUTPUT_COLUMNS.SE_DEPLACE] || false,
        email: row[OUTPUT_COLUMNS.EMAIL],
        telephone: row[OUTPUT_COLUMNS.TELEPHONE],
        telephoneBis: row[OUTPUT_COLUMNS.TELEPHONE_BIS],
        circonstances: row[OUTPUT_COLUMNS.CIRCONSTANCES],
        ressentit: row[OUTPUT_COLUMNS.RESSENTIT],
        specificites: row[OUTPUT_COLUMNS.SPECIFICITES]
    };
}

/**
 * Helper: Create JSON response
 */
function jsonResponse(data, statusCode = 200) {
    const output = ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);

    return output;
}