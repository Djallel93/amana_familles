/**
 * @file src/api/familyApiHandler.js (ENHANCED v2.2)
 * @description REST API with eligibility filtering and advanced sorting
 */

/**
 * Main doGet handler with API key authentication
 */
function doGet(e) {
    try {
        const action = e.parameter.action;

        if (!action) {
            return jsonResponse({ error: 'Missing action parameter' }, 400);
        }

        // Public endpoints (no API key required)
        const publicActions = ['confirmfamilyinfo', 'ping'];

        if (!publicActions.includes(action.toLowerCase())) {
            // Verify API key for protected endpoints
            const authResult = authenticateRequest(e);
            if (!authResult.success) {
                return jsonResponse({ error: authResult.error }, 401);
            }
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

            case 'familiesbysecteur':
                return getFamiliesBySecteur(e);

            case 'familiesbyville':
                return getFamiliesByVille(e);

            case 'familiessedeplace':
                return getFamiliesSeDeplace(e);

            case 'familiesbycriticite':
                return getFamiliesByCriticite(e);

            case 'confirmfamilyinfo':
                return handleConfirmFamilyInfo(e);

            case 'sendverificationemails':
                return handleSendVerificationEmails(e);

            case 'ping':
                return jsonResponse({
                    status: 'ok',
                    message: 'Famille API operational',
                    version: '2.2',
                    geoApiVersion: CONFIG.GEO_API.VERSION,
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
 * Authenticate API request using API key
 */
function authenticateRequest(e) {
    const config = getScriptConfig();
    const expectedApiKey = config.familleApiKey;

    if (!expectedApiKey) {
        logError('FAMILLE_API_KEY not configured');
        return { success: false, error: 'API authentication not configured' };
    }

    const providedApiKey = e.parameter.apiKey || e.parameter.api_key;

    if (!providedApiKey) {
        return {
            success: false,
            error: 'Missing API key. Include ?apiKey=YOUR_KEY in request.'
        };
    }

    if (providedApiKey !== expectedApiKey) {
        logWarning(`Invalid API key attempt`);
        return { success: false, error: 'Invalid API key' };
    }

    return { success: true };
}

/**
 * Handle email confirmation from families
 */
function handleConfirmFamilyInfo(e) {
    const id = e.parameter.id;
    const token = e.parameter.token;

    if (!id || !token) {
        return createConfirmationErrorPage('missing_params');
    }

    // Simple token validation: token should match FAMILLE_API_KEY
    const config = getScriptConfig();
    if (token !== config.familleApiKey) {
        return createConfirmationErrorPage('invalid_token');
    }

    const result = confirmFamilyInfo(id);

    if (result.success) {
        return createConfirmationSuccessPage(result.familyData);
    } else {
        if (result.error === 'already_confirmed') {
            return createConfirmationErrorPage('already_confirmed');
        }
        return createConfirmationErrorPage('unknown_error');
    }
}

/**
 * Create dynamic confirmation success page
 */
function createConfirmationSuccessPage(familyData) {
    const template = HtmlService.createTemplateFromFile('views/email/confirmationSuccess');

    template.firstName = familyData.prenom || '';
    template.lastName = familyData.nom || '';
    template.langue = familyData.langue || 'Français';

    return template.evaluate()
        .setTitle('Confirmation réussie')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Create dynamic confirmation error page
 */
function createConfirmationErrorPage(errorType) {
    const template = HtmlService.createTemplateFromFile('views/email/confirmationError');
    template.errorType = errorType;

    return template.evaluate()
        .setTitle('Erreur de confirmation')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Handle API request to send verification emails
 */
function handleSendVerificationEmails(e) {
    const result = sendVerificationEmailsToAll();
    return jsonResponse(result);
}

/**
 * Get all validated families with ENHANCED filtering and sorting
 * NEW: Supports eligibility filters and multiple sort options
 */
function getAllFamilies(e) {
    const orderBy = e.parameter.orderBy;
    const lat = parseFloat(e.parameter.lat);
    const lng = parseFloat(e.parameter.lng);
    const includeHierarchy = e.parameter.includeHierarchy === 'true';

    // NEW: Eligibility filters
    const filterZakat = e.parameter.zakatElFitr === 'true';
    const filterSadaqa = e.parameter.sadaqa === 'true';

    const cacheKey = `api_all_families_${orderBy}_${lat}_${lng}_${includeHierarchy}_${filterZakat}_${filterSadaqa}`;
    const cache = CacheService.getScriptCache();

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) {
        return jsonResponse({ error: 'Sheet not found' }, 404);
    }

    const data = sheet.getDataRange().getValues();
    let families = [];

    // Get last update timestamps from comments
    const lastUpdateMap = buildLastUpdateMap(data);

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] === CONFIG.STATUS.VALIDATED) {
            // NEW: Apply eligibility filters
            const zakatValue = row[OUTPUT_COLUMNS.ZAKAT_EL_FITR] === true;
            const sadaqaValue = row[OUTPUT_COLUMNS.SADAQA] === true;

            // If filters are set, check eligibility
            if (filterZakat && !zakatValue) continue;
            if (filterSadaqa && !sadaqaValue) continue;

            const family = rowToFamilyObject(row, includeHierarchy);

            // NEW: Add last update timestamp
            const familyId = row[OUTPUT_COLUMNS.ID];
            family.lastUpdate = lastUpdateMap[familyId] || null;

            families.push(family);
        }
    }

    // NEW: Enhanced sorting
    families = applySorting(families, orderBy, lat, lng);

    const result = jsonResponse({
        count: families.length,
        orderBy: orderBy || 'none',
        includeHierarchy: includeHierarchy,
        filters: {
            zakatElFitr: filterZakat,
            sadaqa: filterSadaqa
        },
        families: families
    });

    cache.put(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
    return result;
}

/**
 * NEW: Build map of family IDs to last update timestamps
 */
function buildLastUpdateMap(data) {
    const lastUpdateMap = {};

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const familyId = row[OUTPUT_COLUMNS.ID];
        const comment = row[OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';

        // Extract most recent timestamp from comments
        // Format: yyyy-MM-dd HH:mm:ss
        const timestampRegex = /(\d{4}-\d{2}-\d{2})/g;
        const matches = comment.match(timestampRegex);

        if (matches && matches.length > 0) {
            // Get the most recent date (first in comment due to addComment prepending)
            const mostRecentDate = matches[0];
            lastUpdateMap[familyId] = mostRecentDate;
        }
    }

    return lastUpdateMap;
}

/**
 * NEW: Apply sorting to families array
 */
function applySorting(families, orderBy, lat, lng) {
    if (!orderBy) {
        return families;
    }

    // Split orderBy for multiple sort criteria
    const sortCriteria = orderBy.split(',').map(s => s.trim());

    // Primary sort
    const primarySort = sortCriteria[0];

    if (primarySort === 'criticite') {
        families.sort((a, b) => b.criticite - a.criticite);
    } else if (primarySort === 'lastUpdate' || primarySort === 'lastupdate') {
        families.sort((a, b) => {
            // Sort by most recent first (descending)
            if (!a.lastUpdate) return 1;
            if (!b.lastUpdate) return -1;
            return b.lastUpdate.localeCompare(a.lastUpdate);
        });
    } else if (primarySort === 'distance' && !isNaN(lat) && !isNaN(lng)) {
        families = sortFamiliesByDistance(families, lat, lng);
    }

    // Secondary sort (if provided)
    if (sortCriteria.length > 1) {
        const secondarySort = sortCriteria[1];

        if (secondarySort === 'criticite' && primarySort !== 'criticite') {
            // Stable sort by criticite as secondary
            families.sort((a, b) => {
                const primaryValue = getPrimarySortValue(a, primarySort, lat, lng);
                const primaryValueB = getPrimarySortValue(b, primarySort, lat, lng);

                if (primaryValue === primaryValueB) {
                    return b.criticite - a.criticite;
                }
                return 0; // Keep original order if different
            });
        } else if ((secondarySort === 'lastUpdate' || secondarySort === 'lastupdate') && primarySort !== 'lastUpdate') {
            families.sort((a, b) => {
                const primaryValue = getPrimarySortValue(a, primarySort, lat, lng);
                const primaryValueB = getPrimarySortValue(b, primarySort, lat, lng);

                if (primaryValue === primaryValueB) {
                    if (!a.lastUpdate) return 1;
                    if (!b.lastUpdate) return -1;
                    return b.lastUpdate.localeCompare(a.lastUpdate);
                }
                return 0;
            });
        }
    }

    return families;
}

/**
 * NEW: Helper to get primary sort value for secondary sorting
 */
function getPrimarySortValue(family, sortType, lat, lng) {
    if (sortType === 'criticite') {
        return family.criticite;
    } else if (sortType === 'lastUpdate' || sortType === 'lastupdate') {
        return family.lastUpdate || '';
    } else if (sortType === 'distance') {
        return family.distance || 999999;
    }
    return 0;
}

/**
 * Get families by criticite level
 */
function getFamiliesByCriticite(e) {
    const criticite = parseInt(e.parameter.criticite);
    const includeHierarchy = e.parameter.includeHierarchy === 'true';

    if (isNaN(criticite) || criticite < CONFIG.CRITICITE.MIN || criticite > CONFIG.CRITICITE.MAX) {
        return jsonResponse({
            error: `Invalid criticite. Must be between ${CONFIG.CRITICITE.MIN} and ${CONFIG.CRITICITE.MAX}`
        }, 400);
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = `api_criticite_${criticite}_${includeHierarchy}`;

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const families = getValidatedFamilies(
        row => parseInt(row[OUTPUT_COLUMNS.CRITICITE]) === criticite,
        includeHierarchy
    );

    const result = jsonResponse({
        criticite: criticite,
        count: families.length,
        families: families
    });

    cache.put(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
    return result;
}

/**
 * Sort families by distance from reference point
 */
function sortFamiliesByDistance(families, refLat, refLng) {
    families.forEach(family => {
        if (family.adresse) {
            try {
                const cacheKey = `geocode_${family.adresse}`;
                const cache = CacheService.getScriptCache();

                let coords = cache.get(cacheKey);
                if (!coords) {
                    const parts = family.adresse.split(',');
                    const address = parts[0] ? parts[0].trim() : '';
                    const postalCode = parts[1] ? parts[1].trim() : '';
                    const city = parts[2] ? parts[2].trim() : '';

                    const geocodeResult = geocodeAddress(address, city, postalCode);

                    if (geocodeResult && geocodeResult.isValid) {
                        coords = JSON.stringify(geocodeResult.coordinates);
                        cache.put(cacheKey, coords, CONFIG.CACHE.VERY_LONG);
                    }
                }

                if (coords) {
                    const coordinates = JSON.parse(coords);
                    const distanceResult = calculateDistance(
                        refLat, refLng,
                        coordinates.latitude,
                        coordinates.longitude
                    );

                    family.distance = distanceResult && !distanceResult.error ?
                        distanceResult.distance : 999999;
                } else {
                    family.distance = 999999;
                }
            } catch (e) {
                logError(`Failed to calculate distance for family ${family.id}`, e);
                family.distance = 999999;
            }
        } else {
            family.distance = 999999;
        }
    });

    families.sort((a, b) => a.distance - b.distance);
    return families;
}

/**
 * Get family by ID
 */
function getFamilyById(e) {
    const id = e.parameter.id;
    const includeHierarchy = e.parameter.includeHierarchy === 'true';

    if (!id) {
        return jsonResponse({ error: 'Missing id parameter' }, 400);
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = `api_family_${id}_${includeHierarchy}`;

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const family = findFamilyById(id, includeHierarchy);
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
    const includeHierarchy = e.parameter.includeHierarchy === 'true';

    if (!id) {
        return jsonResponse({ error: 'Missing id parameter' }, 400);
    }

    const family = findFamilyById(id, includeHierarchy);
    if (!family) {
        return jsonResponse({ error: 'Family not found' }, 404);
    }

    const response = {
        id: family.id,
        nom: family.nom,
        prenom: family.prenom,
        adresse: family.adresse,
        idQuartier: family.idQuartier,
        criticite: family.criticite,
        langue: family.langue
    };

    if (includeHierarchy) {
        response.idVille = family.idVille;
        response.idSecteur = family.idSecteur;
    }

    return jsonResponse(response);
}

/**
 * Get families eligible for Zakat El Fitr
 */
function getFamiliesForZakatFitr(e) {
    const includeHierarchy = e.parameter.includeHierarchy === 'true';
    const cache = CacheService.getScriptCache();
    const cacheKey = `api_zakat_fitr_${includeHierarchy}`;

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const families = getValidatedFamilies(
        row => row[OUTPUT_COLUMNS.ZAKAT_EL_FITR] === true,
        includeHierarchy
    );

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
    const includeHierarchy = e.parameter.includeHierarchy === 'true';
    const cache = CacheService.getScriptCache();
    const cacheKey = `api_sadaka_${includeHierarchy}`;

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const families = getValidatedFamilies(
        row => row[OUTPUT_COLUMNS.SADAQA] === true,
        includeHierarchy
    );

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
    const includeHierarchy = e.parameter.includeHierarchy === 'true';

    if (!quartierId) {
        return jsonResponse({ error: 'Missing quartierId parameter' }, 400);
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = `api_quartier_${quartierId}_${includeHierarchy}`;

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const families = getValidatedFamilies(
        row => row[OUTPUT_COLUMNS.ID_QUARTIER] == quartierId,
        includeHierarchy
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
 * Get families by secteur
 */
function getFamiliesBySecteur(e) {
    const secteurId = e.parameter.secteurId;

    if (!secteurId) {
        return jsonResponse({ error: 'Missing secteurId parameter' }, 400);
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = `api_secteur_${secteurId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const allFamilies = getValidatedFamilies(null, false);
    const quartierIds = [...new Set(allFamilies.map(f => f.idQuartier).filter(id => id))];
    const hierarchies = batchGetLocationHierarchies(quartierIds);

    const filteredFamilies = allFamilies.filter(family => {
        if (!family.idQuartier) return false;
        const hierarchy = hierarchies[family.idQuartier];
        if (!hierarchy) return false;
        return hierarchy.secteur && hierarchy.secteur.id == secteurId;
    });

    filteredFamilies.forEach(family => {
        const hierarchy = hierarchies[family.idQuartier];
        if (hierarchy) {
            family.idVille = hierarchy.ville.id;
            family.idSecteur = hierarchy.secteur.id;
        }
    });

    const result = jsonResponse({
        secteurId: secteurId,
        count: filteredFamilies.length,
        families: filteredFamilies
    });

    cache.put(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
    return result;
}

/**
 * Get families by ville
 */
function getFamiliesByVille(e) {
    const villeId = e.parameter.villeId;

    if (!villeId) {
        return jsonResponse({ error: 'Missing villeId parameter' }, 400);
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = `api_ville_${villeId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const allFamilies = getValidatedFamilies(null, false);
    const quartierIds = [...new Set(allFamilies.map(f => f.idQuartier).filter(id => id))];
    const hierarchies = batchGetLocationHierarchies(quartierIds);

    const filteredFamilies = allFamilies.filter(family => {
        if (!family.idQuartier) return false;
        const hierarchy = hierarchies[family.idQuartier];
        if (!hierarchy) return false;
        return hierarchy.ville && hierarchy.ville.id == villeId;
    });

    filteredFamilies.forEach(family => {
        const hierarchy = hierarchies[family.idQuartier];
        if (hierarchy) {
            family.idVille = hierarchy.ville.id;
            family.idSecteur = hierarchy.secteur.id;
        }
    });

    const result = jsonResponse({
        villeId: villeId,
        count: filteredFamilies.length,
        families: filteredFamilies
    });

    cache.put(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
    return result;
}

/**
 * Get families who can travel
 */
function getFamiliesSeDeplace(e) {
    const includeHierarchy = e.parameter.includeHierarchy === 'true';
    const cache = CacheService.getScriptCache();
    const cacheKey = `api_se_deplace_${includeHierarchy}`;

    const cached = cache.get(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const families = getValidatedFamilies(
        row => row[OUTPUT_COLUMNS.SE_DEPLACE] === true,
        includeHierarchy
    );

    const result = jsonResponse({
        count: families.length,
        families: families
    });

    cache.put(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
    return result;
}

/**
 * Find family by ID
 */
function findFamilyById(id, includeHierarchy = false) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) return null;

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[OUTPUT_COLUMNS.ID] === id &&
            row[OUTPUT_COLUMNS.ETAT_DOSSIER] === CONFIG.STATUS.VALIDATED) {
            return rowToFamilyObject(row, includeHierarchy);
        }
    }

    return null;
}

/**
 * Get validated families with optional filter
 */
function getValidatedFamilies(filterFn = null, includeHierarchy = false) {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
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

        families.push(rowToFamilyObject(row, includeHierarchy));
    }

    return families;
}

/**
 * Convert row to family object
 */
function rowToFamilyObject(row, includeHierarchy = false) {
    const family = {
        id: row[OUTPUT_COLUMNS.ID],
        nom: row[OUTPUT_COLUMNS.NOM],
        prenom: row[OUTPUT_COLUMNS.PRENOM],
        zakatElFitr: row[OUTPUT_COLUMNS.ZAKAT_EL_FITR] || false,
        sadaqa: row[OUTPUT_COLUMNS.SADAQA] || false,
        nombreAdulte: row[OUTPUT_COLUMNS.NOMBRE_ADULTE] || 0,
        nombreEnfant: row[OUTPUT_COLUMNS.NOMBRE_ENFANT] || 0,
        adresse: row[OUTPUT_COLUMNS.ADRESSE],
        idQuartier: row[OUTPUT_COLUMNS.ID_QUARTIER] || null,
        seDeplace: row[OUTPUT_COLUMNS.SE_DEPLACE] || false,
        email: row[OUTPUT_COLUMNS.EMAIL],
        telephone: row[OUTPUT_COLUMNS.TELEPHONE],
        telephoneBis: row[OUTPUT_COLUMNS.TELEPHONE_BIS],
        circonstances: row[OUTPUT_COLUMNS.CIRCONSTANCES],
        ressentit: row[OUTPUT_COLUMNS.RESSENTIT],
        specificites: row[OUTPUT_COLUMNS.SPECIFICITES],
        criticite: parseInt(row[OUTPUT_COLUMNS.CRITICITE]) || 0,
        langue: row[OUTPUT_COLUMNS.LANGUE] || CONFIG.LANGUAGES.FR
    };

    if (includeHierarchy && family.idQuartier) {
        const hierarchy = getLocationHierarchyFromQuartier(family.idQuartier);
        if (!hierarchy.error) {
            family.idVille = hierarchy.ville.id;
            family.idSecteur = hierarchy.secteur.id;
        } else {
            family.idVille = null;
            family.idSecteur = null;
        }
    }

    return family;
}

/**
 * Create JSON response
 */
function jsonResponse(data, statusCode = 200) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}