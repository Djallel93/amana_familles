/**
 * @file src/services/geoService.js
 * @description Handles geocoding and quartier lookups with caching
 */

/**
 * Call GEO API with caching and error handling
 */
function callGeoApi(action, params) {
    const config = getScriptConfig();
    const cache = CacheService.getScriptCache();

    const cacheKey = `geo_${action}_${JSON.stringify(params)}`;
    const cached = cache.get(cacheKey);

    if (cached) {
        return JSON.parse(cached);
    }

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
 * Geocode an address
 */
function geocodeAddress(address, country = 'France') {
    return callGeoApi('geocode', {
        address: address,
        country: country
    });
}

/**
 * Find quartier from coordinates
 */
function findQuartierByCoordinates(lat, lng, maxDistance = CONFIG.GEO_API.MAX_DISTANCE) {
    return callGeoApi('findquartier', {
        lat: lat,
        lng: lng,
        maxDistance: maxDistance
    });
}

/**
 * Validate address and get quartier ID
 */
function validateAddressAndGetQuartier(address, postalCode, city) {
    const fullAddress = formatAddressForGeocoding(address, postalCode, city);

    const geocodeResult = geocodeAddress(fullAddress);

    if (geocodeResult.error || !geocodeResult.isValid) {
        return {
            isValid: false,
            error: 'Adresse invalide ou introuvable'
        };
    }

    const quartierResult = findQuartierByCoordinates(
        geocodeResult.coordinates.latitude,
        geocodeResult.coordinates.longitude
    );

    if (quartierResult.error || !quartierResult.quartierId) {
        return {
            isValid: true,
            validated: true,
            coordinates: geocodeResult.coordinates,
            formattedAddress: geocodeResult.formattedAddress,
            quartierId: null,
            quartierName: null,
            warning: 'Aucun quartier trouvé à proximité'
        };
    }

    return {
        isValid: true,
        validated: true,
        coordinates: geocodeResult.coordinates,
        formattedAddress: geocodeResult.formattedAddress,
        quartierId: quartierResult.quartierId,
        quartierName: quartierResult.quartierName,
        distance: quartierResult.distance
    };
}