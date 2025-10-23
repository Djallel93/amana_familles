/**
 * @file src/core/config.js
 * @description Central configuration for the delivery management system
 * All sheet names, column mappings, and constants in one place
 */

const CONFIG = {
    // Sheet names
    SHEETS: {
        FAMILLE_CLEANED: 'Famille',
        FORM_FR: 'Familles – FR',
        FORM_AR: 'Familles – AR',
        FORM_EN: 'Familles – EN'
    },

    // Cache configuration (in seconds)
    CACHE: {
        SHORT: 300,      // 5 minutes
        MEDIUM: 1800,    // 30 minutes
        LONG: 3600,      // 1 hour
        VERY_LONG: 21600 // 6 hours
    },

    // Status values
    STATUS: {
        REJECTED: 'Rejeté',
        RECEIVED: 'Recu',
        IN_PROGRESS: 'En cours',
        PENDING: 'En attente',
        VALIDATED: 'Validé',
        ARCHIVED: 'Archivé'
    },

    // Document types
    DOC_TYPES: {
        IDENTITY: 'identity',
        CAF: 'CAF',
        RESOURCE: 'resource'
    },

    // API Configuration
    GEO_API: {
        MAX_DISTANCE: 50 // km
    }
};

// Multilingual column mapping - maps form questions to standardized field names
const COLUMN_MAP = {
    // Last Name
    'Nom de famille': 'lastName',
    'Nom de famille ': 'lastName',
    'اللقب': 'lastName',
    'Last Name': 'lastName',

    // First Name
    'Prénom de la personne à contacter': 'firstName',
    'Prénom de la personne à contacter ': 'firstName',
    'إسم الشخص الذي يمكن التواصل معه': 'firstName',
    'إسم الشخص الذي يمكن التواصل معه ': 'firstName',
    'First Name of the Contact Person': 'firstName',

    // Phone
    'Numéro de téléphone de la personne à contacter': 'phone',
    'رقم هاتف الشخص الذي يمكن التواصل معه': 'phone',
    'Phone Number of the Contact Person': 'phone',

    // Phone Bis
    'Autre numéro où nous pourrons vous joindre (optionnel)': 'phoneBis',
    'رقم هاتف آخر يمكننا التواصل معك من خلاله': 'phoneBis',
    'Another phone number where we can reach you': 'phoneBis',

    // Email
    'Email address': 'email',

    // Address
    'Adresse': 'address',
    'Adresse ': 'address',
    'العنوان': 'address',
    'العنوان ': 'address',
    'Address': 'address',
    'Address ': 'address',

    // Postal Code
    'Code postale': 'postalCode',
    'الرمز البريدي': 'postalCode',
    'Postal Code': 'postalCode',

    // City
    'Ville': 'city',
    'المدينة': 'city',
    'City': 'city',

    // Number of Adults
    'Combien d\'adultes vivent actuellement dans votre foyer ?': 'nombreAdulte',
    'Combien d\'adultes vivent actuellement dans votre foyer ? ': 'nombreAdulte',
    'كم عدد البالغين الذين يعيشون حاليًا في منزلك؟': 'nombreAdulte',
    'How many adults currently live in your household?': 'nombreAdulte',

    // Number of Children
    'Combien d\'enfants vivent actuellement dans votre foyer ?': 'nombreEnfant',
    'Combien d\'enfants vivent actuellement dans votre foyer ? ': 'nombreEnfant',
    'كم عدد الأطفال الذين يعيشون حاليًا في منزلك؟': 'nombreEnfant',
    'How many children currently live in your household?': 'nombreEnfant',

    // Hosted
    'Êtes-vous actuellement hébergé(e) par une personne ou une organisation ?': 'hosted',
    'Êtes-vous actuellement hébergé(e) par une personne ou une organisation ? ': 'hosted',
    'هل تتم استضافتك حاليًا من قبل شخص أو  منظمة ؟': 'hosted',
    'Are you currently being hosted by a person or an organization?': 'hosted',
    'Are you currently being hosted by a person or an organization? ': 'hosted',

    // Hosted By
    'Par qui êtes-vous hébergé(e) ?': 'hostedBy',
    'Par qui êtes-vous hébergé(e) ? ': 'hostedBy',
    'من يتكفّل بإقامتك؟': 'hostedBy',
    'من يتكفّل بإقامتك؟ ': 'hostedBy',
    'Who is hosting you?': 'hostedBy',

    // Current Situation
    'Décrivez brièvement votre situation actuelle': 'circonstances',
    'Décrivez brièvement votre situation actuelle ': 'circonstances',
    'صف وضعك الحالي باختصار': 'circonstances',
    'Briefly describe your current situation': 'circonstances',

    // ID Type
    'Type de pièce d\'identité': 'idType',
    'Type de pièce d\'identité ': 'idType',
    'نوع وثيقة الهوية': 'idType',
    'Type of Identification Document': 'idType',

    // Identity/Residence Proof
    'Justificatif d\'identité ou de résidence': 'identityDoc',
    'Justificatif d\'identité ou de résidence ': 'identityDoc',
    'إثبات الهوية أو الإقامة': 'identityDoc',
    'إثبات الهوية أو الإقامة ': 'identityDoc',
    'Proof of Identity or Residence': 'identityDoc',

    // CAF Certificate
    'Attestation de la CAF (paiement et/ou quotient familial)': 'cafDoc',
    'شهادة من CAF (الدفع و/أو الحصّة العائلية)': 'cafDoc',
    'CAF Certificate (Payment and/or Family Quotient)': 'cafDoc',

    // CAF Certificate Optional
    'Attestation de la CAF (paiement et/ou quotient familial) - (optionnel)': 'cafDocOptional',
    'شهادة من CAF (الدفع و/أو الحصّة العائلية) - (اختياري)': 'cafDocOptional',
    'CAF Certificate (optional)': 'cafDocOptional',

    // Working Status
    'Travaillez-vous actuellement, vous ou votre conjoint(e) ?': 'working',
    'Travaillez-vous actuellement, vous ou votre conjoint(e) ? ': 'working',
    'هل تعمل حالياً، أنت أو زوجك/زوجتك؟': 'working',
    'Are you or your spouse currently working?': 'working',

    // Work Days
    'Combien de jours par semaine travaillez-vous ?': 'workDays',
    'Combien de jours par semaine travaillez-vous ? ': 'workDays',
    'كم يوماً في الأسبوع تعمل؟': 'workDays',
    'How many days per week do you work?': 'workDays',

    // Work Sector
    'Dans quel secteur travaillez-vous ?': 'workSector',
    'Dans quel secteur travaillez-vous ? ': 'workSector',
    'في أي قطاع تعمل؟': 'workSector',
    'Which sector do you work in?': 'workSector',

    // Other Aid
    'Percevez-vous actuellement des aides d\'autres organismes ?': 'otherAid',
    'Percevez-vous actuellement des aides d\'autres organismes ? ': 'otherAid',
    'هل تتلقون حالياً مساعدات من منظمات أخرى ؟': 'otherAid',
    'Are you currently receiving support from other organizations?': 'otherAid',

    // Resource Proof
    'Veuillez soumettre tous justificatif de ressources': 'resourceDoc',
    'يرجى تقديم جميع إثباتات الموارد': 'resourceDoc',
    'Please submit any proof of income or financial support': 'resourceDoc',

    // Timestamp
    'Timestamp': 'timestamp'
};

// Output sheet column indices (0-based)
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
    ETAT_DOSSIER: 18,
    COMMENTAIRE_DOSSIER: 19
};

/**
 * Get script property value with caching
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
 * Get all required script properties
 */
function getScriptConfig() {
    return {
        gestionFamillesFolderId: getProperty('GESTION_FAMILLES_FOLDER_ID'),
        spreadsheetId: getProperty('SPREADSHEET_ID'),
        geoApiUrl: getProperty('GEO_API_URL'),
    };
}