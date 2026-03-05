/**
 * @file src/core/config.js (FINAL - WITH ELIGIBILITY CHECKBOXES)
 * @description Complete configuration with eligibility tracking
 */

const CONFIG = {
    // 📋 Noms des feuilles
    SHEETS: {
        GOOGLE_FORM: 'Famille - Admin',
        FORM_FR: 'Familles – FR',
        FORM_AR: 'Familles – AR',
        FORM_EN: 'Familles – EN',
        FAMILLE: 'Famille',
        FORM_UPDATE: 'Mise à Jour Famille'
    },

    // 🌍 Langues supportées (FULL NAMES)
    LANGUAGES: {
        FR: 'Français',
        AR: 'Arabe',
        EN: 'Anglais'
    },

    // 📧 Configuration des emails de vérification
    EMAIL_VERIFICATION: {
        SUBJECT: {
            'Français': '🔔 Mise à jour de vos informations',
            'Arabe': '🔔 تحديث معلوماتك',
            'Anglais': '🔔 Update Your Information'
        },
        FROM_NAME: 'Gestion des Familles'
    },

    // ⏱️ Configuration du cache (en secondes)
    CACHE: {
        SHORT: 300,
        MEDIUM: 1800,
        LONG: 3600,
        VERY_LONG: 21600
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
        AIDES_ETAT: 'aides_etat',
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

    // 🌍 Configuration API géographique v5.0
    GEO_API: {
        VERSION: '5.0',
        MAX_DISTANCE: 50
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
    SE_DEPLACE: 10,
    CIRCONSTANCES: 11,
    RESSENTIT: 12,
    SPECIFICITES: 13,
    CRITICITE: 14,
    LANGUE: 15,
    COMMENTAIRE: 16
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
    SE_DEPLACE: 11,
    CIRCONSTANCES: 12,
    RESSENTIT: 13,
    SPECIFICITES: 14,
    CRITICITE: 15,
    LANGUE: 16,
    COMMENTAIRE: 17
};

// 🗂️ Indices de colonnes pour Google Form (0-based) - ADMIN FORM
const GOOGLE_FORM_COLUMNS = {
    TIMESTAMP: 0,
    DATE_SAISIE: 1,
    NOM: 2,
    PRENOM: 3,
    TELEPHONE: 4,
    TELEPHONE_BIS: 5,
    EMAIL: 6,
    ADRESSE: 7,
    CODE_POSTAL: 8,
    VILLE: 9,
    SE_DEPLACE: 10,
    NOMBRE_ADULTE: 11,
    NOMBRE_ENFANT: 12,
    CRITICITE: 13,
    CIRCONSTANCES: 14,
    RESSENTIT: 15,
    SPECIFICITES: 16,
    ELIGIBILITY: 17 // NEW: "Cette famille est éligible pour ?"
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
    'رقم هاتف آخر يمكننا التواصل معك من خلاله (اختياري)': 'phoneBis',
    'Another phone number where we can reach you (optional)': 'phoneBis',
    'Adresse': 'address',
    'العنوان': 'address',
    'Address': 'address',
    'Code postale': 'postalCode',
    'الرمز البريدي': 'postalCode',
    'Postal Code': 'postalCode',
    'Ville': 'city',
    'المدينة': 'city',
    'City': 'city',
    'Pouvez-vous vous déplacer pour récupérer votre colis alimentaire si aucun bénévole n\'est disponible pour vous le livrer ?': 'seDeplace',
    'هل تستطيعون الانتقال لاستلام الطرد الغذائي إذا لم يتوفر أي متطوّع لإيصاله إليكم؟': 'seDeplace',
    'Are you able to travel to pick up your food package if no volunteer is available to deliver it to you?': 'seDeplace',
    'La famille peut se déplacer pour venir récupérer le colis alimentaire': 'seDeplace',
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
    'Attestation de la CAF (paiement et/ou quotient familial)': 'aidesEtatDoc',
    'شهادة من CAF (الدفع و/أو الحصّة العائلية)': 'aidesEtatDoc',
    'CAF Certificate (Payment and/or Family Quotient)': 'aidesEtatDoc',
    'Aide médicale de l\'État (AME)': 'aidesEtatDoc',
    'المساعدة الطبية للدولة (AME)': 'aidesEtatDoc',
    'State Medical Aid (AME)': 'aidesEtatDoc',
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
    AIDES_ETAT: 14,
    CIRCONSTANCES: 15,
    RESSENTIT: 16,
    SPECIFICITES: 17,
    CRITICITE: 18,
    LANGUE: 19,
    ETAT_DOSSIER: 20,
    COMMENTAIRE_DOSSIER: 21
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
        geoApiKey: getProperty('GEO_API_KEY'),
        adminEmail: getProperty('ADMIN_EMAIL'),
        formUrlFr: getProperty('FORM_URL_FR'),
        formUrlAr: getProperty('FORM_URL_AR'),
        formUrlEn: getProperty('FORM_URL_EN'),
        webAppUrl: getProperty('WEB_APP_URL'),
        familleApiKey: getProperty('FAMILLE_API_KEY')
    };
}

/**
 * 🆔 Générer un ID de famille auto-incrémenté (numérique)
 */
function generateFamilyId() {
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
    if (!sheet) {
        logError('❌ Impossible de trouver la feuille Famille pour générer l\'ID');
        return Date.now();
    }

    const data = sheet.getDataRange().getValues();
    let maxId = 0;

    for (let i = 1; i < data.length; i++) {
        const id = data[i][OUTPUT_COLUMNS.ID];
        if (id) {
            const num = parseInt(id);
            if (!isNaN(num) && num > maxId) {
                maxId = num;
            }
        }
    }

    const newId = maxId + 1;
    logInfo(`🆔 Nouvel ID généré: ${newId} (précédent max: ${maxId})`);
    return newId;
}

/**
 * 🌍 Detect language from sheet name (returns full name)
 */
function detectLanguageFromSheet(sheetName) {
    if (sheetName === CONFIG.SHEETS.FORM_FR) return CONFIG.LANGUAGES.FR;
    if (sheetName === CONFIG.SHEETS.FORM_AR) return CONFIG.LANGUAGES.AR;
    if (sheetName === CONFIG.SHEETS.FORM_EN) return CONFIG.LANGUAGES.EN;
    return CONFIG.LANGUAGES.FR; // Default
}

/**
 * 🌍 Get language code from full name (for backward compatibility)
 */
function getLanguageCode(languageName) {
    const mapping = {
        'Français': 'fr',
        'Arabe': 'ar',
        'Anglais': 'en'
    };
    return mapping[languageName] || 'fr';
}

/**
 * Parse boolean from form answer (Oui/Non, Yes/No, نعم/لا)
 */
function parseSeDeplace(value) {
    if (typeof value === 'boolean') {
        return value;
    }

    const strValue = String(value).trim().toLowerCase();

    // French
    if (strValue === 'oui') return true;
    if (strValue === 'non') return false;

    // English
    if (strValue === 'yes') return true;
    if (strValue === 'no') return false;

    // Arabic
    if (strValue === 'نعم') return true;
    if (strValue === 'لا') return false;

    // Default to false if unrecognized
    return false;
}

/**
 * NEW: Parse eligibility checkboxes from Admin form
 * Input: "Sadaqa, Zakat El Fitr" or "Sadaqa" or "Zakat El Fitr" or empty
 * Output: { zakatElFitr: boolean, sadaqa: boolean }
 */
function parseEligibility(value) {
    const result = {
        zakatElFitr: false,
        sadaqa: false
    };

    if (!value) {
        return result;
    }

    const strValue = String(value).toLowerCase().trim();

    // Check for Sadaqa
    if (strValue.includes('sadaqa') || strValue.includes('sadaka')) {
        result.sadaqa = true;
    }

    // Check for Zakat El Fitr
    if (strValue.includes('zakat') || strValue.includes('fitr')) {
        result.zakatElFitr = true;
    }

    return result;
}