/**
 * @file src/core/utils.js (REFACTORÉ v5.0)
 * @description Utilitaires principaux - parsing adresse, validation téléphone/email, logging
 */

/**
 * Parse une adresse complète en composants (CANONIQUE - fonction unique)
 * @param {string} fullAddress - Adresse complète
 * @returns {Object} {street, postalCode, city, country}
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

/**
 * Formate les composants d'adresse en string propre (sans virgule finale)
 * @param {string} street - Rue
 * @param {string} postalCode - Code postal
 * @param {string} city - Ville
 * @returns {string} Adresse formatée
 */
function formatAddressFromComponents(street, postalCode, city) {
    const parts = [];

    if (street && street.trim()) {
        parts.push(street.trim());
    }

    const cityPart = [];
    if (postalCode && postalCode.trim()) {
        cityPart.push(postalCode.trim());
    }
    if (city && city.trim()) {
        cityPart.push(city.trim());
    }

    if (cityPart.length > 0) {
        parts.push(cityPart.join(' '));
    }

    return parts.join(', ');
}

/**
 * Formate l'adresse pour le géocodage (ajoute France)
 * @param {string} address - Rue
 * @param {string} postalCode - Code postal
 * @param {string} city - Ville
 * @returns {string} Adresse complète avec France
 */
function formatAddressForGeocoding(address, postalCode, city) {
    const formatted = formatAddressFromComponents(address, postalCode, city);
    return formatted ? `${formatted}, France` : 'France';
}

/**
 * Normalise un numéro de téléphone français en format +33 X XX XX XX XX
 * @param {string} phone - Numéro à normaliser
 * @returns {string} Numéro normalisé
 */
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
        logWarning(`Format téléphone non standard: ${phone} -> ${cleaned}`);

        if (cleaned.length >= 9) {
            localNumber = cleaned.slice(-9);
        } else {
            return cleaned;
        }
    }

    if (localNumber.length !== 9) {
        logWarning(`Téléphone invalide (doit faire 9 chiffres): ${phone}`);

        if (localNumber.length > 9) {
            localNumber = localNumber.slice(-9);
        } else {
            return cleaned;
        }
    }

    const firstDigit = localNumber[0];
    if (!/[1-9]/.test(firstDigit)) {
        logWarning(`Téléphone invalide - premier chiffre doit être 1-9: ${phone}`);
        return cleaned;
    }

    return `+33 ${localNumber[0]} ${localNumber.substring(1, 3)} ${localNumber.substring(3, 5)} ${localNumber.substring(5, 7)} ${localNumber.substring(7, 9)}`;
}

/**
 * Valide un numéro de téléphone français
 * @param {string} phone - Numéro à valider
 * @returns {boolean} Est valide
 */
function isValidPhone(phone) {
    if (!phone) return false;

    const digitsOnly = String(phone).replace(/\D/g, '');

    if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
        return /^0[1-9]\d{8}$/.test(digitsOnly);
    } else if (digitsOnly.startsWith('33') && digitsOnly.length === 11) {
        return /^33[1-9]\d{8}$/.test(digitsOnly);
    } else if (digitsOnly.startsWith('0033') && digitsOnly.length === 13) {
        return /^0033[1-9]\d{8}$/.test(digitsOnly);
    } else if (digitsOnly.length === 9 && /^[1-9]/.test(digitsOnly[0])) {
        return true;
    }

    return false;
}

/**
 * Normalise un nom de champ (trim + apostrophes)
 * @param {string} fieldName - Nom du champ
 * @returns {string} Nom normalisé
 */
function normalizeFieldName(fieldName) {
    if (!fieldName) return '';

    return fieldName
        .trim()
        .replace(/[\u2018\u2019]/g, "'");
}

/**
 * Valide le format d'un email
 * @param {string} email - Email à valider
 * @returns {boolean} Est valide
 */
function isValidEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Parse une réponse de formulaire en objet standardisé
 * @param {Array} headers - Ligne d'en-têtes
 * @param {Array} values - Ligne de valeurs
 * @returns {Object} Données parsées
 */
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

    return parsed;
}

/**
 * Log avec timestamp et emoji
 * @param {string} message - Message
 * @param {*} [data=null] - Données optionnelles
 */
function logInfo(message, data = null) {
    console.log(`[${formatDateTime()}] ℹ️ INFO: ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

/**
 * Log warning
 * @param {string} message - Message
 * @param {*} [data=null] - Données optionnelles
 */
function logWarning(message, data = null) {
    console.warn(`[${formatDateTime()}] ⚠️ WARN: ${message}`);
    if (data) {
        console.warn(JSON.stringify(data, null, 2));
    }
}

/**
 * Log erreur
 * @param {string} message - Message
 * @param {*} [error=null] - Objet erreur
 */
function logError(message, error = null) {
    console.error(`[${formatDateTime()}] ❌ ERREUR: ${message}`);
    if (error) {
        console.error(error);
    }
}

/**
 * Récupère une feuille par nom
 * @param {string} sheetName - Nom de la feuille
 * @returns {Sheet|null} Objet feuille ou null
 */
function getSheetByName(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName(sheetName);
}

/**
 * Vérifie si un fichier Drive existe
 * @param {string} fileId - ID du fichier
 * @returns {boolean} Existe
 */
function fileExists(fileId) {
    try {
        DriveApp.getFileById(fileId);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Récupère ou crée un dossier
 * @param {Folder} parentFolder - Dossier parent
 * @param {string} folderName - Nom du dossier
 * @returns {Folder} Objet dossier
 */
function getOrCreateFolder(parentFolder, folderName) {
    const folders = parentFolder.getFoldersByName(folderName);

    if (folders.hasNext()) {
        return folders.next();
    }

    return parentFolder.createFolder(folderName);
}

/**
 * Extrait les IDs de fichier depuis des URLs Drive
 * @param {string} urlString - URLs séparées par des virgules
 * @returns {Array<string>} Tableau d'IDs
 */
function extractFileIds(urlString) {
    if (!urlString) return [];

    const urls = urlString.split(',').map(u => u.trim());
    const fileIds = [];

    urls.forEach(url => {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
            url.match(/id=([a-zA-Z0-9_-]+)/);

        if (match && match[1]) {
            fileIds.push(match[1]);
        }
    });

    return fileIds;
}

/**
 * Cherche une famille en doublon (téléphone + nom ou email)
 * @param {string} phone - Téléphone
 * @param {string} lastName - Nom
 * @param {string} [email=null] - Email optionnel
 * @returns {Object} {exists: boolean, row?: number, id?: string, data?: Array}
 */
function findDuplicateFamily(phone, lastName, email = null) {
    try {
        const normalizedPhone = normalizePhone(phone).replace(/[\s\(\)]/g, '');
        const normalizedLastName = lastName.toLowerCase().trim();

        const cacheKey = `dup_${normalizedPhone}_${normalizedLastName}`;
        const cached = getCached(cacheKey);

        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                logWarning('Erreur parsing cache, ignoré', e);
            }
        }

        const data = getFamilySheetData();

        if (!data) {
            logWarning('Feuille Famille introuvable pour vérification doublon');
            return { exists: false };
        }

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (!row || row.length === 0) continue;

            const rowPhone = normalizePhone(String(row[OUTPUT_COLUMNS.TELEPHONE] || ''))
                .replace(/[\s\(\)]/g, '');
            const rowLastName = (row[OUTPUT_COLUMNS.NOM] || '').toLowerCase().trim();
            const rowEmail = (row[OUTPUT_COLUMNS.EMAIL] || '').toLowerCase().trim();

            if ((rowPhone === normalizedPhone && rowLastName === normalizedLastName) ||
                (email && rowEmail && rowEmail === email.toLowerCase().trim())) {
                const result = {
                    exists: true,
                    row: i + 1,
                    id: row[OUTPUT_COLUMNS.ID],
                    data: row
                };

                setCached(cacheKey, JSON.stringify(result), CONFIG.CACHE.MEDIUM);
                return result;
            }
        }

        const result = { exists: false };
        setCached(cacheKey, JSON.stringify(result), CONFIG.CACHE.SHORT);

        return result;

    } catch (error) {
        logError('Erreur dans findDuplicateFamily', error);
        return { exists: false };
    }
}

/**
 * Wrapper pour réessayer une opération
 * @param {Function} operation - Opération à réessayer
 * @param {number} [maxRetries=3] - Nombre max de tentatives
 * @returns {*} Résultat de l'opération
 */
function retryOperation(operation, maxRetries = 3) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return operation();
        } catch (e) {
            lastError = e;
            logError(`Tentative ${i + 1}/${maxRetries} échouée`, e);

            if (i < maxRetries - 1) {
                Utilities.sleep(1000 * (i + 1));
            }
        }
    }

    throw lastError;
}

/**
 * Notifie l'admin par email
 * @param {string} subject - Sujet
 * @param {string} message - Message
 */
function notifyAdmin(subject, message) {
    try {
        const config = getScriptConfig();
        const adminEmail = config.adminEmail;

        if (!adminEmail) {
            logWarning('Email admin non configuré');
            return;
        }

        const emailBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a73e8; color: white; padding: 15px; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🔔 ${subject}</h2>
        </div>
        <div class="content">
            <p>${message.replace(/\n/g, '<br>')}</p>
            <hr>
            <p><strong>Timestamp:</strong> ${formatDateTime()}</p>
        </div>
        <div class="footer">
            <p>📦 Système de Gestion des Familles - Notification automatique</p>
        </div>
    </div>
</body>
</html>`;

        MailApp.sendEmail({
            to: adminEmail,
            subject: `[Gestion Familles] ${subject}`,
            htmlBody: emailBody
        });

        logInfo(`Email envoyé à l'admin: ${subject}`);

    } catch (error) {
        logError('Échec envoi email admin', error);
    }
}

/**
 * Construit une URL avec paramètres
 * @param {string} baseUrl - URL de base
 * @param {string} action - Paramètre action
 * @param {Object} params - Paramètres additionnels
 * @returns {string} URL complète
 */
function buildUrlWithParams(baseUrl, action, params) {
    const queryParams = ['action=' + encodeURIComponent(action)];

    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            queryParams.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
    });

    return baseUrl + '?' + queryParams.join('&');
}

/**
 * Récupère la dernière ligne vide d'une feuille
 * @param {Sheet} sheet - Objet feuille
 * @returns {number} Numéro de ligne vide
 */
function getLastEmptyRow(sheet) {
    const data = sheet.getDataRange().getValues();

    for (let i = data.length - 1; i >= 0; i--) {
        const rowIsEmpty = data[i].every(cell => cell === '' || cell === null);

        if (!rowIsEmpty) {
            return i + 2;
        }
    }

    return 1;
}

/**
 * Vérifie si le consentement est refusé
 * @param {Object} formData - Données du formulaire
 * @returns {boolean} Consentement refusé
 */
function isConsentRefused(formData) {
    const consent = formData.personalDataProtection || '';

    const isRefused = CONFIG.REFUSAL_PHRASES.some(phrase =>
        consent.toLowerCase().includes(phrase.toLowerCase())
    );

    if (isRefused) {
        logInfo('Soumission ignorée: consentement refusé');
    }

    return isRefused;
}