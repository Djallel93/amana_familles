/**
 * @file src/api/familyApiHandler.js (REFACTORÉ v4.0)
 * @description REST API utilisant fonctions canoniques
 * CHANGEMENT: Élimination du double fetch de données (optimisation performance)
 */

/**
 * Handler principal doGet avec authentification API key
 */
function doGet(e) {
    try {
        const action = e.parameter.action;

        if (!action) {
            return jsonResponse({ error: 'Paramètre action manquant' }, 400);
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
                    message: 'API Famille opérationnelle',
                    version: '4.0',
                    geoApiVersion: CONFIG.GEO_API.VERSION,
                    timestamp: new Date().toISOString()
                });

            default:
                return jsonResponse({ error: 'Action inconnue' }, 400);
        }

    } catch (error) {
        logError('Requête API échouée', error);
        return jsonResponse({ error: error.toString() }, 500);
    }
}

/**
 * Authentifie une requête API avec clé API
 */
function authenticateRequest(e) {
    const config = getScriptConfig();
    const expectedApiKey = config.familleApiKey;

    if (!expectedApiKey) {
        logError('FAMILLE_API_KEY non configurée');
        return { success: false, error: 'Authentification API non configurée' };
    }

    const providedApiKey = e.parameter.apiKey || e.parameter.api_key;

    if (!providedApiKey) {
        return {
            success: false,
            error: 'Clé API manquante. Incluez ?apiKey=VOTRE_CLE dans la requête.'
        };
    }

    if (providedApiKey !== expectedApiKey) {
        logWarning('Tentative clé API invalide');
        return { success: false, error: 'Clé API invalide' };
    }

    return { success: true };
}

/**
 * Gère la confirmation email des familles
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
 * Crée la page de succès de confirmation
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
 * Crée la page d'erreur de confirmation
 */
function createConfirmationErrorPage(errorType) {
    const template = HtmlService.createTemplateFromFile('views/email/confirmationError');
    template.errorType = errorType;

    return template.evaluate()
        .setTitle('Erreur de confirmation')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Gère la requête API d'envoi des emails de vérification
 */
function handleSendVerificationEmails(e) {
    const result = sendVerificationEmailsToAll();
    return jsonResponse(result);
}

/**
 * Récupère toutes les familles validées avec filtrage et tri AMÉLIORÉS
 * OPTIMISÉ: Fetch unique des données
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

    const data = getFamilySheetData();

    if (!data) {
        return jsonResponse({ error: 'Feuille Famille introuvable' }, 500);
    }

    let families = getAllFamilies(filterFn, includeHierarchy, data);

    const lastUpdateMap = buildLastUpdateMap(data);
    families.forEach(family => {
        family.lastUpdate = lastUpdateMap[family.id] || null;
    });

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
 * Construit une map des IDs famille vers timestamps de dernière mise à jour
 * @param {Array[]} data - Données de la feuille
 * @returns {Object} Map ID -> timestamp
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
 * Applique le tri aux familles
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
 * Récupère la valeur de tri primaire
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
 * Trie les familles par distance depuis un point de référence
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
                logError(`Échec calcul distance pour famille ${family.id}`, e);
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
 * Récupère une famille par ID
 */
function getFamilyByIdApi(e) {
    const id = e.parameter.id;
    const includeHierarchy = e.parameter.includeHierarchy === 'true';

    if (!id) {
        return jsonResponse({ error: 'Paramètre id manquant' }, 400);
    }

    const cacheKey = `api_family_${id}_${includeHierarchy}`;
    const cached = getCached(cacheKey);

    if (cached) {
        return ContentService.createTextOutput(cached)
            .setMimeType(ContentService.MimeType.JSON);
    }

    const family = getFamilyById(id, includeHierarchy);

    if (!family) {
        return jsonResponse({ error: 'Famille introuvable' }, 404);
    }

    const result = jsonResponse(family);
    setCached(cacheKey, result.getContent(), CONFIG.CACHE.MEDIUM);
    return result;
}

/**
 * Récupère l'adresse d'une famille par ID
 */
function getFamilyAddressByIdApi(e) {
    const id = e.parameter.id;
    const includeHierarchy = e.parameter.includeHierarchy === 'true';

    if (!id) {
        return jsonResponse({ error: 'Paramètre id manquant' }, 400);
    }

    const family = getFamilyById(id, includeHierarchy);

    if (!family) {
        return jsonResponse({ error: 'Famille introuvable' }, 404);
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
 * Récupère les familles éligibles Zakat El Fitr
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
 * Récupère les familles éligibles Sadaqa
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
 * Récupère les familles par quartier
 */
function getFamiliesByQuartier(e) {
    const quartierId = e.parameter.quartierId;
    const includeHierarchy = e.parameter.includeHierarchy === 'true';

    if (!quartierId) {
        return jsonResponse({ error: 'Paramètre quartierId manquant' }, 400);
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
 * Récupère les familles par secteur
 */
function getFamiliesBySecteur(e) {
    const secteurId = e.parameter.secteurId;

    if (!secteurId) {
        return jsonResponse({ error: 'Paramètre secteurId manquant' }, 400);
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
 * Récupère les familles par ville
 */
function getFamiliesByVille(e) {
    const villeId = e.parameter.villeId;

    if (!villeId) {
        return jsonResponse({ error: 'Paramètre villeId manquant' }, 400);
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
 * Récupère les familles qui peuvent se déplacer
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
 * Récupère les familles par niveau de criticité
 */
function getFamiliesByCriticite(e) {
    const criticite = parseInt(e.parameter.criticite);
    const includeHierarchy = e.parameter.includeHierarchy === 'true';

    if (isNaN(criticite) || criticite < CONFIG.CRITICITE.MIN || criticite > CONFIG.CRITICITE.MAX) {
        return jsonResponse({
            error: `Criticité invalide. Doit être entre ${CONFIG.CRITICITE.MIN} et ${CONFIG.CRITICITE.MAX}`
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
 * Crée une réponse JSON
 */
function jsonResponse(data, statusCode = 200) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}