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
        .addItem('🔄 Rafraîchir Cache', 'clearAllCaches')
        .addItem('📊 Statistiques Générales', 'showStatistics')
        .addToUi();
}

function createSyncMenu(ui) {
    return ui.createMenu('🔄 Synchronisation Contacts')
        .addItem('📥 Sync Contact → Feuille', 'showReverseContactSyncDialog')
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

function showDialog(viewPath, title, width, height, data) {
    const template = HtmlService.createTemplateFromFile(viewPath);
    if (data && typeof data === 'object') Object.assign(template, data);
    const html = template.evaluate().setWidth(width).setHeight(height).setTitle(title);
    SpreadsheetApp.getUi().showModalDialog(html, title);
}

function showManualEntryDialog() {
    showDialog('views/dialogs/manualEntry', 'Gestion Famille', 600, 850);
}

function showBulkImportDialog() {
    showDialog('views/dialogs/bulkImport', 'Import en Masse', 600, 750);
}

function showBulkUpdateDialog() {
    showDialog('views/dialogs/bulkUpdate', 'Mise à Jour en Masse', 600, 750);
}

function showReverseContactSyncDialog() {
    showDialog('views/dialogs/reverseContactSync', 'Sync Contact → Feuille', 1000, 700);
}

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
Peuvent se déplacer: ${stats.seDeplace}

Éligibilité:
    Zakat El Fitr: ${stats.zakatElFitr}
    Sadaqa: ${stats.sadaqa}

Langues:
    Français: ${stats.byLangue['Français']}
    Arabe: ${stats.byLangue['Arabe']}
    Anglais: ${stats.byLangue['Anglais']}
`;
    SpreadsheetApp.getUi().alert('Statistiques', message, SpreadsheetApp.getUi().ButtonSet.OK);
}