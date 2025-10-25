/**
 * @file src/ui/menu.js
 * @description Spreadsheet menu creation and UI functions (with template support)
 */

/**
 * Create custom menu on spreadsheet open
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('📦 Gestion Familles')
        .addItem('➕ Inscription Manuelle', 'showManualEntryDialog')
        .addSeparator()
        .addSubMenu(ui.createMenu('📥 Import en Masse')
            .addItem('📑 Créer/Ouvrir Feuille Import', 'createBulkImportSheet')
            .addItem('⚙️ Traiter Import', 'showBulkImportDialog')
            .addItem('🧹 Effacer Feuille Import', 'clearBulkImportSheetWithConfirm')
            .addItem('📊 Statistiques Import', 'showBulkImportStats')
            .addItem('🔄 Réinitialiser "Processing"', 'resetProcessingStatusWithConfirm'))
        .addSeparator()
        .addItem('🔄 Rafraîchir Cache', 'clearAllCaches')
        .addItem('📊 Statistiques Générales', 'showStatistics')
        .addToUi();
}

/**
 * Generic dialog renderer using HTML templates
 * Supports <?!= include('file.html'); ?> syntax
 *
 * @param {string} viewPath - Path to the HTML view (without .html extension)
 * @param {string} title - Dialog title
 * @param {number} width - Width in px
 * @param {number} height - Height in px
 * @param {Object} [data] - Optional data to inject into the template
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
 * Include partial HTML (CSS, JS, etc.)
 * Usage: <?!= include('path/to/file.html'); ?>
 */
function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Show manual entry dialog
 */
function showManualEntryDialog() {
    showDialog('views/dialogs/manualEntry', 'Inscription Famille', 600, 700);
}

/**
 * Show bulk import dialog
 */
function showBulkImportDialog() {
    showDialog('views/dialogs/bulkImport', 'Import en Masse', 600, 750);
}

/**
 * Create Bulk Import sheet
 */
function createBulkImportSheet() {
    getOrCreateBulkImportSheet();
    SpreadsheetApp.getUi().alert(
        '✅ Feuille "Bulk Import" prête',
        'Vous pouvez maintenant coller vos données.\n\nColonnes requises:\nnom, prenom, nombre_adulte, nombre_enfant, adresse, code_postal, ville, telephone',
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


