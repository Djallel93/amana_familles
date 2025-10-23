/**
 * @file src/ui/menu.js
 * @description Spreadsheet menu creation and UI functions
 */

/**
 * Create custom menu on spreadsheet open
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('📦 Gestion Familles')
        .addItem('➕ Inscription Manuelle', 'showManualEntryDialog')
        .addSeparator()
        .addItem('🔄 Rafraîchir Cache', 'clearAllCaches')
        .addItem('📊 Statistiques', 'showStatistics')
        .addToUi();
}

/**
 * Show manual entry dialog
 */
function showManualEntryDialog() {
    const html = HtmlService.createHtmlOutputFromFile('views/dialogs/manualEntry')
        .setWidth(600)
        .setHeight(700)
        .setTitle('Inscription Manuelle');

    SpreadsheetApp.getUi().showModalDialog(html, 'Inscription Famille');
}

/**
 * Clear all caches
 */
function clearAllCaches() {
    CacheService.getScriptCache().removeAll([]);
    SpreadsheetApp.getUi().alert('✅ Cache effacé avec succès');
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

/**
 * Calculate statistics from famille sheet
 */
function calculateStatistics() {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
    if (!sheet) {
        return {
            total: 0,
            validated: 0,
            inProgress: 0,
            rejected: 0,
            totalAdults: 0,
            totalChildren: 0
        };
    }

    const data = sheet.getDataRange().getValues();
    const stats = {
        total: data.length - 1,
        validated: 0,
        inProgress: 0,
        rejected: 0,
        totalAdults: 0,
        totalChildren: 0
    };

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const status = row[OUTPUT_COLUMNS.ETAT_DOSSIER];

        if (status === CONFIG.STATUS.VALIDATED) stats.validated++;
        if (status === CONFIG.STATUS.IN_PROGRESS) stats.inProgress++;
        if (status === CONFIG.STATUS.REJECTED) stats.rejected++;

        stats.totalAdults += parseInt(row[OUTPUT_COLUMNS.NOMBRE_ADULTE]) || 0;
        stats.totalChildren += parseInt(row[OUTPUT_COLUMNS.NOMBRE_ENFANT]) || 0;
    }

    return stats;
}