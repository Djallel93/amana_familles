/**
 * @file src/ui/menuHandlers.js
 * @description Menu action handlers for email, bulk operations, and validation
 */

// ============================================
// EMAIL VERIFICATION HANDLERS
// ============================================

/**
 * Send verification emails with confirmation
 */
function sendVerificationEmailsWithConfirm() {
    const ui = SpreadsheetApp.getUi();

    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) {
        ui.alert('❌ Erreur', 'Feuille Famille introuvable', ui.ButtonSet.OK);
        return;
    }

    const data = sheet.getDataRange().getValues();
    let eligibleCount = 0;

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] === CONFIG.STATUS.VALIDATED &&
            row[OUTPUT_COLUMNS.EMAIL]) {
            eligibleCount++;
        }
    }

    if (eligibleCount === 0) {
        ui.alert(
            '⚠️ Aucun destinataire',
            'Aucune famille validée avec une adresse email valide trouvée.',
            ui.ButtonSet.OK
        );
        return;
    }

    const response = ui.alert(
        '📧 Confirmation d\'envoi',
        `Vous êtes sur le point d'envoyer des emails de vérification à ${eligibleCount} famille(s) validée(s).\n\n` +
        'Les familles recevront un email dans leur langue préférée avec :\n' +
        '• Leurs informations actuelles\n' +
        '• Un bouton pour confirmer que tout est à jour\n' +
        '• Un lien vers le formulaire de mise à jour\n\n' +
        'Continuer ?',
        ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
        return;
    }

    showEmailSendingDialog(eligibleCount);
}

/**
 * Show email sending dialog with live updates
 */
function showEmailSendingDialog(totalCount) {
    const html = HtmlService.createHtmlOutputFromFile('views/dialogs/emailSending')
        .setWidth(500)
        .setHeight(700);

    SpreadsheetApp.getUi().showModalDialog(html, 'Envoi d\'emails de vérification');
}

/**
 * Show email preview - list of families who will receive emails
 */
function showEmailPreview() {
    const ui = SpreadsheetApp.getUi();
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);

    if (!sheet) {
        ui.alert('❌ Erreur', 'Feuille Famille introuvable', ui.ButtonSet.OK);
        return;
    }

    const data = sheet.getDataRange().getValues();
    const eligible = [];

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] === CONFIG.STATUS.VALIDATED &&
            row[OUTPUT_COLUMNS.EMAIL]) {
            eligible.push({
                id: row[OUTPUT_COLUMNS.ID],
                nom: row[OUTPUT_COLUMNS.NOM],
                prenom: row[OUTPUT_COLUMNS.PRENOM],
                email: row[OUTPUT_COLUMNS.EMAIL],
                langue: row[OUTPUT_COLUMNS.LANGUE] || 'Français'
            });
        }
    }

    if (eligible.length === 0) {
        ui.alert(
            '⚠️ Aucun destinataire',
            'Aucune famille validée avec une adresse email valide trouvée.',
            ui.ButtonSet.OK
        );
        return;
    }

    let previewText = `📧 Aperçu des destinataires (${eligible.length} famille(s))\n\n`;

    eligible.slice(0, 20).forEach(f => {
        previewText += `• ${f.prenom} ${f.nom} (ID: ${f.id})\n  📧 ${f.email} | 🌍 ${f.langue}\n\n`;
    });

    if (eligible.length > 20) {
        previewText += `... et ${eligible.length - 20} autres famille(s)\n`;
    }

    ui.alert('📧 Aperçu des Destinataires', previewText, ui.ButtonSet.OK);
}

// ============================================
// BULK IMPORT HANDLERS
// ============================================

/**
 * Create Bulk Import sheet
 */
function createBulkImportSheet() {
    getOrCreateBulkImportSheet();
    SpreadsheetApp.getUi().alert(
        '✅ Feuille "Bulk Import" prête',
        'Vous pouvez maintenant coller vos données.\n\n' +
        '⚠️ IMPORTANT:\n' +
        '• La ligne 1 contient les en-têtes (ne pas modifier)\n' +
        '• Collez vos données À PARTIR DE LA LIGNE 2\n\n' +
        'Colonnes requises:\nnom, prenom, nombre_adulte, nombre_enfant, adresse, code_postal, ville, telephone, criticite, langue',
        SpreadsheetApp.getUi().ButtonSet.OK
    );
}

/**
 * Clear bulk import sheet with confirmation
 */
function clearBulkImportSheetWithConfirm() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
        '⚠️ Confirmation',
        'Êtes-vous sûr de vouloir effacer toutes les données de la feuille "Bulk Import" ?\n\nCette action est irréversible.',
        ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
        const result = clearBulkImportSheet();
        ui.alert('✅ ' + result.message);
    }
}

/**
 * Show bulk import statistics
 */
function showBulkImportStats() {
    const stats = getBulkImportStatistics();
    const message = `
📊 Statistiques Import en Masse

Total de lignes: ${stats.total}
━━━━━━━━━━━━━━━━━━━━
⏳ En attente: ${stats.pending}
⚙️ En traitement: ${stats.processing}
✅ Réussies: ${stats.success}
❌ Erreurs: ${stats.error}

${stats.pending > 0 ? '\n💡 Cliquez sur "Traiter Import" pour continuer.' : ''}
${stats.processing > 0 ? '\n⚠️ ' + stats.processing + ' lignes en "Processing". Utilisez "Réinitialiser Processing" pour les remettre en attente.' : ''}
`;

    SpreadsheetApp.getUi().alert('Statistiques Import', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Reset processing status with confirmation
 */
function resetProcessingStatusWithConfirm() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
        '🔄 Réinitialiser les statuts "Processing"',
        'Cette action réinitialisera toutes les lignes "Processing" en "Pending".\n\nUtile après un timeout de script.\n\nContinuer ?',
        ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
        resetProcessingStatus();
        ui.alert('✅ Statuts réinitialisés');
    }
}

// ============================================
// BULK UPDATE HANDLERS
// ============================================

/**
 * Create Bulk Update sheet
 */
function createBulkUpdateSheet() {
    getOrCreateBulkUpdateSheet();
    SpreadsheetApp.getUi().alert(
        '✅ Feuille "Bulk Update" prête',
        'Vous pouvez maintenant coller vos mises à jour.\n\n' +
        '⚠️ IMPORTANT:\n' +
        '• La ligne 1 contient les en-têtes (ne pas modifier)\n' +
        '• Collez vos données À PARTIR DE LA LIGNE 2\n' +
        '• Colonne "id" OBLIGATOIRE\n' +
        '• Au moins une autre colonne doit contenir une valeur\n' +
        '• Seules les colonnes non vides seront mises à jour',
        SpreadsheetApp.getUi().ButtonSet.OK
    );
}

/**
 * Clear bulk update sheet with confirmation
 */
function clearBulkUpdateSheetWithConfirm() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
        '⚠️ Confirmation',
        'Êtes-vous sûr de vouloir effacer toutes les données de la feuille "Bulk Update" ?\n\nCette action est irréversible.',
        ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
        const result = clearBulkUpdateSheet();
        ui.alert('✅ ' + result.message);
    }
}

/**
 * Show bulk update statistics
 */
function showBulkUpdateStats() {
    const stats = getBulkUpdateStatistics();
    const message = `
📊 Statistiques Mise à Jour en Masse

Total de lignes: ${stats.total}
━━━━━━━━━━━━━━━━━━━━
⏳ En attente: ${stats.pending}
⚙️ En traitement: ${stats.processing}
✅ Réussies: ${stats.success}
❌ Erreurs: ${stats.error}

${stats.pending > 0 ? '\n💡 Cliquez sur "Traiter Mises à Jour" pour continuer.' : ''}
${stats.processing > 0 ? '\n⚠️ ' + stats.processing + ' lignes en "Processing". Utilisez "Réinitialiser Processing" pour les remettre en attente.' : ''}
`;

    SpreadsheetApp.getUi().alert('Statistiques Update', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Reset update processing status with confirmation
 */
function resetUpdateProcessingStatusWithConfirm() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
        '🔄 Réinitialiser les statuts "Processing"',
        'Cette action réinitialisera toutes les lignes "Processing" en "Pending" dans Bulk Update.\n\nUtile après un timeout de script.\n\nContinuer ?',
        ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
        resetUpdateProcessingStatus();
        ui.alert('✅ Statuts réinitialisés');
    }
}

// ============================================
// VALIDATION HANDLERS
// ============================================

/**
 * Run full system validation
 */
function runFullValidation() {
    const ui = SpreadsheetApp.getUi();

    ui.alert(
        '🔍 Validation du Système',
        'Analyse en cours...\n\nCela peut prendre quelques secondes.',
        ui.ButtonSet.OK
    );

    const results = runSystemValidation();

    let message = `═══════════════════════════════════════\n`;
    message += `📊 RAPPORT DE VALIDATION SYSTÈME\n`;
    message += `═══════════════════════════════════════\n\n`;
    message += `Timestamp: ${results.timestamp}\n`;
    message += `Statut Global: ${results.overall ? '✅ SUCCÈS' : '❌ ERREURS DÉTECTÉES'}\n`;
    message += `Erreurs: ${results.summary.errors} | Avertissements: ${results.summary.warnings}\n\n`;

    // Sheets validation
    message += `📋 STRUCTURE DES FEUILLES\n`;
    message += `${results.checks.sheets.success ? '✅' : '❌'} Statut: ${results.checks.sheets.success ? 'OK' : 'Erreurs détectées'}\n`;
    if (results.checks.sheets.errors.length > 0) {
        results.checks.sheets.errors.forEach(err => message += `  ${err}\n`);
    }
    if (results.checks.sheets.warnings.length > 0) {
        results.checks.sheets.warnings.forEach(warn => message += `  ${warn}\n`);
    }
    message += '\n';

    // Properties validation
    message += `🔑 PARAMÈTRES DU SCRIPT\n`;
    message += `${results.checks.properties.success ? '✅' : '❌'} Statut: ${results.checks.properties.success ? 'OK' : 'Erreurs détectées'}\n`;
    if (results.checks.properties.errors.length > 0) {
        results.checks.properties.errors.forEach(err => message += `  ${err}\n`);
    }
    if (results.checks.properties.warnings.length > 0) {
        results.checks.properties.warnings.forEach(warn => message += `  ${warn}\n`);
    }
    message += '\n';

    // GEO API validation
    message += `🌐 CONNEXION GEO API\n`;
    message += `  ${results.checks.geoApi.message}\n`;
    if (results.checks.geoApi.success) {
        message += `  Temps de réponse: ${results.checks.geoApi.responseTime}ms\n`;
    }
    message += '\n';

    // Contacts API validation
    message += `📞 ACCÈS CONTACTS API\n`;
    message += `  ${results.checks.contactsApi.message}\n\n`;

    message += `═══════════════════════════════════════\n`;

    if (results.overall) {
        message += `✅ SYSTÈME OPÉRATIONNEL\n`;
    } else {
        message += `❌ ACTION REQUISE\n`;
        message += `Consultez les détails ci-dessus et corrigez les erreurs.\n`;
    }

    ui.alert('🔍 Validation Complète', message, ui.ButtonSet.OK);
}

/**
 * Validate sheets structure only
 */
function validateSheetsOnly() {
    const ui = SpreadsheetApp.getUi();
    const results = validateSheetStructure();

    let message = `📋 VALIDATION DES FEUILLES\n\n`;
    message += `Statut: ${results.success ? '✅ OK' : '❌ ERREURS'}\n\n`;

    if (results.errors.length > 0) {
        message += `ERREURS:\n`;
        results.errors.forEach(err => message += `${err}\n`);
        message += '\n';
    }

    if (results.warnings.length > 0) {
        message += `AVERTISSEMENTS:\n`;
        results.warnings.forEach(warn => message += `${warn}\n`);
        message += '\n';
    }

    // List all sheets
    message += `FEUILLES DÉTECTÉES:\n`;
    Object.keys(results.sheets).forEach(sheetName => {
        const sheet = results.sheets[sheetName];
        if (sheet.exists) {
            message += `✅ ${sheetName} (${sheet.rows} lignes, ${sheet.columns} colonnes)\n`;
        } else {
            message += `${sheet.required ? '❌' : '⚠️'} ${sheetName} - Manquante\n`;
        }
    });

    ui.alert('📋 Structure des Feuilles', message, ui.ButtonSet.OK);
}

/**
 * Validate script properties only
 */
function validatePropertiesOnly() {
    const ui = SpreadsheetApp.getUi();
    const results = validateScriptProperties();

    let message = `🔑 VALIDATION DES PARAMÈTRES\n\n`;
    message += `Statut: ${results.success ? '✅ OK' : '❌ ERREURS'}\n\n`;

    if (results.errors.length > 0) {
        message += `ERREURS:\n`;
        results.errors.forEach(err => message += `${err}\n`);
        message += '\n';
    }

    if (results.warnings.length > 0) {
        message += `AVERTISSEMENTS:\n`;
        results.warnings.forEach(warn => message += `${warn}\n`);
        message += '\n';
    }

    // List properties
    message += `PARAMÈTRES DÉTECTÉS:\n`;
    Object.keys(results.properties).forEach(propName => {
        const prop = results.properties[propName];
        if (prop.exists) {
            message += `✅ ${propName}: ${prop.preview}\n`;
        } else {
            message += `${prop.required ? '❌' : '⚠️'} ${propName} - Non défini\n`;
        }
    });

    ui.alert('🔑 Paramètres du Script', message, ui.ButtonSet.OK);
}

/**
 * Test GEO API connection only
 */
function testGeoApiOnly() {
    const ui = SpreadsheetApp.getUi();

    ui.alert(
        '🌐 Test GEO API',
        'Test de connexion en cours...',
        ui.ButtonSet.OK
    );

    const results = validateGeoApiConnection();

    let message = `🌐 TEST CONNEXION GEO API\n\n`;
    message += `${results.message}\n\n`;

    if (results.success) {
        message += `Temps de réponse: ${results.responseTime}ms\n`;
        if (results.version) {
            message += `Version: ${results.version}\n`;
        }
    } else {
        message += `Vérifiez:\n`;
        message += `• GEO_API_URL est défini\n`;
        message += `• GEO_API_KEY est valide\n`;
        message += `• L'API GEO est accessible\n`;
    }

    ui.alert('🌐 Connexion GEO API', message, ui.ButtonSet.OK);
}

/**
 * Test Contacts API access only
 */
function testContactsApiOnly() {
    const ui = SpreadsheetApp.getUi();

    ui.alert(
        '📞 Test Contacts API',
        'Test d\'accès en cours...',
        ui.ButtonSet.OK
    );

    const results = validateContactsApiAccess();

    let message = `📞 TEST ACCÈS CONTACTS API\n\n`;
    message += `${results.message}\n\n`;

    if (results.success) {
        message += `Lecture: ${results.canRead ? '✅' : '❌'}\n`;
        message += `Écriture: ${results.canWrite ? '✅' : '❌'}\n`;
    } else {
        message += `Vérifiez:\n`;
        message += `• Google People API est activée\n`;
        message += `• Les permissions OAuth sont correctes\n`;
        message += `• Le service People est disponible\n`;
    }

    ui.alert('📞 Accès Contacts API', message, ui.ButtonSet.OK);
}

/**
 * Run automatic fixes
 */
function runAutoFix() {
    const ui = SpreadsheetApp.getUi();

    const response = ui.alert(
        '🔧 Correction Automatique',
        'Cette fonction va tenter de corriger automatiquement:\n\n' +
        '• Créer les feuilles Bulk Import/Update manquantes\n' +
        '• Effacer le cache\n' +
        '• Réinitialiser les statuts "Processing"\n\n' +
        'Continuer ?',
        ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
        return;
    }

    ui.alert(
        '🔧 Correction en cours',
        'Veuillez patienter...',
        ui.ButtonSet.OK
    );

    const results = autoFixCommonIssues();

    let message = `🔧 CORRECTION AUTOMATIQUE\n\n`;

    if (results.fixed.length > 0) {
        message += `✅ CORRECTIONS APPLIQUÉES:\n`;
        results.fixed.forEach(fix => message += `  • ${fix}\n`);
        message += '\n';
    }

    if (results.failed.length > 0) {
        message += `❌ ÉCHECS:\n`;
        results.failed.forEach(fail => message += `  • ${fail}\n`);
        message += '\n';
    }

    if (results.fixed.length > 0 && results.failed.length === 0) {
        message += `Toutes les corrections ont été appliquées avec succès.\n`;
    }

    ui.alert('🔧 Résultats', message, ui.ButtonSet.OK);
}