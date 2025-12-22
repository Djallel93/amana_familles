/**
 * @file src/services/familyDataService.js (MIS À JOUR v2.0)
 * @description Fonctions canoniques de conversion et accès données famille
 * CHANGEMENT: Support cachedData optionnel pour éviter double fetch
 */

/**
 * Convertit une ligne de feuille en objet famille (VERSION CANONIQUE)
 * @param {Array} row - Données de ligne
 * @param {boolean} [includeHierarchy=false] - Inclure hiérarchie localisation
 * @returns {Object} Objet famille
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
 * Construit un tableau de ligne pour insertion dans la feuille
 * @param {Object} formData - Données du formulaire
 * @param {Object} options - Options (status, comment, familyId, etc.)
 * @returns {Array} Tableau prêt pour la feuille
 */
function buildFamilyRow(formData, options = {}) {
    const {
        status = CONFIG.STATUS.IN_PROGRESS,
        comment = '',
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

    const row = Array(22).fill('');
    row[OUTPUT_COLUMNS.ID] = familyId;
    row[OUTPUT_COLUMNS.NOM] = formData.lastName || '';
    row[OUTPUT_COLUMNS.PRENOM] = formData.firstName || '';
    row[OUTPUT_COLUMNS.ZAKAT_EL_FITR] = zakatElFitr;
    row[OUTPUT_COLUMNS.SADAQA] = sadaqa;
    row[OUTPUT_COLUMNS.NOMBRE_ADULTE] = parseInt(formData.nombreAdulte) || 0;
    row[OUTPUT_COLUMNS.NOMBRE_ENFANT] = parseInt(formData.nombreEnfant) || 0;
    row[OUTPUT_COLUMNS.ADRESSE] = formatAddressFromComponents(
        formData.address,
        formData.postalCode,
        formData.city
    );
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
    row[OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] = comment;

    return row;
}

/**
 * Récupère une seule famille par ID
 * @param {string|number} familyId - ID famille
 * @param {boolean} [includeHierarchy=false] - Inclure hiérarchie localisation
 * @returns {Object|null} Objet famille ou null
 */
function getFamilyById(familyId, includeHierarchy = false) {
    const result = findFamilyRowById(familyId);

    if (!result) {
        return null;
    }

    const row = result.data;

    if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] !== CONFIG.STATUS.VALIDATED) {
        return null;
    }

    return rowToFamilyObject(row, includeHierarchy);
}

/**
 * Récupère toutes les familles avec filtre optionnel
 * OPTIMISÉ: Accepte cachedData pour éviter double fetch
 * @param {Function} [filterFn] - Fonction de filtrage optionnelle (row) => boolean
 * @param {boolean} [includeHierarchy=false] - Inclure hiérarchie localisation
 * @param {Array[]} [cachedData=null] - Données déjà récupérées (optimisation)
 * @returns {Array<Object>} Tableau d'objets famille
 */
function getAllFamilies(filterFn = null, includeHierarchy = false, cachedData = null) {
    const rows = getValidatedFamilyRows(filterFn, cachedData);

    return rows.map(row => rowToFamilyObject(row, includeHierarchy));
}