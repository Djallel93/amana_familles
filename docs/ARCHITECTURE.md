# 🏗️ Architecture du système

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture globale](#architecture-globale)
- [Flux de données](#flux-de-données)
- [Structure du code](#structure-du-code)
- [Modèle de données](#modèle-de-données)
- [Services et intégrations](#services-et-intégrations)
- [Système de cache](#système-de-cache)
- [Gestion des événements](#gestion-des-événements)
- [Sécurité](#sécurité)
- [Performance et scalabilité](#performance-et-scalabilité)

---

## 🎯 Vue d'ensemble

Le système de gestion des familles est une application serverless construite entièrement sur Google Apps Script, intégrant plusieurs services Google Cloud (Sheets, Drive, Contacts, Forms) et une API externe de géocodage.

### Principes de conception

1. **Serverless** : Pas de serveur à maintenir, hébergé par Google
2. **Event-driven** : Réaction automatique aux événements (formulaires, éditions)
3. **Stateless API** : API REST sans état avec cache
4. **Single source of truth** : Google Sheets comme base de données centrale
5. **Modularité** : Code organisé en modules réutilisables

### Technologies utilisées

| Technologie | Usage | Version |
|-------------|-------|---------|
| Google Apps Script | Runtime principal | V8 |
| Google Sheets | Base de données | Sheets API v4 |
| Google Drive | Stockage documents | Drive API v3 |
| Google Contacts | CRM | People API v1 |
| Google Forms | Collecte données | Forms API |
| API Géocodage | Validation adresses | Custom |

---

## 🌐 Architecture globale

### Schéma d'architecture

```txt
┌─────────────────────────────────────────────────────────────────┐
│                        COUCHE PRÉSENTATION                       │
├─────────────────────────────────────────────────────────────────┤
│  Google Forms (FR/AR/EN)  │  UI Manuelle  │  API REST (Public) │
└────────────┬────────────────────┬──────────────────┬────────────┘
             │                    │                  │
             ▼                    ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      COUCHE ÉVÉNEMENTS                           │
├─────────────────────────────────────────────────────────────────┤
│  onFormSubmit Trigger  │  onEdit Trigger  │  doGet Handler     │
└────────────┬────────────────────┬──────────────────┬────────────┘
             │                    │                  │
             ▼                    ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      COUCHE HANDLERS                             │
├─────────────────────────────────────────────────────────────────┤
│  formHandler.js  │  editHandler.js  │  familyApiHandler.js     │
└────────────┬────────────────────┬──────────────────┬────────────┘
             │                    │                  │
             └────────────────────┼──────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      COUCHE SERVICES                             │
├─────────────────────────────────────────────────────────────────┤
│  driveService  │  contactService  │  geoService               │
└────────────┬────────────────────┬──────────────────┬────────────┘
             │                    │                  │
             └────────────────────┼──────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      COUCHE DONNÉES                              │
├─────────────────────────────────────────────────────────────────┤
│  Google Sheets  │  Google Drive  │  Google Contacts  │  Cache  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICES EXTERNES                           │
├─────────────────────────────────────────────────────────────────┤
│                      API Géocodage                               │
└─────────────────────────────────────────────────────────────────┘
```

### Composants principaux

#### 1. Couche présentation

- **Google Forms** : 3 formulaires multilingues (FR, AR, EN)
- **UI Manuelle** : Dialog HTML pour inscription directe
- **API REST** : Endpoints publics pour intégration externe

#### 2. Couche événements

- **onFormSubmit** : Trigger déclenché à chaque soumission
- **onEdit** : Trigger déclenché à chaque modification manuelle
- **doGet** : Handler HTTP pour les requêtes API

#### 3. Couche handlers

- **formHandler** : Traitement des soumissions de formulaires
- **editHandler** : Gestion des éditions manuelles (validation)
- **familyApiHandler** : Gestion des requêtes API REST

#### 4. Couche services

- **driveService** : Gestion des documents Drive
- **contactService** : Synchronisation Google Contacts
- **geoService** : Géocodage et recherche de quartiers

#### 5. Couche données

- **Sheets** : Base de données principale
- **Drive** : Stockage des documents
- **Contacts** : CRM intégré
- **Cache** : Cache en mémoire (ScriptCache)

---

## 🔄 Flux de données

### Flux 1 : Soumission de formulaire

```txt
┌──────────────┐
│ Utilisateur  │
│ remplit form │
└──────┬───────┘
       │ Soumet
       ▼
┌──────────────────┐
│  Google Forms    │
│  (FR/AR/EN)      │
└──────┬───────────┘
       │ Écrit dans
       ▼
┌──────────────────────────┐
│  Sheet "Familles - XX"   │
│  (réponses brutes)       │
└──────┬───────────────────┘
       │ Trigger onFormSubmit
       ▼
┌─────────────────────────────────────┐
│  handleFormSubmission()             │
│  1. Parse les réponses              │
│  2. Normalise les données           │
│  3. Mappe les colonnes              │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  validateRequiredFields()           │
│  Vérifie champs obligatoires        │
└──────┬──────────────────────────────┘
       │ Si invalide → Rejeté
       ▼
┌─────────────────────────────────────┐
│  validateAddressAndGetQuartier()    │
│  1. Géocode l'adresse               │
│  2. Trouve le quartier proche       │
└──────┬──────────────────────────────┘
       │ Si invalide → Rejeté
       ▼
┌─────────────────────────────────────┐
│  validateDocuments()                │
│  Vérifie existence des fichiers     │
└──────┬──────────────────────────────┘
       │ Si invalide → Rejeté
       ▼
┌─────────────────────────────────────┐
│  findDuplicateFamily()              │
│  Cherche doublon (tel + nom)        │
└──────┬──────────────────────────────┘
       │
       ├─ Si existe ──→ updateExistingFamily()
       │
       └─ Si nouveau ─→ writeToFamilySheet()
                        │
                        ▼
                ┌───────────────────┐
                │  Sheet "Famille"  │
                │  (données propres)│
                └───────────────────┘
```

### Flux 2 : Validation d'un dossier

```
┌──────────────┐
│ Administrateur│
│ change statut│
│ → "Validé"   │
└──────┬───────┘
       │ onEdit
       ▼
┌─────────────────────────┐
│  handleEdit()           │
│  Détecte changement col │
│  "Etat_Dossier"         │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  processValidatedFamily()           │
│  1. Lit les données de la ligne     │
│  2. Extrait les IDs de documents    │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  organizeDocuments()                │
│  1. Crée dossier famille            │
│  2. Déplace fichiers                │
│  3. Renomme (identity_1, CAF_1)     │
│  4. Met à jour liens                │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  syncFamilyContact()                │
│  1. Cherche contact existant        │
│  2. Crée/met à jour contact         │
│  3. Ajoute ID dans notes            │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Mise à jour Sheet                  │
│  - Liens documents organisés        │
│  - Commentaire avec date            │
└─────────────────────────────────────┘
```

### Flux 3 : Requête API

```txt
┌──────────────┐
│  Client HTTP │
│  (App/Web)   │
└──────┬───────┘
       │ GET /exec?action=allfamilies
       ▼
┌─────────────────────────┐
│  doGet(e)               │
│  Parse paramètres       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Vérification cache                 │
│  CacheService.getScriptCache()      │
└──────┬──────────────────────────────┘
       │
       ├─ Si en cache ──→ Retourne immédiatement
       │
       └─ Si absent ───→ Continue
                         │
                         ▼
                ┌────────────────────┐
                │  getAllFamilies()  │
                │  1. Lit Sheet      │
                │  2. Filtre validés │
                │  3. Mappe objets   │
                └────────┬───────────┘
                         │
                         ▼
                ┌────────────────────┐
                │  Mise en cache     │
                │  cache.put(...)    │
                └────────┬───────────┘
                         │
                         ▼
                ┌────────────────────┐
                │  jsonResponse()    │
                │  Retourne JSON     │
                └────────────────────┘
```

---

## 📂 Structure du code

### Organisation des fichiers

```txt
Google_app_script/
│
├── appsscript.json              # Manifeste du projet
│
├── src/
│   │
│   ├── core/                    # Code de base
│   │   ├── config.js            # Configuration centrale
│   │   │   ├── CONFIG           # Constantes globales
│   │   │   ├── COLUMN_MAP       # Mapping multilingue
│   │   │   ├── OUTPUT_COLUMNS   # Indices colonnes
│   │   │   ├── getProperty()    # Lecture propriétés
│   │   │   └── getScriptConfig()# Config complète
│   │   │
│   │   └── utils.js             # Utilitaires
│   │       ├── normalizePhone() # Normalisation téléphone
│   │       ├── isValidEmail()   # Validation email
│   │       ├── parseFormResponse()
│   │       ├── generateFamilyId()
│   │       ├── validateRequiredFields()
│   │       ├── extractFileIds()
│   │       ├── findDuplicateFamily()
│   │       └── retryOperation()
│   │
│   ├── handlers/                # Gestionnaires d'événements
│   │   ├── formHandler.js       # Traitement formulaires
│   │   │   ├── handleFormSubmission()
│   │   │   ├── processFormSubmission()
│   │   │   ├── writeToFamilySheet()
│   │   │   ├── updateExistingFamily()
│   │   │   └── notifyAdmin()
│   │   │
│   │   └── editHandler.js       # Traitement éditions
│   │       ├── handleEdit()
│   │       └── processValidatedFamily()
│   │
│   ├── services/                # Services externes
│   │   ├── driveService.js      # Gestion Drive
│   │   │   ├── getOrCreateFamilyFolder()
│   │   │   ├── organizeDocuments()
│   │   │   ├── moveAndRenameFile()
│   │   │   ├── validateDocuments()
│   │   │   └── formatDocumentLinks()
│   │   │
│   │   ├── contactService.js    # Synchronisation Contacts
│   │   │   ├── syncFamilyContact()
│   │   │   ├── findContactByFamilyId()
│   │   │   ├── createContact()
│   │   │   └── updateContact()
│   │   │
│   │   └── geoService.js        # Géocodage
│   │       ├── callGeoApi()
│   │       ├── geocodeAddress()
│   │       ├── findQuartierByCoordinates()
│   │       └── validateAddressAndGetQuartier()
│   │
│   ├── api/                     # API REST
│   │   └── familyApiHandler.js  # Endpoints
│   │       ├── doGet()
│   │       ├── getAllFamilies()
│   │       ├── getFamilyById()
│   │       ├── getFamilyAddressById()
│   │       ├── getFamiliesForZakatFitr()
│   │       ├── getFamiliesForSadaka()
│   │       ├── getFamiliesByQuartier()
│   │       ├── getFamiliesSeDeplace()
│   │       └── jsonResponse()
│   │
│   └── ui/                      # Interface utilisateur
│       ├── menu.js              # Menu personnalisé
│       │   ├── onOpen()
│       │   ├── showManualEntryDialog()
│       │   ├── clearAllCaches()
│       │   ├── showStatistics()
│       │   └── calculateStatistics()
│       │
│       └── helpers.js           # Helpers UI
│           ├── processManualEntry()
│           └── updateManualEntryWithFormData()
│
├── views/                       # Templates HTML
│   └── dialogs/
│       └── manualEntry.html     # Formulaire inscription
│
├── assets/                      # Ressources statiques
│   └── css/
│       └── styles.html          # Styles CSS
│
└── tests/                       # Tests
    └── tests.js                 # Tests unitaires
```

### Dépendances entre modules

```
┌─────────────────┐
│   config.js     │ ← Base de tout
└────────┬────────┘
         │
    ┌────┴────────────────────────┐
    │                             │
    ▼                             ▼
┌─────────┐              ┌──────────────┐
│utils.js │              │ All handlers │
└────┬────┘              └──────┬───────┘
     │                          │
     └──────────┬───────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
┌────────┐ ┌─────────┐ ┌──────────┐
│ drive  │ │contact  │ │   geo    │
│Service │ │Service  │ │ Service  │
└────────┘ └─────────┘ └──────────┘
```

**Règles de dépendances :**

- `config.js` : Aucune dépendance
- `utils.js` : Dépend uniquement de `config.js`
- `handlers/` : Dépendent de `utils.js` et `services/`
- `services/` : Dépendent de `utils.js`
- `api/` : Dépend de `utils.js` et `services/`
- `ui/` : Dépend de tout

---

## 💾 Modèle de données

### Schéma de la Sheet "Famille"

```sql
-- Représentation SQL équivalente

CREATE TABLE Famille (
    id VARCHAR(50) PRIMARY KEY,           -- FAM_timestamp_random
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    zakat_el_fitr BOOLEAN DEFAULT FALSE,
    sadaqa BOOLEAN DEFAULT FALSE,
    nombre_adulte INTEGER NOT NULL,
    nombre_enfant INTEGER NOT NULL,
    adresse TEXT NOT NULL,
    id_quartier VARCHAR(20),
    se_deplace BOOLEAN DEFAULT FALSE,
    email VARCHAR(255),
    telephone VARCHAR(20) NOT NULL,
    telephone_bis VARCHAR(20),
    identite TEXT,                        -- URLs séparées par virgules
    caf TEXT,                             -- URLs séparées par virgules
    circonstances TEXT,
    ressentit TEXT,
    specificites TEXT,
    etat_dossier VARCHAR(20) NOT NULL,   -- Recu, En cours, Validé, etc.
    commentaire_dossier TEXT,
    
    CONSTRAINT valid_status CHECK (
        etat_dossier IN ('Recu', 'En cours', 'En attente', 'Validé', 'Rejeté', 'Archivé')
    ),
    
    INDEX idx_status (etat_dossier),
    INDEX idx_quartier (id_quartier),
    INDEX idx_phone (telephone),
    INDEX idx_zakat (zakat_el_fitr),
    INDEX idx_sadaqa (sadaqa)
);
```

### Objet Famille (JavaScript)

```javascript
// Type definition
/**
 * @typedef {Object} Family
 * @property {string} id - Identifiant unique (FAM_timestamp_random)
 * @property {string} nom - Nom de famille
 * @property {string} prenom - Prénom du contact
 * @property {boolean} zakatElFitr - Éligible Zakat El Fitr
 * @property {boolean} sadaqa - Éligible Sadaqa
 * @property {number} nombreAdulte - Nombre d'adultes
 * @property {number} nombreEnfant - Nombre d'enfants
 * @property {string} adresse - Adresse complète
 * @property {string} idQuartier - ID du quartier
 * @property {boolean} seDeplace - Peut se déplacer
 * @property {string} email - Email (optionnel)
 * @property {string} telephone - Téléphone principal
 * @property {string} telephoneBis - Téléphone secondaire (optionnel)
 * @property {string} circonstances - Description situation
 * @property {string} ressentit - Notes observation
 * @property {string} specificites - Besoins particuliers
 */

// Exemple d'instance
const family = {
    id: "FAM_1703001234567_123",
    nom: "MARTIN",
    prenom: "Sarah",
    zakatElFitr: true,
    sadaqa: false,
    nombreAdulte: 2,
    nombreEnfant: 3,
    adresse: "15 Rue des Lilas, 44000 Nantes",
    idQuartier: "Q_003",
    seDeplace: false,
    email: "sarah.martin@example.com",
    telephone: "0612345678",
    telephoneBis: "0623456789",
    circonstances: "Perte d'emploi récente, situation temporaire",
    ressentit: "Famille courageuse, très motivée",
    specificites: "Enfant avec allergie au gluten"
};
```

### Mapping multilingue (COLUMN_MAP)

```javascript
const COLUMN_MAP = {
    // Français
    'Nom de famille': 'lastName',
    'Prénom de la personne à contacter': 'firstName',
    'Numéro de téléphone de la personne à contacter': 'phone',
    
    // Arabe
    'اللقب': 'lastName',
    'إسم الشخص الذي يمكن التواصل معه': 'firstName',
    'رقم هاتف الشخص الذي يمكن التواصل معه': 'phone',
    
    // Anglais
    'Last Name': 'lastName',
    'First Name of the Contact Person': 'firstName',
    'Phone Number of the Contact Person': 'phone',
    
    // ... autres champs
};
```

Ce mapping permet de traiter les trois formulaires de manière uniforme.

---

## 🔌 Services et intégrations

### Google Sheets

**Usage** : Base de données principale

```javascript
// Lecture
const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Famille');
const data = sheet.getDataRange().getValues();

// Écriture
sheet.appendRow([id, nom, prenom, ...]);

// Mise à jour
sheet.getRange(row, col).setValue(newValue);
```

**Optimisations** :

- Lecture par batch (`getDataRange()`)
- Écriture groupée (`setValues()`)
- Éviter les boucles avec `getRange()` individuel

### Google Drive

**Usage** : Stockage des documents uploadés

```javascript
// Créer dossier
const folder = DriveApp.createFolder('FAM_123');

// Déplacer fichier
const file = DriveApp.getFileById(fileId);
folder.addFile(file);
parent.removeFile(file);

// Renommer
file.setName('identity_1.pdf');
```

**Structure** :

```
Gestion Familles/
└── familles/
    └── FAM_1703001234567_123/
        ├── identity_1.pdf
        ├── identity_2.jpg
        ├── CAF_1.pdf
        └── resource_1.pdf
```

### Google Contacts (People API)

**Usage** : CRM intégré

```javascript
// Créer contact
People.People.createContact({
    names: [{
        givenName: prenom,
        familyName: nom
    }],
    phoneNumbers: [{
        value: telephone,
        type: 'mobile'
    }],
    biographies: [{
        value: `Family ID: ${id}`
    }]
});

// Rechercher
People.People.searchContacts({
    query: familyId,
    readMask: 'names,phoneNumbers,biographies'
});
```

**Intérêt** :

- Appels directs depuis Google Contacts
- Historique des interactions
- Synchronisation mobile

### API de géocodage externe

**Usage** : Validation adresses et attribution quartiers

```javascript
// Endpoint 1 : Géocodage
GET /geo?action=geocode&address=ADRESSE&country=France

Response: {
    isValid: true,
    coordinates: { latitude: 47.2184, longitude: -1.5536 },
    formattedAddress: "1 Rue de la Paix, 44000 Nantes, France"
}

// Endpoint 2 : Recherche quartier
GET /geo?action=findquartier&lat=47.2184&lng=-1.5536&maxDistance=50

Response: {
    quartierId: "Q_001",
    quartierName: "Centre-Ville",
    distance: 0.5
}
```

**Gestion des erreurs** :

- Retry avec backoff exponentiel (3 tentatives)
- Fallback : accepter sans quartier
- Cache des résultats (6 heures)

---

## 💾 Système de cache

### Architecture du cache

```
┌──────────────────────────────────────┐
│     ScriptCache (Google Apps Script)  │
│                                       │
│  ┌────────────┬──────────────────┐   │
│  │ Cache Key  │  TTL (seconds)   │   │
│  ├────────────┼──────────────────┤   │
│  │ api_*      │  300 (5 min)     │   │
│  │ prop_*     │  21600 (6h)      │   │
│  │ geo_*      │  21600 (6h)      │   │
│  │ folder_*   │  21600 (6h)      │   │
│  │ dup_*      │  1800 (30 min)   │   │
│  └────────────┴──────────────────┘   │
│                                       │
│  Max size: 100KB per key              │
│  Max total: 10MB per script           │
└──────────────────────────────────────┘
```

### Types de cache

#### 1. Cache API (SHORT - 5 minutes)

```javascript
const cache = CacheService.getScriptCache();
const cacheKey = 'api_all_families';

// Écriture
cache.put(cacheKey, JSON.stringify(data), 300);

// Lecture
const cached = cache.get(cacheKey);
if (cached) {
    return JSON.parse(cached);
}
```

**Usage** : Réponses API qui changent fréquemment

#### 2. Cache propriétés (VERY_LONG - 6 heures)

```javascript
const cacheKey = `prop_${propertyName}`;
let value = cache.get(cacheKey);

if (!value) {
    value = PropertiesService.getScriptProperties()
        .getProperty(propertyName);
    cache.put(cacheKey, value, 21600);
}
```

**Usage** : Configuration qui ne change presque jamais

#### 3. Cache géocodage (VERY_LONG - 6 heures)

```javascript
const cacheKey = `geo_${action}_${JSON.stringify(params)}`;
const cached = cache.get(cacheKey);

if (cached) {
    return JSON.parse(cached);
}

// Appeler l'API externe
const result = callGeoApi(...);
cache.put(cacheKey, JSON.stringify(result), 21600);
```

**Usage** : Résultats de géocodage (adresse → coordonnées)

#### 4. Cache doublons (MEDIUM - 30 minutes)

```javascript
const cacheKey = `dup_${phone}_${lastName}`;
const cached = cache.get(cacheKey);

if (cached) {
    return JSON.parse(cached);
}

// Rechercher dans le Sheet
const duplicate = findInSheet(...);
cache.put(cacheKey, JSON.stringify(duplicate), 1800);
```

**Usage** : Détection de doublons lors des soumissions

### Stratégie d'invalidation

```javascript
// Invalidation ciblée
function invalidateFamilyCache(familyId) {
    const cache = CacheService.getScriptCache();
    cache.remove(`api_family_${familyId}`);
    cache.remove('api_all_families');
}

// Invalidation globale
function clearAllCaches() {
    const cache = CacheService.getScriptCache();
    cache.removeAll([]);
}
```

**Déclencheurs d'invalidation** :

- Validation d'un dossier → `invalidateFamilyCache()`
- Modification manuelle → `clearAllCaches()`
- Action utilisateur → Menu "Rafraîchir Cache"

---

## ⚡ Gestion des événements

### Types de triggers

#### 1. Installable Triggers

Configurés via l'interface ou programmatiquement :

```javascript
// onFormSubmit
ScriptApp.newTrigger('handleFormSubmission')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onFormSubmit()
    .create();

// onEdit
ScriptApp.newTrigger('handleEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

// onOpen
ScriptApp.newTrigger('onOpen')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onOpen()
    .create();
```

#### 2. Simple Triggers

Détection automatique par nom de fonction :

```javascript
// Appelé automatiquement à l'ouverture
function onOpen() {
    // Créer menu personnalisé
}

// Appelé automatiquement lors d'une édition
function onEdit(e) {
    // Gérer l'édition
}
```

### Event Objects

#### onFormSubmit Event

```javascript
{
    authMode: "FULL",
    oldValue: "En cours",
    range: Range,  // Cellule modifiée
    source: Spreadsheet,
    triggerUid: "12345",
    user: User,
    value: "Validé"
}
```

### Gestion asynchrone

Apps Script est **single-threaded**, mais on peut simuler l'asynchronisme :

```javascript
// Pattern de traitement asynchrone
function processInBatches(items, batchSize, processFn) {
    const lock = LockService.getScriptLock();
    
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        try {
            lock.waitLock(30000); // 30 secondes max
            batch.forEach(processFn);
        } finally {
            lock.releaseLock();
        }
        
        // Pause entre batches
        if (i + batchSize < items.length) {
            Utilities.sleep(100);
        }
    }
}
```

---

## 🔒 Sécurité

### Niveaux de sécurité

#### 1. Authentification Google

```javascript
// Obtenir l'utilisateur actuel
const user = Session.getActiveUser().getEmail();

// Vérifier les permissions
const ss = SpreadsheetApp.getActiveSpreadsheet();
const protection = ss.getProtections(SpreadsheetApp.ProtectionType.RANGE)[0];
const canEdit = protection.canEdit();
```

#### 2. Validation des entrées

```javascript
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    // Supprimer HTML/Scripts
    return input
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .trim();
}

function validatePhone(phone) {
    const normalized = normalizePhone(phone);
    const regex = /^(0[1-9]\d{8}|(\+|00)33[1-9]\d{8})$/;
    return regex.test(normalized);
}

function validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}
```

#### 3. Protection des données sensibles

```javascript
// Utiliser Script Properties (chiffré)
PropertiesService.getScriptProperties()
    .setProperty('API_KEY', 'secret_key_here');

// Ne JAMAIS exposer dans le code
// ❌ const API_KEY = "sk_123456789";
// ✅ const API_KEY = getProperty('API_KEY');
```

#### 4. Contrôle d'accès API

```javascript
function doGet(e) {
    // Option 1 : Vérifier clé API
    const expectedKey = getProperty('API_KEY');
    if (e.parameter.apikey !== expectedKey) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    
    // Option 2 : Vérifier domaine référent
    const referer = e.parameter.referer;
    const allowedDomains = getProperty('ALLOWED_DOMAINS').split(',');
    if (!allowedDomains.some(d => referer.includes(d))) {
        return jsonResponse({ error: 'Forbidden' }, 403);
    }
    
    // Continuer le traitement...
}
```

#### 5. Protection contre injection

```javascript
// ❌ Dangereux
function searchFamily(query) {
    const sheet = getSheet();
    const formula = `=QUERY(A:T, "SELECT * WHERE B CONTAINS '${query}'")`;
    // Injection possible !
}

// ✅ Sécurisé
function searchFamily(query) {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const sanitized = sanitizeInput(query);
    return data.filter(row => row[1].includes(sanitized));
}
```

#### 6. Audit et logging

```javascript
function logSecurityEvent(event, user, details) {
    const logSheet = getSheetByName('Security_Log') ||
        SpreadsheetApp.getActiveSpreadsheet().insertSheet('Security_Log');
    
    logSheet.appendRow([
        new Date().toISOString(),
        event,
        user || Session.getActiveUser().getEmail(),
        JSON.stringify(details)
    ]);
}

// Utilisation
logSecurityEvent('UNAUTHORIZED_ACCESS', null, { ip: '192.168.1.1', action: 'api_call' });
```

### Permissions OAuth

Scopes requis dans `appsscript.json` :

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

**Principe du moindre privilège** : Ne demander que les permissions nécessaires.

---

## 🚀 Performance et scalabilité

### Limites Google Apps Script

| Ressource | Limite gratuite | Limite Workspace |
|-----------|-----------------|------------------|
| Exécution | 6 min | 30 min |
| Triggers total | 90 min/jour | 6 heures/jour |
| URL Fetches | 20,000/jour | 20,000/jour |
| Email | 100/jour | 1,500/jour |
| Script size | 50 MB | 50 MB |

### Monitoring

#### Métriques à surveiller

```javascript
function collectMetrics() {
    const metrics = {
        timestamp: new Date().toISOString(),
        totalFamilies: 0,
        validatedFamilies: 0,
        pendingFamilies: 0,
        avgProcessingTime: 0,
        errorRate: 0,
        cacheHitRate: 0
    };
    
    // Collecter les données
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
    const data = sheet.getDataRange().getValues();
    
    metrics.totalFamilies = data.length - 1;
    
    data.slice(1).forEach(row => {
        const status = row[OUTPUT_COLUMNS.ETAT_DOSSIER];
        if (status === CONFIG.STATUS.VALIDATED) {
            metrics.validatedFamilies++;
        } else if (status === CONFIG.STATUS.IN_PROGRESS) {
            metrics.pendingFamilies++;
        }
    });
    
    // Enregistrer dans une sheet dédiée
    const metricsSheet = getSheetByName('Metrics') ||
        SpreadsheetApp.getActiveSpreadsheet().insertSheet('Metrics');
    
    metricsSheet.appendRow(Object.values(metrics));
    
    return metrics;
}

// Exécuter quotidiennement
function setupMetricsTrigger() {
    ScriptApp.newTrigger('collectMetrics')
        .timeBased()
        .everyDays(1)
        .atHour(1)
        .create();
}
```

#### Dashboard de monitoring

```javascript
function generateHealthReport() {
    const metrics = collectMetrics();
    
    const health = {
        status: 'healthy',
        issues: []
    };
    
    // Vérifications
    if (metrics.pendingFamilies > 50) {
        health.status = 'warning';
        health.issues.push(`${metrics.pendingFamilies} dossiers en attente`);
    }
    
    if (metrics.errorRate > 0.05) {
        health.status = 'critical';
        health.issues.push(`Taux d'erreur élevé: ${(metrics.errorRate * 100).toFixed(2)}%`);
    }
    
    // Notifier si problème
    if (health.status !== 'healthy') {
        notifyAdmins('System Health Alert', JSON.stringify(health, null, 2));
    }
    
    return health;
}
```

---

## 🔄 Patterns de conception

### 1. Repository Pattern

```javascript
class FamilyRepository {
    constructor(sheetName) {
        this.sheetName = sheetName;
        this.cache = new Map();
    }
    
    findAll() {
        const sheet = getSheetByName(this.sheetName);
        return sheet.getDataRange().getValues().slice(1);
    }
    
    findById(id) {
        if (this.cache.has(id)) {
            return this.cache.get(id);
        }
        
        const family = this.findAll().find(
            row => row[OUTPUT_COLUMNS.ID] === id
        );
        
        if (family) {
            this.cache.set(id, family);
        }
        
        return family;
    }
    
    save(familyData) {
        const sheet = getSheetByName(this.sheetName);
        sheet.appendRow(familyData);
        this.cache.clear();
    }
}
```

### 2. Factory Pattern

```javascript
class FamilyFactory {
    static createFromFormData(formData) {
        return {
            id: generateFamilyId(),
            nom: formData.lastName,
            prenom: formData.firstName,
            telephone: normalizePhone(formData.phone),
            email: formData.email || '',
            adresse: formData.address,
            nombreAdulte: parseInt(formData.nombreAdulte),
            nombreEnfant: parseInt(formData.nombreEnfant),
            zakatElFitr: false,
            sadaqa: false,
            seDeplace: false,
            etatDossier: CONFIG.STATUS.RECEIVED
        };
    }
    
    static createFromRow(row) {
        return {
            id: row[OUTPUT_COLUMNS.ID],
            nom: row[OUTPUT_COLUMNS.NOM],
            prenom: row[OUTPUT_COLUMNS.PRENOM],
            // ... mapper toutes les colonnes
        };
    }
}
```

### 3. Strategy Pattern

```javascript
class ValidationStrategy {
    validate(data) {
        throw new Error('Must implement validate()');
    }
}

class PhoneValidationStrategy extends ValidationStrategy {
    validate(phone) {
        return isValidPhone(phone);
    }
}

class EmailValidationStrategy extends ValidationStrategy {
    validate(email) {
        return !email || isValidEmail(email);
    }
}

class FamilyValidator {
    constructor() {
        this.strategies = [
            new PhoneValidationStrategy(),
            new EmailValidationStrategy(),
            // ... autres stratégies
        ];
    }
    
    validate(familyData) {
        const errors = [];
        
        this.strategies.forEach(strategy => {
            if (!strategy.validate(familyData)) {
                errors.push(strategy.getErrorMessage());
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}
```

### 4. Observer Pattern

```javascript
class EventEmitter {
    constructor() {
        this.listeners = {};
    }
    
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }
    
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}

// Utilisation
const familyEvents = new EventEmitter();

familyEvents.on('family:validated', (family) => {
    organizeDocuments(family.id, ...);
    syncFamilyContact(family);
    clearCache();
});

familyEvents.on('family:rejected', (family) => {
    notifyAdmin('Dossier rejeté', family);
});

// Émettre événement
familyEvents.emit('family:validated', familyData);
```

---

## 📊 Diagrammes

### Diagramme de séquence : Validation d'un dossier

```
Utilisateur     Sheet       editHandler    driveService   contactService   Cache
    │             │              │               │               │            │
    │  Change     │              │               │               │            │
    │  status ────┼─────────────>│               │               │            │
    │             │              │               │               │            │
    │             │   getData    │               │               │            │
    │             │<─────────────│               │               │            │
    │             │              │               │               │            │
    │             │              │  organize     │               │            │
    │             │              │  Documents ───┼─────────────>│            │
    │             │              │               │               │            │
    │             │              │               │   success     │            │
    │             │              │<──────────────┼───────────────│            │
    │             │              │               │               │            │
    │             │              │  sync         │               │            │
    │             │              │  Contact ─────┼───────────────┼──────────>│
    │             │              │               │               │            │
    │             │              │               │               │  success   │
    │             │              │<──────────────┼───────────────┼────────────│
    │             │              │               │               │            │
    │             │  update      │               │               │            │
    │             │  Comment <───│               │               │            │
    │             │              │               │               │            │
    │             │              │  clear        │               │            │
    │             │              │  Cache ───────┼───────────────┼────────────┼─────>│
    │             │              │               │               │            │      │
    │             │              │               │               │            │<─────│
    │   ✓         │              │               │               │            │
    │<────────────┼──────────────│               │               │            │
```

### Diagramme d'état : Cycle de vie d'un dossier

```
                    ┌──────────┐
                    │  Soumis  │
                    └────┬─────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │         Validation             │
        │    (automatique/manuelle)      │
        └────┬───────────────────────┬───┘
             │                       │
       Invalide                   Valide
             │                       │
             ▼                       ▼
      ┌───────────┐           ┌──────────┐
      │  Rejeté   │           │   Recu   │
      └───────────┘           └────┬─────┘
                                   │
                                   ▼
                            ┌─────────────┐
                            │  En cours   │
                            └──────┬──────┘
                                   │
                        ┌──────────┼──────────┐
                        │          │          │
                        ▼          ▼          ▼
                 ┌───────────┐  ┌─────────┐  ┌────────────┐
                 │ En attente│  │ Validé  │  │  Rejeté    │
                 └─────┬─────┘  └────┬────┘  └────────────┘
                       │             │
                       │             ▼
                       │      ┌─────────────┐
                       │      │  Archivé    │
                       │      │ (optionnel) │
                       │      └─────────────┘
                       │
                       └──────────────┘
                    (retour En cours)
```

---

## 🎓 Bonnes pratiques

### 1. Code organization

```javascript
// ✅ Bon - Fonctions courtes et ciblées
function validateFamily(data) {
    const errors = [];
    
    if (!data.lastName) errors.push('Nom requis');
    if (!isValidPhone(data.phone)) errors.push('Téléphone invalide');
    
    return { isValid: errors.length === 0, errors };
}

// ❌ Mauvais - Fonction trop longue
function processSubmission(data) {
    // 200 lignes de code...
}
```

### 2. Error handling

```javascript
// ✅ Bon - Gestion d'erreur complète
try {
    const result = callExternalApi();
    return processResult(result);
} catch (error) {
    logError('API call failed', error);
    notifyAdmin('Error', error.toString());
    return { success: false, error: error.message };
}

// ❌ Mauvais - Ignorer les erreurs
try {
    callExternalApi();
} catch (e) {
    // Silence...
}
```

### 3. Documentation

```javascript
/**
 * Valide et géocode une adresse
 * 
 * @param {string} address - Adresse complète
 * @param {string} postalCode - Code postal
 * @param {string} city - Ville
 * @returns {Object} Résultat de validation
 * @returns {boolean} returns.isValid - Adresse valide
 * @returns {Object} returns.coordinates - Coordonnées GPS
 * @returns {string} returns.quartierId - ID du quartier
 * 
 * @example
 * const result = validateAddress('1 Rue de la Paix', '44000', 'Nantes');
 * if (result.isValid) {
 *     console.log(`Quartier: ${result.quartierId}`);
 * }
 */
function validateAddressAndGetQuartier(address, postalCode, city) {
    // ...
}
```

---

[← Configuration](CONFIGURATION.md) | [Retour au README principal](../README.md) | [API →](API.md)