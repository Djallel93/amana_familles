/**
 * @file src/ui/menu.js (UPDATED with Email Verification)
 * @description Updated menu with email verification functionality
 */

/**
 * Create custom menu on spreadsheet open
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('📦 Gestion Familles')
        .addItem('➕ Nouvelle Famille / ✏️ Mise à Jour', 'showManualEntryDialog')
        .addSeparator()
        .addSubMenu(ui.createMenu('📧 Vérification Email')
            .addItem('✉️ Envoyer Emails de Vérification', 'sendVerificationEmailsWithConfirm')
            .addItem('📊 Aperçu des Destinataires', 'showEmailPreview'))
        .addSeparator()
        .addSubMenu(ui.createMenu('📥 Import en Masse')
            .addItem('⚙️ Traiter Import', 'showBulkImportDialog')
            .addItem('🧹 Effacer Feuille Import', 'clearBulkImportSheetWithConfirm')
            .addItem('📊 Statistiques Import', 'showBulkImportStats')
            .addItem('🔄 Réinitialiser "Processing"', 'resetProcessingStatusWithConfirm'))
        .addSeparator()
        .addSubMenu(ui.createMenu('✏️ Mise à Jour en Masse')
            .addItem('📑 Créer/Ouvrir Feuille Update', 'createBulkUpdateSheet')
            .addItem('⚙️ Traiter Mises à Jour', 'showBulkUpdateDialog')
            .addItem('🧹 Effacer Feuille Update', 'clearBulkUpdateSheetWithConfirm')
            .addItem('📊 Statistiques Update', 'showBulkUpdateStats')
            .addItem('🔄 Réinitialiser "Processing"', 'resetUpdateProcessingStatusWithConfirm'))
        .addSeparator()
        .addSubMenu(ui.createMenu('🔍 Debug Contacts')
            .addItem('📋 Lister tous les contacts', 'debugListAllContacts')
            .addItem('🔎 Chercher un contact par ID', 'showDebugFindContactDialog')
            .addItem('🗑️ Supprimer un contact par ID', 'showDebugDeleteContactDialog')
            .addItem('🧪 Tester création contact', 'showDebugTestContactDialog'))
        .addSeparator()
        .addItem('🔄 Rafraîchir Cache', 'clearAllCaches')
        .addItem('📊 Statistiques Générales', 'showStatistics')
        .addToUi();
}

/**
 * Generic dialog renderer using HTML templates
 */
function showDialog(viewPath, title, width, height, data) {
    const template = HtmlService.createTemplateFromFile(viewPath);

    if (data && typeof data === 'object') {
        Object.assign(template, data);
    }

    const html = template.evaluate()
        .setWidth(width)
        .setHeight(height)
        .setTitle(title);

    SpreadsheetApp.getUi().showModalDialog(html, title);
}

/**
 * Show manual entry/update dialog (unified)
 */
function showManualEntryDialog() {
    showDialog('views/dialogs/manualEntry', 'Gestion Famille', 600, 850);
}

/**
 * Show bulk import dialog
 */
function showBulkImportDialog() {
    showDialog('views/dialogs/bulkImport', 'Import en Masse', 600, 750);
}

/**
 * Show bulk update dialog
 */
function showBulkUpdateDialog() {
    showDialog('views/dialogs/bulkUpdate', 'Mise à Jour en Masse', 600, 750);
}

// ============================================
// EMAIL VERIFICATION MENU FUNCTIONS
// ============================================

/**
 * Send verification emails with confirmation
 */
function sendVerificationEmailsWithConfirm() {
    const ui = SpreadsheetApp.getUi();

    // Get count first
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

    if (response === ui.Button.YES) {
        // Show progress
        const progressHtml = HtmlService.createHtmlOutput(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h2>📧 Envoi en cours...</h2>
                    <p>Veuillez patienter pendant l'envoi des emails.</p>
                    <div style="margin: 30px auto; width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #1a73e8; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <style>
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    </style>
                </body>
            </html>
        `);
        ui.showModalDialog(progressHtml, 'Envoi d\'emails');

        // Send emails
        const result = sendVerificationEmailsToAll();

        if (result.success) {
            ui.alert(
                '✅ Envoi terminé',
                `Résultats :\n\n` +
                `✅ Envoyés : ${result.results.sent}\n` +
                `⏭️ Ignorés : ${result.results.skipped}\n` +
                `❌ Échecs : ${result.results.failed}\n\n` +
                `Total traité : ${result.results.total}`,
                ui.ButtonSet.OK
            );
        } else {
            ui.alert(
                '❌ Erreur',
                `L'envoi des emails a échoué :\n\n${result.error}`,
                ui.ButtonSet.OK
            );
        }
    }
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
                langue: row[OUTPUT_COLUMNS.LANGUE] || 'fr'
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

    // Build preview list
    let previewText = `📧 Aperçu des destinataires (${eligible.length} famille(s))\n\n`;

    eligible.slice(0, 20).forEach(f => {
        previewText += `• ${f.prenom} ${f.nom} (ID: ${f.id})\n  📧 ${f.email} | 🌍 ${f.langue.toUpperCase()}\n\n`;
    });

    if (eligible.length > 20) {
        previewText += `... et ${eligible.length - 20} autres famille(s)\n`;
    }

    ui.alert('📧 Aperçu des Destinataires', previewText, ui.ButtonSet.OK);
}

// ============================================
// DEBUG MENU FUNCTIONS
// ============================================

/**
 * Show dialog to search for a contact by family ID
 */
function showDebugFindContactDialog() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(
        '🔎 Chercher un contact',
        'Entrez l\'ID de la famille:',
        ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() === ui.Button.OK) {
        const familyId = response.getResponseText().trim();
        if (familyId) {
            debugFindContactByFamilyId(familyId);
            ui.alert('✓ Recherche terminée', 'Consultez les logs (Ctrl+Entrée ou Cmd+Entrée)', ui.ButtonSet.OK);
        }
    }
}

/**
 * Show dialog to delete a contact by family ID
 */
function showDebugDeleteContactDialog() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(
        '🗑️ Supprimer un contact',
        'Entrez l\'ID de la famille:',
        ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() === ui.Button.OK) {
        const familyId = response.getResponseText().trim();
        if (familyId) {
            const confirmResponse = ui.alert(
                '⚠️ Confirmation',
                `Êtes-vous sûr de vouloir supprimer le contact pour la famille ${familyId} ?`,
                ui.ButtonSet.YES_NO
            );

            if (confirmResponse === ui.Button.YES) {
                debugDeleteContactByFamilyId(familyId);
                ui.alert('✓ Terminé', 'Consultez les logs pour voir le résultat', ui.ButtonSet.OK);
            }
        }
    }
}

/**
 * Show dialog to test contact creation for a family
 */
function showDebugTestContactDialog() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(
        '🧪 Tester création de contact',
        'Entrez l\'ID de la famille:',
        ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() === ui.Button.OK) {
        const familyId = parseInt(response.getResponseText().trim());
        if (!isNaN(familyId)) {
            debugTestContactCreation(familyId);
            ui.alert('✓ Test terminé', 'Consultez les logs (Ctrl+Entrée ou Cmd+Entrée)', ui.ButtonSet.OK);
        } else {
            ui.alert('❌ Erreur', 'ID invalide. Doit être un nombre.', ui.ButtonSet.OK);
        }
    }
}

// ============================================
// BULK IMPORT MENU FUNCTIONS
// ============================================

/**
 * Create Bulk Import sheet
 */
function createBulkImportSheet() {
    getOrCreateBulkImportSheet();
    SpreadsheetApp.getUi().alert(
        '✅ Feuille "Bulk Import" prête',
        'Vous pouvez maintenant coller vos données.\n\nColonnes requises:\nnom, prenom, nombre_adulte, nombre_enfant, adresse, code_postal, ville, telephone, criticite, langue',
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
// BULK UPDATE MENU FUNCTIONS
// ============================================

/**
 * Create Bulk Update sheet
 */
function createBulkUpdateSheet() {
    getOrCreateBulkUpdateSheet();
    SpreadsheetApp.getUi().alert(
        '✅ Feuille "Bulk Update" prête',
        'Vous pouvez maintenant coller vos mises à jour.\n\n⚠️ IMPORTANT:\n• Colonne "id" OBLIGATOIRE\n• Au moins une autre colonne doit contenir une valeur\n• Seules les colonnes non vides seront mises à jour',
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
// OTHER MENU FUNCTIONS
// ============================================

/**
 * Show statistics dialog
 */
function showStatistics() {
    const stats = calculateStatistics();
    const message = `
📊 Statistiques des Familles

Total: ${stats.total}
Validées: ${stats.validated}
En cours: ${stats.inProgress}
Rejetées: ${stats.rejected}

Adultes: ${stats.totalAdults}
Enfants: ${stats.totalChildren}
`;

    SpreadsheetApp.getUi().alert('Statistiques', message, SpreadsheetApp.getUi().ButtonSet.OK);
}