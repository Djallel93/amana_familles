/**
 * @file src/ui/menu.js
 * @description Main menu structure with core functionality
 */

/**
 * Create custom menu on spreadsheet open
 */
function onOpen() {
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

/**
 * Create synchronization submenu
 */
function createSyncMenu(ui) {
    return ui.createMenu('🔄 Synchronisation Contacts')
        .addItem('📥 Sync Contact → Feuille', 'showReverseContactSyncDialog')
        .addItem('📤 Sync Feuille → Contact (Auto)', 'showSyncInfo');
}

/**
 * Create email verification submenu
 */
function createEmailMenu(ui) {
    return ui.createMenu('📧 Vérification Email')
        .addItem('✉️ Envoyer Emails de Vérification', 'sendVerificationEmailsWithConfirm')
        .addItem('📊 Aperçu des Destinataires', 'showEmailPreview');
}

/**
 * Create bulk import submenu
 */
function createBulkImportMenu(ui) {
    return ui.createMenu('📥 Import en Masse')
        .addItem('📑 Créer/Ouvrir Feuille Import', 'createBulkImportSheet')
        .addItem('⚙️ Traiter Import', 'showBulkImportDialog')
        .addItem('🧹 Effacer Feuille Import', 'clearBulkImportSheetWithConfirm')
        .addItem('📊 Statistiques Import', 'showBulkImportStats')
        .addItem('🔄 Réinitialiser "Processing"', 'resetProcessingStatusWithConfirm');
}

/**
 * Create bulk update submenu
 */
function createBulkUpdateMenu(ui) {
    return ui.createMenu('✏️ Mise à Jour en Masse')
        .addItem('📑 Créer/Ouvrir Feuille Update', 'createBulkUpdateSheet')
        .addItem('⚙️ Traiter Mises à Jour', 'showBulkUpdateDialog')
        .addItem('🧹 Effacer Feuille Update', 'clearBulkUpdateSheetWithConfirm')
        .addItem('📊 Statistiques Update', 'showBulkUpdateStats')
        .addItem('🔄 Réinitialiser "Processing"', 'resetUpdateProcessingStatusWithConfirm');
}

/**
 * Create validation submenu
 */
function createValidationMenu(ui) {
    return ui.createMenu('🔍 Validation & Diagnostic')
        .addItem('✅ Valider Configuration Complète', 'runFullValidation')
        .addItem('📋 Valider Structure des Feuilles', 'validateSheetsOnly')
        .addItem('🔑 Valider Paramètres du Script', 'validatePropertiesOnly')
        .addItem('🌐 Tester Connexion GEO API', 'testGeoApiOnly')
        .addItem('📞 Tester Accès Contacts API', 'testContactsApiOnly')
        .addItem('🔧 Correction Automatique', 'runAutoFix');
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

/**
 * Show reverse contact sync dialog
 */
function showReverseContactSyncDialog() {
    showDialog('views/dialogs/reverseContactSync', 'Sync Contact → Feuille', 600, 700);
}

/**
 * Show info about automatic Sheet → Contact sync
 */
function showSyncInfo() {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
        '📤 Sync Feuille → Contact (Automatique)',
        'La synchronisation Feuille → Contact se fait automatiquement :\n\n' +
        '✅ Lorsqu\'une famille passe au statut "Validé"\n' +
        '✅ Lorsqu\'une famille validée est modifiée\n\n' +
        '📝 Le contact Google est créé/mis à jour avec :\n' +
        '• Nom, prénom, téléphone(s), email\n' +
        '• Adresse structurée\n' +
        '• Criticité, composition du foyer\n' +
        '• Éligibilité Zakat/Sadaqa\n' +
        '• Langue préférée\n\n' +
        '💡 Ces informations sont stockées dans les champs personnalisés du contact.',
        ui.ButtonSet.OK
    );
}

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