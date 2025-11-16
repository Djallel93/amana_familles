/**
 * @file src/ui/menu.js (UPDATED with Debug)
 * @description Updated menu with insert/update functionality and debug tools
 */

/**
 * Create custom menu on spreadsheet open
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('👨‍👩‍👧‍👦 Gestion Familles')
        .addItem('➕ Nouvelle Famille / ✏️ Mise à Jour', 'showManualEntryDialog')
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
    showDialog('views/dialogs/manualEntry', 'Gestion Famille', 600, 750);
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
// BULK IMPORT MENU FUNCTIONS
// ============================================

/**
 * Create Bulk Import sheet
 */
function createBulkImportSheet() {
    getOrCreateBulkImportSheet();
    SpreadsheetApp.getUi().alert(
        '✅ Feuille "Bulk Import" prête',
        'Vous pouvez maintenant coller vos données.\n\nColonnes requises:\nnom, prenom, nombre_adulte, nombre_enfant, adresse, code_postal, ville, telephone, criticite',
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