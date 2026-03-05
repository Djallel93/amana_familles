/**
 * @file src/core/utils_io.js
 * @description Utilitaires I/O - accès fichiers/feuilles, doublons, notifications, URL, consentement
 */

function getSheetByName(sheetName) {
    return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
}

function fileExists(fileId) {
    try {
        DriveApp.getFileById(fileId);
        return true;
    } catch (e) {
        return false;
    }
}

function getOrCreateFolder(parentFolder, folderName) {
    const folders = parentFolder.getFoldersByName(folderName);
    if (folders.hasNext()) return folders.next();
    return parentFolder.createFolder(folderName);
}

function extractFileIds(urlString) {
    if (!urlString) return [];

    const urls = urlString.split(',').map(u => u.trim());
    const fileIds = [];

    urls.forEach(url => {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) fileIds.push(match[1]);
    });

    return fileIds;
}

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
                logAvertissement('Erreur parsing cache doublon, ignoré', e);
            }
        }

        const data = getFamilySheetData();
        if (!data) {
            logAvertissement('Feuille Famille introuvable pour vérification doublon');
            return { exists: false };
        }

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            const rowPhone = normalizePhone(String(row[OUTPUT_COLUMNS.TELEPHONE] || '')).replace(/[\s\(\)]/g, '');
            const rowLastName = (row[OUTPUT_COLUMNS.NOM] || '').toLowerCase().trim();
            const rowEmail = (row[OUTPUT_COLUMNS.EMAIL] || '').toLowerCase().trim();

            if ((rowPhone === normalizedPhone && rowLastName === normalizedLastName) ||
                (email && rowEmail && rowEmail === email.toLowerCase().trim())) {
                const result = { exists: true, row: i + 1, id: row[OUTPUT_COLUMNS.ID], data: row };
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

function retryOperation(operation, maxRetries = 3) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return operation();
        } catch (e) {
            lastError = e;
            logError(`Tentative ${i + 1}/${maxRetries} échouée`, e);
            if (i < maxRetries - 1) Utilities.sleep(1000 * (i + 1));
        }
    }

    throw lastError;
}

function notifyAdmin(subject, message) {
    try {
        const config = getScriptConfig();
        const adminEmail = config.adminEmail;

        if (!adminEmail) {
            logAvertissement('Email admin non configuré');
            return;
        }

        const emailBody = `<!DOCTYPE html>
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
        <div class="header"><h2>🔔 ${subject}</h2></div>
        <div class="content">
            <p>${message.replace(/\n/g, '<br>')}</p>
            <hr>
            <p><strong>Horodatage:</strong> ${formatDateTime()}</p>
        </div>
        <div class="footer"><p>📦 Système de Gestion des Familles - Notification automatique</p></div>
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

function buildUrlWithParams(baseUrl, action, params) {
    const queryParams = ['action=' + encodeURIComponent(action)];

    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            queryParams.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
    });

    return baseUrl + '?' + queryParams.join('&');
}

function getLastEmptyRow(sheet) {
    const data = sheet.getDataRange().getValues();

    for (let i = data.length - 1; i >= 0; i--) {
        const rowIsEmpty = data[i].every(cell => cell === '' || cell === null);
        if (!rowIsEmpty) return i + 2;
    }

    return 1;
}

function isConsentRefused(formData) {
    const consent = formData.personalDataProtection || '';

    const isRefused = CONFIG.REFUSAL_PHRASES.some(phrase =>
        consent.toLowerCase().includes(phrase.toLowerCase())
    );

    if (isRefused) logInfo('Soumission ignorée: consentement refusé');

    return isRefused;
}