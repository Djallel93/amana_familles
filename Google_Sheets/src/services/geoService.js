/**
 * @file src/services/geoService.js
 * @description Handles geocoding and location resolution with v5.0 GEO API (on-demand hierarchy)
 */

/**
 * Call GEO API v5.0 with caching and error handling
 */
function callGeoApi(action, params) {
    const config = getScriptConfig();
    const cache = CacheService.getScriptCache();

    const cacheKey = `geo_v5_${action}_${JSON.stringify(params)}`;
    const cached = cache.get(cacheKey);

    if (cached) {
        return JSON.parse(cached);
    }

    // Add API key to params
    const apiKey = getProperty('GEO_API_KEY');
    if (!apiKey) {
        logError('GEO_API_KEY not configured in script properties');
        return { error: true, message: 'API key not configured' };
    }

    params['X-Api-Key'] = apiKey;

    const url = buildUrlWithParams(config.geoApiUrl, action, params);

    try {
        const response = retryOperation(() => {
            return UrlFetchApp.fetch(url.toString(), {
                method: 'get',
                muteHttpExceptions: true
            });
        });

        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();

        if (responseCode !== 200) {
            logError(`GEO API error: ${responseCode}`, responseText);
            return { error: true, message: responseText };
        }

        const result = JSON.parse(responseText);

        if (!result.error) {
            cache.put(cacheKey, JSON.stringify(result), CONFIG.CACHE.VERY_LONG);
        }

        return result;

    } catch (e) {
        logError('GEO API call failed', e);
        return { error: true, message: e.toString() };
    }
}

/**
 * Geocode an address using Google Maps Geocoding API
 */
function geocodeAddress(adresse, ville, codePostal) {
    return callGeoApi('geocode', {
        adresse: adresse,
        ville: ville,
        codePostal: codePostal
    });
}

/**
 * Reverse geocode coordinates
 */
function reverseGeocode(lat, lng) {
    return callGeoApi('reversegeocode', {
        lat: lat,
        lng: lng
    });
}

/**
 * Resolve complete location hierarchy (Ville > Secteur > Quartier)
 */
function resolveLocation(lat, lng) {
    return callGeoApi('resolvelocation', {
        lat: lat,
        lng: lng
    });
}

/**
 * Get quartier by ID
 */
function getQuartierById(id) {
    return callGeoApi('getquartier', { id: id });
}

/**
 * Get secteur by ID
 */
function getSecteurById(id) {
    return callGeoApi('getsecteur', { id: id });
}

/**
 * Get ville by ID
 */
function getVilleById(id) {
    return callGeoApi('getville', { id: id });
}

/**
 * Get quartiers by secteur
 */
function getQuartiersBySecteur(idSecteur) {
    return callGeoApi('quartiersbysecteur', { idSecteur: idSecteur });
}

/**
 * Get secteurs by ville
 */
function getSecteursByVille(idVille) {
    return callGeoApi('secteursbyville', { idVille: idVille });
}

/**
 * Calculate distance between two points
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    return callGeoApi('calculatedistance', {
        lat1: lat1,
        lng1: lng1,
        lat2: lat2,
        lng2: lng2
    });
}

/**
 * Validate if quartier ID exists in GEO API
 * @param {string} quartierId - Quartier ID to validate
 * @returns {Object} - { isValid: boolean, error?: string }
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
 * Get complete location hierarchy from quartier ID
 * This is the key function for on-demand resolution
 * 
 * @param {string} quartierId - Quartier ID
 * @returns {Object} - { ville: {...}, secteur: {...}, quartier: {...} }
 */
function getLocationHierarchyFromQuartier(quartierId) {
    if (!quartierId) {
        return {
            error: true,
            message: 'Quartier ID is required'
        };
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = `hierarchy_${quartierId}`;

    const cached = cache.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    try {
        // Step 1: Get quartier details
        const quartierResult = getQuartierById(quartierId);

        if (quartierResult.error || !quartierResult.id) {
            return {
                error: true,
                message: `Quartier ${quartierId} not found`
            };
        }

        const quartier = {
            id: quartierResult.id,
            nom: quartierResult.nom,
            idSecteur: quartierResult.idSecteur
        };

        // Step 2: Get secteur details
        const secteurResult = getSecteurById(quartier.idSecteur);

        if (secteurResult.error || !secteurResult.id) {
            return {
                error: true,
                message: `Secteur ${quartier.idSecteur} not found`,
                quartier: quartier
            };
        }

        const secteur = {
            id: secteurResult.id,
            nom: secteurResult.nom,
            idVille: secteurResult.idVille
        };

        // Step 3: Get ville details
        const villeResult = getVilleById(secteur.idVille);

        if (villeResult.error || !villeResult.id) {
            return {
                error: true,
                message: `Ville ${secteur.idVille} not found`,
                quartier: quartier,
                secteur: secteur
            };
        }

        const ville = {
            id: villeResult.id,
            nom: villeResult.nom,
            codePostal: villeResult.codePostal
        };

        // Assemble complete hierarchy
        const hierarchy = {
            ville: ville,
            secteur: secteur,
            quartier: quartier
        };

        // Cache for 6 hours
        cache.put(cacheKey, JSON.stringify(hierarchy), CONFIG.CACHE.VERY_LONG);

        return hierarchy;

    } catch (e) {
        logError('Failed to resolve location hierarchy', e);
        return {
            error: true,
            message: e.toString()
        };
    }
}

/**
 * Validate address and get quartier ID with GEO API validation
 * Returns same structure as before, but checks if quartier exists
 */
function validateAddressAndGetQuartier(address, postalCode, city) {
    const fullAddress = formatAddressForGeocoding(address, postalCode, city);

    // Step 1: Geocode the address
    const geocodeResult = geocodeAddress(address, city, postalCode);

    if (geocodeResult.error || !geocodeResult.isValid) {
        return {
            isValid: false,
            error: 'Adresse invalide ou introuvable'
        };
    }

    // Step 2: Resolve location hierarchy (Ville > Secteur > Quartier)
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

    // Step 3: Validate quartier exists in GEO API
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
        location: locationResult // Full hierarchy for reference
    };
}

/**
 * Batch resolve location hierarchies for multiple quartier IDs
 * Optimized to minimize API calls
 * 
 * @param {Array} quartierIds - Array of quartier IDs
 * @returns {Object} - Map of quartierIds to hierarchies
 */
function batchGetLocationHierarchies(quartierIds) {
    const hierarchies = {};
    const uniqueIds = [...new Set(quartierIds)].filter(id => id); // Remove duplicates and nulls

    uniqueIds.forEach(quartierId => {
        const hierarchy = getLocationHierarchyFromQuartier(quartierId);
        if (!hierarchy.error) {
            hierarchies[quartierId] = hierarchy;
        } else {
            hierarchies[quartierId] = null;
        }
    });

    return hierarchies;
}

/**
 * Ping GEO API to check connectivity
 */
function pingGeoApi() {
    return callGeoApi('ping', {});
}