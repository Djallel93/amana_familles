/**
 * @file src/api/familyApiHandler.js (REFACTORED v3.0)
 * @description REST API using canonical family data functions - ZERO duplication
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

        const publicActions = ['confirmfamilyinfo', 'ping'];

        if (!publicActions.includes(action.toLowerCase())) {
            const authResult = authenticateRequest(e);
            if (!authResult.success) {
                return jsonResponse({ error: authResult.error }, 401);
            }
        }

        switch (action.toLowerCase()) {
            case 'allfamilies':
                return getAllFamiliesApi(e);

            case 'familybyid':
                return getFamilyByIdApi(e);

            case 'familyaddressbyid':
                return getFamilyAddressByIdApi(e);

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
                    version: '3.0',
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
        logWarning('Invalid API key attempt');
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
 * Create confirmation success page
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
 * Create confirmation error page
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
 */
function getAllFamiliesApi(e) {
    const orderBy = e.parameter.orderBy;
    const lat = parseFloat(e.parameter.lat);
    const lng = parseFloat(e.parameter.lng);
    const includeHierarchy = e.parameter.includeHierarchy === 'true';

    const filterZakat = e.parameter.zakatElFitr === 'true';
    const filterSadaqa = e.parameter.sadaqa === 'true';

    const cacheKey = `api_all_families_${orderBy}_${lat}_${lng}_${includeHierarchy}_${filterZakat}_${filterSadaqa}`;

    const cached = getCached(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    // Build filter function
    let filterFn = null;
    if (filterZakat || filterSadaqa) {
        filterFn = (row) => {
            const zakatValue = row[OUTPUT_COLUMNS.ZAKAT_EL_FITR] === true;
            const sadaqaValue = row[OUTPUT_COLUMNS.SADAQA] === true;

            if (filterZakat && !zakatValue) return false;
            if (filterSadaqa && !sadaqaValue) return false;

            return true;
        };
    }

    // Use canonical function from familyDataService
    let families = getAllFamilies(filterFn, includeHierarchy);

    // Add last update timestamps
    const data = getFamilySheetData();
    if (data) {
        const lastUpdateMap = buildLastUpdateMap(data);
        families.forEach(family => {
            family.lastUpdate = lastUpdateMap[family.id] || null;
        });
    }

    // Apply sorting
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

    setCached(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
    return result;
}

/**
 * Build map of family IDs to last update timestamps
 */
function buildLastUpdateMap(data) {
    const lastUpdateMap = {};

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const familyId = safeGetColumn(row, OUTPUT_COLUMNS.ID);
        const comment = safeGetColumn(row, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER);

        const timestampRegex = /(\d{4}-\d{2}-\d{2})/g;
        const matches = comment.match(timestampRegex);

        if (matches && matches.length > 0) {
            lastUpdateMap[familyId] = matches[0];
        }
    }

    return lastUpdateMap;
}

/**
 * Apply sorting to families array
 */
function applySorting(families, orderBy, lat, lng) {
    if (!orderBy) {
        return families;
    }

    const sortCriteria = orderBy.split(',').map(s => s.trim());
    const primarySort = sortCriteria[0];

    if (primarySort === 'criticite') {
        families.sort((a, b) => b.criticite - a.criticite);
    } else if (primarySort === 'lastUpdate' || primarySort === 'lastupdate') {
        families.sort((a, b) => {
            if (!a.lastUpdate) return 1;
            if (!b.lastUpdate) return -1;
            return b.lastUpdate.localeCompare(a.lastUpdate);
        });
    } else if (primarySort === 'distance' && !isNaN(lat) && !isNaN(lng)) {
        families = sortFamiliesByDistance(families, lat, lng);
    }

    // Secondary sort
    if (sortCriteria.length > 1) {
        const secondarySort = sortCriteria[1];

        if (secondarySort === 'criticite' && primarySort !== 'criticite') {
            families.sort((a, b) => {
                const primaryValue = getPrimarySortValue(a, primarySort, lat, lng);
                const primaryValueB = getPrimarySortValue(b, primarySort, lat, lng);

                if (primaryValue === primaryValueB) {
                    return b.criticite - a.criticite;
                }
                return 0;
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
 * Helper to get primary sort value
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
 * Sort families by distance from reference point
 */
function sortFamiliesByDistance(families, refLat, refLng) {
    families.forEach(family => {
        if (family.adresse) {
            try {
                const cacheKey = `geocode_${family.adresse}`;
                let coords = getCached(cacheKey);

                if (!coords) {
                    const parts = parseAddressComponents(family.adresse);

                    const geocodeResult = geocodeAddress(parts.street, parts.city, parts.postalCode);

                    if (geocodeResult && geocodeResult.isValid) {
                        coords = JSON.stringify(geocodeResult.coordinates);
                        setCached(cacheKey, coords, CONFIG.CACHE.VERY_LONG);
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
 * Get family by ID (uses canonical getFamilyById)
 */
function getFamilyByIdApi(e) {
    const id = e.parameter.id;
    const includeHierarchy = e.parameter.includeHierarchy === 'true';

    if (!id) {
        return jsonResponse({ error: 'Missing id parameter' }, 400);
    }

    const cacheKey = `api_family_${id}_${includeHierarchy}`;
    const cached = getCached(cacheKey);

    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    // Use canonical function
    const family = getFamilyById(id, includeHierarchy);

    if (!family) {
        return jsonResponse({ error: 'Family not found' }, 404);
    }

    const result = jsonResponse(family);
    setCached(cacheKey, result.getContent(), CONFIG.CACHE.MEDIUM);
    return result;
}

/**
 * Get family address by ID
 */
function getFamilyAddressByIdApi(e) {
    const id = e.parameter.id;
    const includeHierarchy = e.parameter.includeHierarchy === 'true';

    if (!id) {
        return jsonResponse({ error: 'Missing id parameter' }, 400);
    }

    const family = getFamilyById(id, includeHierarchy);

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
    const cacheKey = `api_zakat_fitr_${includeHierarchy}`;

    const cached = getCached(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const filterFn = (row) => row[OUTPUT_COLUMNS.ZAKAT_EL_FITR] === true;
    const families = getAllFamilies(filterFn, includeHierarchy);

    const result = jsonResponse({
        count: families.length,
        families: families
    });

    setCached(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
    return result;
}

/**
 * Get families eligible for Sadaqa
 */
function getFamiliesForSadaka(e) {
    const includeHierarchy = e.parameter.includeHierarchy === 'true';
    const cacheKey = `api_sadaka_${includeHierarchy}`;

    const cached = getCached(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const filterFn = (row) => row[OUTPUT_COLUMNS.SADAQA] === true;
    const families = getAllFamilies(filterFn, includeHierarchy);

    const result = jsonResponse({
        count: families.length,
        families: families
    });

    setCached(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
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

    const cacheKey = `api_quartier_${quartierId}_${includeHierarchy}`;
    const cached = getCached(cacheKey);

    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const filterFn = (row) => safeGetColumn(row, OUTPUT_COLUMNS.ID_QUARTIER) == quartierId;
    const families = getAllFamilies(filterFn, includeHierarchy);

    const result = jsonResponse({
        quartierId: quartierId,
        count: families.length,
        families: families
    });

    setCached(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
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

    const cacheKey = `api_secteur_${secteurId}`;
    const cached = getCached(cacheKey);

    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const allFamilies = getAllFamilies(null, false);
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

    setCached(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
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

    const cacheKey = `api_ville_${villeId}`;
    const cached = getCached(cacheKey);

    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const allFamilies = getAllFamilies(null, false);
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

    setCached(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
    return result;
}

/**
 * Get families who can travel
 */
function getFamiliesSeDeplace(e) {
    const includeHierarchy = e.parameter.includeHierarchy === 'true';
    const cacheKey = `api_se_deplace_${includeHierarchy}`;

    const cached = getCached(cacheKey);
    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const filterFn = (row) => row[OUTPUT_COLUMNS.SE_DEPLACE] === true;
    const families = getAllFamilies(filterFn, includeHierarchy);

    const result = jsonResponse({
        count: families.length,
        families: families
    });

    setCached(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
    return result;
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

    const cacheKey = `api_criticite_${criticite}_${includeHierarchy}`;
    const cached = getCached(cacheKey);

    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const filterFn = (row) => parseInt(safeGetColumn(row, OUTPUT_COLUMNS.CRITICITE, 0)) === criticite;
    const families = getAllFamilies(filterFn, includeHierarchy);

    const result = jsonResponse({
        criticite: criticite,
        count: families.length,
        families: families
    });

    setCached(cacheKey, result.getContent(), CONFIG.CACHE.SHORT);
    return result;
}

/**
 * Create JSON response
 */
function jsonResponse(data, statusCode = 200) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}