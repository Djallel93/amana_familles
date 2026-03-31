/**
 * @file src/ui/menu.js
 */

function onOpenHandler() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('📦 Gestion Familles')
        .addItem('➕ Nouvelle Famille / ✏️ Mise à Jour', 'showManualEntryDialog')
        .addSeparator()
        .addSubMenu(createSyncMenu(ui))
        .addSeparator()
        .addSubMenu(createEmailMenu(ui))
        .addSeparator()
        .addSubMenu(createBulkImportMenu(ui))
        .addSeparator()
        .addSubMenu(createBulkUpdateMenu(ui))
        .addSeparator()
        .addSubMenu(createValidationMenu(ui))
        .addSeparator()
        .addSubMenu(createMaintenanceMenu(ui))
        .addToUi();
}

function createSyncMenu(ui) {
    return ui.createMenu('🔄 Synchronisation Contacts')
        .addItem('📥 Sync Contact → Feuille', 'showReverseContactSyncDialog');
}

function createEmailMenu(ui) {
    return ui.createMenu('📧 Vérification Email')
        .addItem('✉️ Envoyer Emails de Vérification', 'sendVerificationEmailsWithConfirm')
        .addItem('📊 Aperçu des Destinataires', 'showEmailPreview');
}

function createBulkImportMenu(ui) {
    return ui.createMenu('📥 Import en Masse')
        .addItem('⚙️ Traiter Import', 'showBulkImportDialog')
        .addItem('🧹 Effacer Feuille Import', 'clearBulkImportSheetWithConfirm')
        .addItem('📊 Statistiques Import', 'showBulkImportStats')
        .addItem('🔄 Réinitialiser "Processing"', 'resetProcessingStatusWithConfirm');
}

function createBulkUpdateMenu(ui) {
    return ui.createMenu('✏️ Mise à Jour en Masse')
        .addItem('⚙️ Traiter Mises à Jour', 'showBulkUpdateDialog')
        .addItem('🧹 Effacer Feuille Update', 'clearBulkUpdateSheetWithConfirm')
        .addItem('📊 Statistiques Update', 'showBulkUpdateStats')
        .addItem('🔄 Réinitialiser "Processing"', 'resetUpdateProcessingStatusWithConfirm');
}

function createValidationMenu(ui) {
    return ui.createMenu('🔍 Validation & Diagnostic')
        .addItem('✅ Valider Configuration Complète', 'runFullValidation')
        .addItem('📋 Valider Structure des Feuilles', 'validateSheetsOnly')
        .addItem('🔑 Valider Paramètres du Script', 'validatePropertiesOnly')
        .addItem('🌐 Tester Connexion GEO API', 'testGeoApiOnly')
        .addItem('📞 Tester Accès Contacts API', 'testContactsApiOnly')
        .addItem('🔧 Correction Automatique', 'runAutoFix');
}

function createMaintenanceMenu(ui) {
    return ui.createMenu('🛠️ Maintenance')
        .addItem('🔄 Rafraîchir Cache', 'clearAllCaches')
        .addItem('📊 Statistiques Générales', 'showStatistics')
        .addItem('📦 Migrer commentaires vers Audit', 'runMigrationWithConfirm');
}

function showDialog(viewPath, title, width, height, data) {
    const template = HtmlService.createTemplateFromFile(viewPath);
    if (data && typeof data === 'object') Object.assign(template, data);
    const html = template.evaluate().setWidth(width).setHeight(height).setTitle(title);
    SpreadsheetApp.getUi().showModalDialog(html, title);
}

function showManualEntryDialog() { showDialog('views/dialogs/manualEntry', 'Gestion Famille', 600, 850); }
function showBulkImportDialog() { showDialog('views/dialogs/bulkImport', 'Import en Masse', 600, 750); }
function showBulkUpdateDialog() { showDialog('views/dialogs/bulkUpdate', 'Mise à Jour en Masse', 600, 750); }
function showReverseContactSyncDialog() { showDialog('views/dialogs/reverseContactSync', 'Sync Contact → Feuille', 1000, 700); }

function showStatistics() {
    const stats = calculateStatistics();
    const message = `📊 Statistiques des Familles\n\nTotal: ${stats.total}\nValidées: ${stats.validated}\nEn cours: ${stats.inProgress}\nRejetées: ${stats.rejected}\n\nAdultes: ${stats.totalAdults}\nEnfants: ${stats.totalChildren}\nPeuvent se déplacer: ${stats.seDeplace}\n\nÉligibilité:\n    Zakat El Fitr: ${stats.zakatElFitr}\n    Sadaqa: ${stats.sadaqa}\n\nLangues:\n    Français: ${stats.byLangue['Français']}\n    Arabe: ${stats.byLangue['Arabe']}\n    Anglais: ${stats.byLangue['Anglais']}`;
    SpreadsheetApp.getUi().alert('Statistiques', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function runMigrationWithConfirm() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
        '📦 Migration des commentaires',
        'Cette action va:\n\n' +
        '1. Créer la feuille "Audit" si elle n\'existe pas\n' +
        '2. Migrer tous les commentaires existants vers la feuille Audit\n' +
        '3. Supprimer la colonne "commentaire_dossier" de la feuille Famille\n\n' +
        '⚠️ Cette action est irréversible.\n\nContinuer ?',
        ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) return;

    ui.alert('⏳ Migration en cours', 'Veuillez patienter...', ui.ButtonSet.OK);

    const result = migrateCommentsToAudit();

    if (result.success) {
        ui.alert('✅ Migration terminée',
            `${result.migrated} entrées migrées vers la feuille Audit.\n${result.errors > 0 ? result.errors + ' erreurs rencontrées.' : 'Aucune erreur.'}`,
            ui.ButtonSet.OK);
    } else {
        ui.alert('❌ Échec migration',
            'La migration a échoué. Consultez les logs pour plus de détails.',
            ui.ButtonSet.OK);
    }
}
