/**
 * @file src/core/utils.js (IMPROVED)
 * @description Utility functions with improved comment management
 */

/**
 * 📝 Format comment with timestamp and emoji
 * Format: yyyy-MM-dd emoji comment
 * @param {string} emoji - Emoji to prepend
 * @param {string} message - Comment message
 * @returns {string} - Formatted comment
 */
function formatComment(emoji, message) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    return `${dateStr} ${emoji} ${message}`;
}

/**
 * 📝 Add comment to existing comments (keeps only last 5)
 * @param {string} existingComments - Current comments
 * @param {string} newComment - New comment to add
 * @returns {string} - Updated comments string
 */
function addComment(existingComments, newComment) {
    // Split existing comments by newline
    const comments = existingComments ? existingComments.split('\n').filter(c => c.trim()) : [];

    // Add new comment at the beginning (most recent first)
    comments.unshift(newComment);

    // Keep only last 5 comments
    const recentComments = comments.slice(0, 5);

    return recentComments.join('\n');
}

/**
 * 📞 Normaliser et formater un numéro de téléphone français
 * Format de sortie: +33 X XX XX XX XX (sans le 0 initial, sans parenthèses)
 */
function normalizePhone(phone) {
    if (!phone) return '';

    let cleaned = String(phone).trim();
    cleaned = cleaned.replace(/\D/g, '');

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
        logWarning(`⚠️ Format de téléphone non standard: ${phone} -> ${cleaned}`);

        if (cleaned.length >= 9) {
            localNumber = cleaned.slice(-9);
        } else {
            return cleaned;
        }
    }

    if (localNumber.length !== 9) {
        logWarning(`⚠️ Numéro de téléphone invalide (doit avoir 9 chiffres après l'indicatif): ${phone} (extracted: ${localNumber})`);

        if (localNumber.length > 9) {
            localNumber = localNumber.slice(-9);
        } else {
            return cleaned;
        }
    }

    const firstDigit = localNumber[0];
    if (!/[1-9]/.test(firstDigit)) {
        logWarning(`⚠️ Numéro invalide - premier chiffre doit être 1-9: ${phone}`);
        return cleaned;
    }

    return `+33 ${localNumber[0]} ${localNumber.substring(1, 3)} ${localNumber.substring(3, 5)} ${localNumber.substring(5, 7)} ${localNumber.substring(7, 9)}`;
}

/**
 * 📞 Valider un numéro de téléphone français
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
 * 📝 Normaliser le nom d'un champ (trim + apostrophes)
 */
function normalizeFieldName(fieldName) {
    if (!fieldName) return '';

    return fieldName
        .trim()
        .replace(/[\u2018\u2019]/g, "'");
}

/**
 * ✉️ Valider le format d'un email
 */
function isValidEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * 🗺️ Parser une réponse de formulaire en objet standardisé
 */
function parseFormResponse(headers, values) {
    const parsed = {};

    headers.forEach((header, i) => {
        const normalizedHeader = normalizeFieldName(header.trim());
        const fieldName = COLUMN_MAP[normalizedHeader];
        if (fieldName) {
            logInfo(`📋 Champ: "${fieldName}" = "${values[i]}"`);
            parsed[fieldName] = values[i] ?? '';
        }
    });

    return parsed;
}

/**
 * 🏠 Formater une adresse pour le géocodage
 */
function formatAddressForGeocoding(address, postalCode, city) {
    const parts = [address, postalCode, city, 'France'].filter(p => p);
    return parts.join(', ');
}

/**
 * 📝 Log avec timestamp et emoji
 */
function logInfo(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ℹ️ INFO: ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

/**
 * ⚠️ Log d'avertissement
 */
function logWarning(message, data = null) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] ⚠️ WARN: ${message}`);
    if (data) {
        console.warn(JSON.stringify(data, null, 2));
    }
}

/**
 * ❌ Log d'erreur
 */
function logError(message, error = null) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ ERROR: ${message}`);
    if (error) {
        console.error(error);
    }
}

/**
 * 📄 Récupérer une feuille avec mise en cache
 */
function getSheetByName(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName(sheetName);
}

/**
 * 📁 Vérifier si un fichier existe dans Drive
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
 * 📂 Récupérer ou créer un dossier
 */
function getOrCreateFolder(parentFolder, folderName) {
    const folders = parentFolder.getFoldersByName(folderName);
    if (folders.hasNext()) {
        return folders.next();
    }
    return parentFolder.createFolder(folderName);
}

/**
 * ✅ Valider les champs requis
 * ENHANCED: Check that household has at least one person
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

    // NEW: Validate household composition
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
 * NEW: Validate household composition separately (for updates)
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


/**
 * 🔗 Extraire les IDs de fichier depuis les URLs Drive
 */
function extractFileIds(urlString) {
    if (!urlString) return [];

    const urls = urlString.split(',').map(u => u.trim());
    const fileIds = [];

    urls.forEach(url => {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            fileIds.push(match[1]);
        }
    });

    return fileIds;
}

/**
 * 🔍 Vérifier les doublons de famille (téléphone + nom)
 * IMPROVED: Check BEFORE inserting
 */
function findDuplicateFamily(phone, lastName, email = null) {
    try {
        const cache = CacheService.getScriptCache();
        const normalizedPhone = normalizePhone(phone).replace(/[\s\(\)]/g, '');
        const normalizedLastName = lastName.toLowerCase().trim();

        const cacheKey = `dup_${normalizedPhone}_${normalizedLastName}`;
        const cached = cache.get(cacheKey);

        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                logWarning('⚠️ Erreur parsing cache, ignoré', e);
            }
        }

        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);

        if (!sheet) {
            logWarning('⚠️ Feuille Famille introuvable pour vérification doublons');
            return { exists: false };
        }

        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (!row || row.length === 0) continue;

            const rowPhone = normalizePhone(String(row[OUTPUT_COLUMNS.TELEPHONE] || '')).replace(/[\s\(\)]/g, '');
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

                try {
                    cache.put(cacheKey, JSON.stringify(result), CONFIG.CACHE.MEDIUM);
                } catch (e) {
                    logWarning('⚠️ Erreur mise en cache, ignoré', e);
                }

                return result;
            }
        }

        const result = { exists: false };

        try {
            cache.put(cacheKey, JSON.stringify(result), CONFIG.CACHE.SHORT);
        } catch (e) {
            logWarning('⚠️ Erreur mise en cache, ignoré', e);
        }

        return result;

    } catch (error) {
        logError('❌ Erreur dans findDuplicateFamily', error);
        return { exists: false };
    }
}

/**
 * 🔄 Wrapper de retry pour les appels API
 */
function retryOperation(operation, maxRetries = 3) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return operation();
        } catch (e) {
            lastError = e;
            logError(`❌ Tentative ${i + 1}/${maxRetries} échouée`, e);

            if (i < maxRetries - 1) {
                Utilities.sleep(1000 * (i + 1));
            }
        }
    }

    throw lastError;
}

/**
 * 📧 Notifier l'administrateur par email
 */
function notifyAdmin(subject, message) {
    try {
        const config = getScriptConfig();
        const adminEmail = config.adminEmail;

        if (!adminEmail) {
            logWarning('⚠️ Email administrateur non configuré dans les propriétés du script');
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
            <p><strong>Horodatage:</strong> ${new Date().toLocaleString('fr-FR')}</p>
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

        logInfo(`📧 Email envoyé à l'administrateur: ${subject}`);

    } catch (error) {
        logError('❌ Échec de l\'envoi de l\'email administrateur', error);
    }
}

/**
 * 🔨 Construire une URL avec paramètres
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
 * 🔍 Obtenir la dernière ligne vide d'une feuille
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
 * 🚫 Vérifier si la soumission contient un refus de consentement
 */
function isConsentRefused(formData) {
    const consent = formData.personalDataProtection || '';

    const isRefused = CONFIG.REFUSAL_PHRASES.some(phrase =>
        consent.toLowerCase().includes(phrase.toLowerCase())
    );

    if (isRefused) {
        logInfo('🚫 Soumission ignorée: refus de consentement détecté');
    }

    return isRefused;
}