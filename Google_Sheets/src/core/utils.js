/**
 * @file src/core/utils.js
 * @description Utilitaires - adresses, téléphone, noms, parsing formulaire, journalisation
 */

function parseAddressComponents(fullAddress) {
    if (!fullAddress) {
        return { street: '', postalCode: '', city: '', country: 'France' };
    }

    const parts = fullAddress
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);

    if (parts.length === 0) {
        return { street: '', postalCode: '', city: '', country: 'France' };
    }

    if (parts.length === 1) {
        return { street: parts[0], postalCode: '', city: '', country: 'France' };
    }

    const street = parts[0];
    const secondPart = parts[1];
    const postalCodeMatch = secondPart.match(/\b(\d{5})\b/);
    const postalCode = postalCodeMatch ? postalCodeMatch[1] : '';
    const city = postalCode ? secondPart.replace(postalCode, '').trim() : secondPart;
    const country = parts.length >= 3 ? parts[parts.length - 1] : 'France';

    return { street, postalCode, city, country };
}

function formatAddressCanonical(street, postalCode, city) {
    const parts = [];
    const streetStr = street ? String(street).trim() : '';
    if (streetStr) parts.push(streetStr);

    const cityPart = [];
    const postalCodeStr = postalCode ? String(postalCode).trim() : '';
    const cityStr = city ? String(city).trim() : '';
    if (postalCodeStr) cityPart.push(postalCodeStr);
    if (cityStr) cityPart.push(cityStr);
    if (cityPart.length > 0) parts.push(cityPart.join(' '));

    return parts.join(', ');
}

function formatAddressFromComponents(street, postalCode, city) {
    return formatAddressCanonical(street, postalCode, city);
}

function formatAddressForGeocoding(address, postalCode, city) {
    const formatted = formatAddressCanonical(address, postalCode, city);
    return formatted ? `${formatted}, France` : 'France';
}

function capitalizeName(name) {
    if (!name) return '';
    return String(name).trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = String(phone).trim().replace(/\D/g, '');
    if (!cleaned) return '';

    let localNumber = '';
    if (cleaned.startsWith('0033')) {
        localNumber = cleaned.substring(4);
    } else if (cleaned.startsWith('33') && cleaned.length >= 11) {
        localNumber = cleaned.substring(2);
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
        localNumber = cleaned.substring(1);
    } else if (cleaned.length === 9 && !cleaned.startsWith('0')) {
        localNumber = cleaned;
    } else if (cleaned.length === 10 && cleaned.startsWith('0')) {
        localNumber = cleaned.substring(1);
    } else {
        logAvertissement(`Format téléphone non standard: ${phone} -> ${cleaned}`);
        localNumber = cleaned.length >= 9 ? cleaned.slice(-9) : cleaned;
        if (localNumber === cleaned) return cleaned;
    }

    if (localNumber.length !== 9) {
        logAvertissement(`Téléphone invalide (doit faire 9 chiffres): ${phone}`);
        if (localNumber.length > 9) {
            localNumber = localNumber.slice(-9);
        } else {
            return cleaned;
        }
    }

    if (!/[1-9]/.test(localNumber[0])) {
        logAvertissement(`Téléphone invalide - premier chiffre doit être 1-9: ${phone}`);
        return cleaned;
    }

    return `+33 ${localNumber[0]} ${localNumber.substring(1, 3)} ${localNumber.substring(3, 5)} ${localNumber.substring(5, 7)} ${localNumber.substring(7, 9)}`;
}

function isValidPhone(phone) {
    if (!phone) return false;
    const digitsOnly = String(phone).replace(/\D/g, '');
    if (digitsOnly.startsWith('0') && digitsOnly.length === 10) return /^0[1-9]\d{8}$/.test(digitsOnly);
    if (digitsOnly.startsWith('33') && digitsOnly.length === 11) return /^33[1-9]\d{8}$/.test(digitsOnly);
    if (digitsOnly.startsWith('0033') && digitsOnly.length === 13) return /^0033[1-9]\d{8}$/.test(digitsOnly);
    if (digitsOnly.length === 9 && /^[1-9]/.test(digitsOnly[0])) return true;
    return false;
}

function normalizeFieldName(fieldName) {
    if (!fieldName) return '';
    return fieldName.trim().replace(/[\u2018\u2019]/g, "'");
}

function isValidEmail(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseFormResponse(headers, values) {
    const parsed = {};

    headers.forEach((header, i) => {
        const normalizedHeader = normalizeFieldName(header.trim());
        const fieldName = COLUMN_MAP[normalizedHeader];
        if (fieldName) {
            logInfo(`Champ: "${fieldName}" = "${values[i]}"`);
            parsed[fieldName] = values[i] ?? '';
        }
    });

    if (parsed.lastName !== undefined) parsed.lastName = capitalizeName(parsed.lastName);
    if (parsed.firstName !== undefined) parsed.firstName = capitalizeName(parsed.firstName);
    if (parsed.seDeplace !== undefined) parsed.seDeplace = parseSeDeplace(parsed.seDeplace);

    return parsed;
}

function logInfo(message, data = null) {
    console.log(`[${formatDateTime()}] ℹ️ INFO: ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
}

function logAvertissement(message, data = null) {
    console.warn(`[${formatDateTime()}] ⚠️ AVERT: ${message}`);
    if (data) console.warn(JSON.stringify(data, null, 2));
}

function logWarning(message, data = null) {
    logAvertissement(message, data);
}

function logError(message, error = null) {
    console.error(`[${formatDateTime()}] ❌ ERREUR: ${message}`);
    if (error) console.error(error);
}