/**
 * @file src/core/config.js (REFACTORED)
 * @description 🎯 Configuration centrale avec génération d'ID auto-incrémentée
 */

const CONFIG = {
    // 📋 Noms des feuilles
    SHEETS: {
        FAMILLE: 'Famille',
        FORM_FR: 'Familles – FR',
        FORM_AR: 'Familles – AR',
        FORM_EN: 'Familles – EN',
        FORM_UPDATE: 'Mise à Jour Famille'
    },

    // ⏱️ Configuration du cache (en secondes)
    CACHE: {
        SHORT: 300,      // 5 minutes
        MEDIUM: 1800,    // 30 minutes
        LONG: 3600,      // 1 heure
        VERY_LONG: 21600 // 6 heures
    },

    // 📊 Valeurs de statut
    STATUS: {
        REJECTED: 'Rejeté',
        RECEIVED: 'Recu',
        IN_PROGRESS: 'En cours',
        PENDING: 'En attente',
        VALIDATED: 'Validé',
        ARCHIVED: 'Archivé'
    },

    BULK_STATUS: {
        PENDING: 'En attente',
        PROCESSING: 'En cours',
        SUCCESS: 'Succès',
        ERROR: 'Erreur',
        SKIPPED: 'Ignoré'
    },

    // 📄 Types de documents
    DOC_TYPES: {
        IDENTITY: 'identity',
        CAF: 'CAF',
        RESOURCE: 'resource'
    },

    // ⚠️ Validation de criticité
    CRITICITE: {
        MIN: 0,
        MAX: 5
    },

    OAUTH_CONFIG: {
        REDIRECT_URI: 'https://script.google.com/macros/d/1f5BqHS_e2pJeWTck3S_5WFxQ1V-i6m8HFlKR9zGmq6VgxGgLfrjNjwOW/usercallback',
        SCOPES: 'https://www.googleapis.com/auth/forms https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/contacts',
        FORMS_API_BASE_URL: 'https://forms.googleapis.com/v1'
    },

    // 🌍 Configuration API géographique
    GEO_API: {
        MAX_DISTANCE: 50 // km
    },

    // 🚫 Phrases de refus de consentement
    REFUSAL_PHRASES: [
        'Je refuse que mes données personnelles soient collectées et traitées',
        'أرفض جمع ومعالجة بياناتي الشخصية',
        'I refuse to have my personal data collected and processed'
    ]
};

const BULK_IMPORT_SHEET_NAME = 'Bulk Import';
const BULK_UPDATE_SHEET_NAME = 'Bulk Update';

// 🗂️ Indices de colonnes pour Bulk Import (0-based)
const BULK_COLUMNS = {
    NOM: 0,
    PRENOM: 1,
    NOMBRE_ADULTE: 2,
    NOMBRE_ENFANT: 3,
    ADRESSE: 4,
    CODE_POSTAL: 5,
    VILLE: 6,
    TELEPHONE: 7,
    TELEPHONE_BIS: 8,
    EMAIL: 9,
    CIRCONSTANCES: 10,
    RESSENTIT: 11,
    SPECIFICITES: 12,
    CRITICITE: 13,
    COMMENTAIRE: 14 // ⚠️ Removed STATUT
};

// 🗂️ Indices de colonnes pour Bulk Update (0-based)
const BULK_UPDATE_COLUMNS = {
    ID: 0,
    NOM: 1,
    PRENOM: 2,
    NOMBRE_ADULTE: 3,
    NOMBRE_ENFANT: 4,
    ADRESSE: 5,
    CODE_POSTAL: 6,
    VILLE: 7,
    TELEPHONE: 8,
    TELEPHONE_BIS: 9,
    EMAIL: 10,
    CIRCONSTANCES: 11,
    RESSENTIT: 12,
    SPECIFICITES: 13,
    CRITICITE: 14,
    COMMENTAIRE: 15 // ⚠️ Removed STATUT
};

// 🌐 Mappage multilingue des colonnes
const COLUMN_MAP = {
    'Timestamp': 'timestamp',
    'Email address': 'email',
    'البريد الإلكتروني': 'email',
    'Personal Data Protection': 'personalDataProtection',
    'حماية البيانات الشخصية': 'personalDataProtection',
    'Protection des données personnelles': 'personalDataProtection',
    'ID Famille': 'familyId',
    'Family ID': 'familyId',
    'معرّف العائلة': 'familyId',
    'Identifiant Famille': 'familyId',
    'ID de la famille': 'familyId',
    'Nom de famille': 'lastName',
    'اللقب': 'lastName',
    'Last Name': 'lastName',
    'Prénom de la personne à contacter': 'firstName',
    'إسم الشخص الذي يمكن التواصل معه': 'firstName',
    'First Name of the Contact Person': 'firstName',
    'Numéro de téléphone de la personne à contacter': 'phone',
    'رقم هاتف الشخص الذي يمكن التواصل معه': 'phone',
    'Phone Number of the Contact Person': 'phone',
    'Autre numéro où nous pourrons vous joindre (optionnel)': 'phoneBis',
    'رقم هاتف آخر يمكننا التواصل معك من خلاله': 'phoneBis',
    'Another phone number where we can reach you': 'phoneBis',
    'Adresse': 'address',
    'العنوان': 'address',
    'Address': 'address',
    'Code postale': 'postalCode',
    'الرمز البريدي': 'postalCode',
    'Postal Code': 'postalCode',
    'Ville': 'city',
    'المدينة': 'city',
    'City': 'city',
    'Combien d\'adultes vivent actuellement dans votre foyer ?': 'nombreAdulte',
    'كم عدد البالغين الذين يعيشون حاليًا في منزلك؟': 'nombreAdulte',
    'How many adults currently live in your household?': 'nombreAdulte',
    'Combien d\'enfants vivent actuellement dans votre foyer ?': 'nombreEnfant',
    'كم عدد الأطفال الذين يعيشون حاليًا في منزلك؟': 'nombreEnfant',
    'How many children currently live in your household?': 'nombreEnfant',
    'Êtes-vous actuellement hébergé(e) par une personne ou une organisation ?': 'hosted',
    'هل تتم استضافتك حاليًا من قبل شخص أو  منظمة ؟': 'hosted',
    'Are you currently being hosted by a person or an organization?': 'hosted',
    'Par qui êtes-vous hébergé(e) ?': 'hostedBy',
    'من يتكفّل بإقامتك؟': 'hostedBy',
    'Who is hosting you?': 'hostedBy',
    'Décrivez brièvement votre situation actuelle': 'circonstances',
    'صف وضعك الحالي باختصار': 'circonstances',
    'Briefly describe your current situation': 'circonstances',
    'Ressentit': 'ressentit',
    'Spécificités': 'specificites',
    'Criticité (0-5)': 'criticite',
    'Type de pièce d\'identité': 'idType',
    'نوع وثيقة الهوية': 'idType',
    'Type of Identification Document': 'idType',
    'Justificatif d\'identité ou de résidence': 'identityDoc',
    'إثبات الهوية أو الإقامة': 'identityDoc',
    'Proof of Identity or Residence': 'identityDoc',
    'Attestation de la CAF (paiement et/ou quotient familial)': 'cafDoc',
    'شهادة من CAF (الدفع و/أو الحصّة العائلية)': 'cafDoc',
    'CAF Certificate (Payment and/or Family Quotient)': 'cafDoc',
    'Attestation de la CAF (paiement et/ou quotient familial) - (optionnel)': 'cafDocOptional',
    'شهادة من CAF (الدفع و/أو الحصّة العائلية) - (اختياري)': 'cafDocOptional',
    'CAF Certificate (optional)': 'cafDocOptional',
    'Travaillez-vous actuellement, vous ou votre conjoint(e) ?': 'working',
    'هل تعمل حالياً، أنت أو زوجك/زوجتك؟': 'working',
    'Are you or your spouse currently working?': 'working',
    'Combien de jours par semaine travaillez-vous ?': 'workDays',
    'كم يوماً في الأسبوع تعمل؟': 'workDays',
    'How many days per week do you work?': 'workDays',
    'Dans quel secteur travaillez-vous ?': 'workSector',
    'في أي قطاع تعمل؟': 'workSector',
    'Which sector do you work in?': 'workSector',
    'Percevez-vous actuellement des aides d\'autres organismes ?': 'otherAid',
    'هل تتلقون حالياً مساعدات من منظمات أخرى ؟': 'otherAid',
    'Are you currently receiving support from other organizations?': 'otherAid',
    'Veuillez soumettre tous justificatif de ressources': 'resourceDoc',
    'يرجى تقديم جميع إثباتات الموارد': 'resourceDoc',
    'Please submit any proof of income or financial support': 'resourceDoc'
};

// 🗂️ Indices de colonnes pour la feuille de sortie (0-based)
const OUTPUT_COLUMNS = {
    ID: 0,
    NOM: 1,
    PRENOM: 2,
    ZAKAT_EL_FITR: 3,
    SADAQA: 4,
    NOMBRE_ADULTE: 5,
    NOMBRE_ENFANT: 6,
    ADRESSE: 7,
    ID_QUARTIER: 8,
    SE_DEPLACE: 9,
    EMAIL: 10,
    TELEPHONE: 11,
    TELEPHONE_BIS: 12,
    IDENTITE: 13,
    CAF: 14,
    CIRCONSTANCES: 15,
    RESSENTIT: 16,
    SPECIFICITES: 17,
    CRITICITE: 18,
    ETAT_DOSSIER: 19,
    COMMENTAIRE_DOSSIER: 20
};

/**
 * 🔑 Récupérer une propriété de script avec mise en cache
 */
function getProperty(key) {
    const cache = CacheService.getScriptCache();
    let value = cache.get(`prop_${key}`);

    if (!value) {
        value = PropertiesService.getScriptProperties().getProperty(key);
        if (value) {
            cache.put(`prop_${key}`, value, CONFIG.CACHE.VERY_LONG);
        }
    }

    return value;
}

/**
 * ⚙️ Récupérer toutes les propriétés de script requises
 */
function getScriptConfig() {
    return {
        gestionFamillesFolderId: getProperty('GESTION_FAMILLES_FOLDER_ID'),
        spreadsheetId: getProperty('SPREADSHEET_ID'),
        geoApiUrl: getProperty('GEO_API_URL'),
        referenceLatitude: parseFloat(getProperty('REFERENCE_LATITUDE')) || null,
        referenceLongitude: parseFloat(getProperty('REFERENCE_LONGITUDE')) || null,
        adminEmail: getProperty('ADMIN_EMAIL') // ✨ NEW: Email de l'administrateur
    };
}

/**
 * 🆔 Générer un ID de famille auto-incrémenté (numérique)
 */
function generateFamilyId() {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) {
        logError('❌ Impossible de trouver la feuille Famille pour générer l\'ID');
        return Date.now(); // Fallback: timestamp
    }

    const data = sheet.getDataRange().getValues();
    let maxId = 0;

    // 🔍 Parcourir toutes les lignes pour trouver le dernier ID
    for (let i = 1; i < data.length; i++) {
        const id = data[i][OUTPUT_COLUMNS.ID];
        if (id) {
            // Convertir en nombre (gère les formats string et number)
            const num = parseInt(id);
            if (!isNaN(num) && num > maxId) {
                maxId = num;
            }
        }
    }

    // ➕ Incrémenter et retourner le nouvel ID (numérique)
    const newId = maxId + 1;
    logInfo(`🆔 Nouvel ID généré: ${newId} (précédent max: ${maxId})`);
    return newId;
}