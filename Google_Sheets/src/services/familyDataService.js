/**
 * @file src/services/familyDataService.js
 */

/**
 * Convertit une ligne de feuille en objet famille.
 * @param {Array} row
 * @param {boolean} [includeHierarchy=false]
 * @returns {Object}
 */
function rowToFamilyObject(row, includeHierarchy = false) {
    const family = {
        id: safeGetColumn(row, OUTPUT_COLUMNS.ID),
        nom: safeGetColumn(row, OUTPUT_COLUMNS.NOM),
        prenom: safeGetColumn(row, OUTPUT_COLUMNS.PRENOM),
        zakatElFitr: row[OUTPUT_COLUMNS.ZAKAT_EL_FITR] === true,
        sadaqa: row[OUTPUT_COLUMNS.SADAQA] === true,
        nombreAdulte: parseInt(safeGetColumn(row, OUTPUT_COLUMNS.NOMBRE_ADULTE, 0)) || 0,
        nombreEnfant: parseInt(safeGetColumn(row, OUTPUT_COLUMNS.NOMBRE_ENFANT, 0)) || 0,
        adresse: safeGetColumn(row, OUTPUT_COLUMNS.ADRESSE),
        idQuartier: safeGetColumn(row, OUTPUT_COLUMNS.ID_QUARTIER, null),
        seDeplace: row[OUTPUT_COLUMNS.SE_DEPLACE] === true,
        email: safeGetColumn(row, OUTPUT_COLUMNS.EMAIL),
        telephone: safeGetColumn(row, OUTPUT_COLUMNS.TELEPHONE),
        telephoneBis: safeGetColumn(row, OUTPUT_COLUMNS.TELEPHONE_BIS),
        circonstances: safeGetColumn(row, OUTPUT_COLUMNS.CIRCONSTANCES),
        ressentit: safeGetColumn(row, OUTPUT_COLUMNS.RESSENTIT),
        specificites: safeGetColumn(row, OUTPUT_COLUMNS.SPECIFICITES),
        criticite: parseInt(safeGetColumn(row, OUTPUT_COLUMNS.CRITICITE, 0)) || 0,
        langue: safeGetColumn(row, OUTPUT_COLUMNS.LANGUE, CONFIG.LANGUAGES.FR)
    };

    if (includeHierarchy && family.idQuartier) {
        const hierarchy = getLocationHierarchyFromQuartier(family.idQuartier);
        if (!hierarchy.error) {
            family.idVille = hierarchy.ville.id;
            family.idSecteur = hierarchy.secteur.id;
        } else {
            family.idVille = null;
            family.idSecteur = null;
        }
    }

    return family;
}

/**
 * Construit un tableau de ligne pour insertion dans la feuille Famille.
 * @param {Object} formData
 * @param {Object} options
 * @returns {Array}
 */
function buildFamilyRow(formData, options = {}) {
    const {
        status = CONFIG.STATUS.IN_PROGRESS,
        familyId = generateFamilyId(),
        quartierId = null,
        identityIds = [],
        aidesEtatIds = [],
        criticite = 0,
        langue = CONFIG.LANGUAGES.FR,
        zakatElFitr = false,
        sadaqa = false,
        seDeplace = false
    } = options;

    const normalizedPhone = normalizePhone(formData.phone);
    const normalizedPhoneBis = formData.phoneBis ? normalizePhone(formData.phoneBis) : '';

    const row = Array(21).fill('');
    row[OUTPUT_COLUMNS.ID] = familyId;
    row[OUTPUT_COLUMNS.NOM] = formData.lastName || '';
    row[OUTPUT_COLUMNS.PRENOM] = formData.firstName || '';
    row[OUTPUT_COLUMNS.ZAKAT_EL_FITR] = zakatElFitr;
    row[OUTPUT_COLUMNS.SADAQA] = sadaqa;
    row[OUTPUT_COLUMNS.NOMBRE_ADULTE] = parseInt(formData.nombreAdulte) || 0;
    row[OUTPUT_COLUMNS.NOMBRE_ENFANT] = parseInt(formData.nombreEnfant) || 0;
    row[OUTPUT_COLUMNS.ADRESSE] = formatAddressCanonical(formData.address, formData.postalCode, formData.city);
    row[OUTPUT_COLUMNS.ID_QUARTIER] = quartierId || '';
    row[OUTPUT_COLUMNS.SE_DEPLACE] = seDeplace;
    row[OUTPUT_COLUMNS.EMAIL] = formData.email || '';
    row[OUTPUT_COLUMNS.TELEPHONE] = normalizedPhone;
    row[OUTPUT_COLUMNS.TELEPHONE_BIS] = normalizedPhoneBis;
    row[OUTPUT_COLUMNS.IDENTITE] = formatDocumentLinks(identityIds);
    row[OUTPUT_COLUMNS.AIDES_ETAT] = formatDocumentLinks(aidesEtatIds);
    row[OUTPUT_COLUMNS.CIRCONSTANCES] = formData.circonstances || '';
    row[OUTPUT_COLUMNS.RESSENTIT] = '';
    row[OUTPUT_COLUMNS.SPECIFICITES] = '';
    row[OUTPUT_COLUMNS.CRITICITE] = criticite;
    row[OUTPUT_COLUMNS.LANGUE] = langue;
    row[OUTPUT_COLUMNS.ETAT_DOSSIER] = status;

    return row;
}

/**
 * @param {string|number} familyId
 * @param {boolean} [includeHierarchy=false]
 * @returns {Object|null}
 */
function getFamilyById(familyId, includeHierarchy = false) {
    const result = findFamilyRowById(familyId);
    if (!result) return null;
    const row = result.data;
    if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] !== CONFIG.STATUS.VALIDATED) return null;
    return rowToFamilyObject(row, includeHierarchy);
}

/**
 * @param {Function} [filterFn]
 * @param {boolean} [includeHierarchy=false]
 * @param {Array[]} [cachedData=null]
 * @returns {Array<Object>}
 */
function getAllFamilies(filterFn = null, includeHierarchy = false, cachedData = null) {
    const rows = getValidatedFamilyRows(filterFn, cachedData);
    return rows.map(row => rowToFamilyObject(row, includeHierarchy));
}
