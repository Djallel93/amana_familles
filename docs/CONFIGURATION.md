# ⚙️ Guide de configuration

## Table des matières

- [Propriétés du script](#propriétés-du-script)
- [Configuration du Google Sheet](#configuration-du-google-sheet)
- [Configuration des formulaires](#configuration-des-formulaires)
- [Configuration des triggers](#configuration-des-triggers)
- [Configuration de Google Drive](#configuration-de-google-drive)
- [Configuration de l'API externe](#configuration-de-lapi-externe)
- [Activation des API Google](#activation-des-api-google)
- [Vérification de la configuration](#vérification-de-la-configuration)

---

## 🔑 Propriétés du script

Les propriétés du script stockent les informations sensibles et les configurations qui ne doivent pas être dans le code.

### Accéder aux propriétés

1. Ouvrez l'éditeur Apps Script
2. Cliquez sur **Projet Settings** (icône engrenage)
3. Descendez à **Script Properties**
4. Cliquez sur **Add script property**

### Propriétés requises

| Clé                          | Description                  | Exemple                       | Obligatoire |
| ---------------------------- | ---------------------------- | ----------------------------- | ----------- |
| `SPREADSHEET_ID`             | ID du Google Sheet principal | `1a2b3c4d...xyz`              | ✅           |
| `GESTION_FAMILLES_FOLDER_ID` | ID du dossier Drive racine   | `1x2y3z4w...uvw`              | ✅           |
| `GEO_API_URL`                | URL de l'API de géocodage    | `https://api.example.com/geo` | ✅           |

### Comment obtenir les IDs

#### Spreadsheet ID

```
URL du Google Sheet :
https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0j/edit
                                        ^^^^^^^^^^^^^^^^^^^
                                        Spreadsheet ID
```

#### Folder ID

1. Créez un dossier dans Google Drive nommé "Gestion Familles"
2. Ouvrez le dossier
3. Copiez l'ID depuis l'URL :

```
URL du dossier Drive :
https://drive.google.com/drive/folders/1x2y3z4w5v6u7t8s9r0q
                                         ^^^^^^^^^^^^^^^^^^^
                                         Folder ID
```

### Configuration via script

Vous pouvez aussi configurer les propriétés par code :

```javascript
function setupScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  
  props.setProperties({
    'SPREADSHEET_ID': '1a2b3c4d5e6f7g8h9i0j',
    'GESTION_FAMILLES_FOLDER_ID': '1x2y3z4w5v6u7t8s9r0q',
    'GEO_API_URL': 'https://api.example.com/geo'
  });
  
  console.log('✓ Propriétés configurées');
}
```

---

## 📊 Configuration du Google Sheet

### Structure des onglets

Créez les onglets suivants dans votre Google Sheet :

1. **Famille** - Onglet principal (données nettoyées et enrichies)
2. **Familles – FR** - Réponses du formulaire français
3. **Familles – AR** - Réponses du formulaire arabe
4. **Familles – EN** - Réponses du formulaire anglais

### Configuration de l'onglet "Famille"

#### Étape 1 : Créer l'onglet

1. Renommez l'onglet par défaut en "Famille"
2. Ou créez un nouvel onglet : clic droit > Insert sheet > "Famille"

#### Étape 2 : Créer les en-têtes

Ajoutez ces en-têtes dans la première ligne (A1 à T1) :

| Col | En-tête             | Type de données  |
| --- | ------------------- | ---------------- |
| A   | ID                  | Texte            |
| B   | Nom                 | Texte            |
| C   | Prénom              | Texte            |
| D   | Zakat El Fitr       | Case à cocher    |
| E   | Sadaqa              | Case à cocher    |
| F   | Nombre Adulte       | Nombre           |
| G   | Nombre Enfant       | Nombre           |
| H   | Adresse             | Texte            |
| I   | ID Quartier         | Texte            |
| J   | Se Déplace          | Case à cocher    |
| K   | Email               | Texte            |
| L   | Téléphone           | Texte            |
| M   | Téléphone Bis       | Texte            |
| N   | Identité            | Texte (URLs)     |
| O   | CAF                 | Texte (URLs)     |
| P   | Circonstances       | Texte long       |
| Q   | Ressentit           | Texte long       |
| R   | Spécificités        | Texte long       |
| S   | État Dossier        | Liste déroulante |
| T   | Commentaire Dossier | Texte long       |

#### Étape 3 : Formater les colonnes

**Cases à cocher** (D, E, J) :

1. Sélectionnez la colonne entière (cliquez sur D)
2. Menu **Insert** > **Checkbox**

**Validation de données pour "État Dossier"** (colonne S) :

1. Sélectionnez la colonne S (S2:S)
2. Menu **Data** > **Data validation**
3. Critères : **List from a range**
4. Saisissez les valeurs :

   ```
   Recu
   En cours
   En attente
   Validé
   Rejeté
   Archivé
   ```

5. Options :
   - ✅ Show dropdown list in cell
   - ✅ Reject input if data is invalid
6. Cliquez sur **Save**

**Format des colonnes de texte long** (P, Q, R, T) :

1. Sélectionnez les colonnes P, Q, R, T
2. Menu **Format** > **Wrapping** > **Wrap**
3. Menu **Format** > **Text wrapping** > **Clip**

#### Étape 4 : Mise en forme conditionnelle

Pour colorer les lignes selon le statut :

1. Sélectionnez toutes les données (A2:T)
2. Menu **Format** > **Conditional formatting**
3. Ajoutez ces règles :

**Règle 1 : Validé (Vert)**

- Format cells if : Custom formula is
- Formule : `=$S2="Validé"`
- Formatting style : Vert clair (#d9ead3)

**Règle 2 : Rejeté (Rouge)**

- Format cells if : Custom formula is
- Formule : `=$S2="Rejeté"`
- Formatting style : Rouge clair (#f4cccc)

**Règle 3 : En cours (Jaune)**

- Format cells if : Custom formula is
- Formule : `=$S2="En cours"`
- Formatting style : Jaune clair (#fff2cc)

#### Étape 5 : Protection des colonnes

Protégez certaines colonnes pour éviter les modifications accidentelles :

1. Sélectionnez la colonne A (ID)
2. Menu **Data** > **Protected sheets and ranges**
3. Cliquez sur **Add a sheet or range**
4. Range : `Famille!A:A`
5. Set permissions : **Only you can edit**
6. Répétez pour les colonnes automatiques (D, E, J, I)

### Script de création automatique

Vous pouvez créer la structure automatiquement :

```javascript
function setupFamilleSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Créer ou obtenir l'onglet
  let sheet = ss.getSheetByName('Famille');
  if (!sheet) {
    sheet = ss.insertSheet('Famille');
  }
  
  // En-têtes
  const headers = [
    'ID', 'Nom', 'Prénom', 'Zakat El Fitr', 'Sadaqa',
    'Nombre Adulte', 'Nombre Enfant', 'Adresse', 'ID Quartier',
    'Se Déplace', 'Email', 'Téléphone', 'Téléphone Bis',
    'Identité', 'CAF', 'Circonstances', 'Ressentit',
    'Spécificités', 'État Dossier', 'Commentaire Dossier'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format des en-têtes
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4a86e8')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  
  // Cases à cocher
  sheet.getRange('D2:D').insertCheckboxes();
  sheet.getRange('E2:E').insertCheckboxes();
  sheet.getRange('J2:J').insertCheckboxes();
  
  // Validation État Dossier
  const statusValues = ['Recu', 'En cours', 'En attente', 'Validé', 'Rejeté', 'Archivé'];
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(statusValues, true)
    .build();
  sheet.getRange('S2:S').setDataValidation(statusRule);
  
  // Geler la première ligne
  sheet.setFrozenRows(1);
  
  // Ajuster les largeurs
  sheet.autoResizeColumns(1, headers.length);
  
  console.log('✓ Onglet Famille configuré');
}
```

---

## 📝 Configuration des formulaires

### Créer les trois formulaires

Créez trois formulaires Google Forms identiques (un pour chaque langue) :

#### Étape 1 : Créer le formulaire

1. Allez sur <https://forms.google.com>
2. Cliquez sur **Blank** ou **+**
3. Titre : "Demande d'Aide - Famille" (FR/AR/EN selon la langue)
4. Description : Expliquez le but du formulaire

#### Étape 2 : Ajouter les questions

**Questions obligatoires** (marquées avec *) :

1. **Nom de famille** *
   - Type : Short answer
   - Required : Yes

2. **Prénom de la personne à contacter** *
   - Type : Short answer
   - Required : Yes

3. **Numéro de téléphone** *
   - Type : Short answer
   - Required : Yes
   - Validation : Custom regex : `^0[1-9][0-9]{8}$`
   - Error text : "Format invalide. Exemple : 0612345678"

4. **Adresse** *
   - Type : Short answer
   - Required : Yes

5. **Code postal** *
   - Type : Short answer
   - Required : Yes
   - Validation : Custom regex : `^[0-9]{5}$`

6. **Ville** *
   - Type : Short answer
   - Required : Yes

7. **Nombre d'adultes dans le foyer** *
   - Type : Short answer (Number)
   - Required : Yes
   - Validation : Number > 0

8. **Nombre d'enfants dans le foyer** *
   - Type : Short answer (Number)
   - Required : Yes
   - Validation : Number >= 0

9. **Justificatif d'identité ou de résidence** *
   - Type : File upload
   - Required : Yes
   - Settings :
     - Allow only specific file types : PDF, Images
     - Maximum file size : 10 MB
     - Maximum number of files : 3

**Questions optionnelles** :

10. **Autre numéro de téléphone**
    - Type : Short answer
    - Required : No

11. **Email**
    - Type : Short answer
    - Required : No
    - Validation : Email

12. **Décrivez brièvement votre situation actuelle**
    - Type : Paragraph
    - Required : No

13. **Êtes-vous actuellement hébergé(e) ?**
    - Type : Multiple choice
    - Options : Oui / Non
    - Required : No

14. **Par qui êtes-vous hébergé(e) ?** (si oui ci-dessus)
    - Type : Short answer
    - Required : No

15. **Attestation de la CAF**
    - Type : File upload
    - Required : No
    - Settings : Idem question 9

16. **Type de pièce d'identité**
    - Type : Dropdown
    - Options : Carte d'identité, Passeport, Titre de séjour, Autre
    - Required : No

17. **Travaillez-vous actuellement ?**
    - Type : Multiple choice
    - Options : Oui / Non
    - Required : No

18. **Justificatifs de ressources**
    - Type : File upload
    - Required : No

#### Étape 3 : Configuration du formulaire

1. **Settings** (icône engrenage) :
   - ✅ Limit to 1 response
   - ✅ Collect email addresses
   - ✅ Response receipts : Always

2. **Responses** :
   - Cliquez sur l'icône Google Sheets
   - Sélectionnez "Create a new spreadsheet" OU "Select existing spreadsheet"
   - Nommez l'onglet : "Familles – FR" (ou AR/EN)

3. **Confirmation message** :

   ```
   Merci pour votre demande ! 
   Nous examinerons votre dossier et vous contacterons dans les plus brefs délais.
   Conservez une copie de votre réponse qui vous a été envoyée par email.
   ```

#### Étape 4 : Configuration du stockage des fichiers

1. Dans le formulaire, cliquez sur les questions de type "File upload"
2. Cliquez sur les trois points > **Response validation**
3. Destination folder : Créez ou sélectionnez un dossier dans Drive
4. Recommandé : Créez `Gestion Familles/uploads/`

### Traductions

Pour les versions AR et EN, traduisez toutes les questions en conservant la même structure.

**Exemple pour l'arabe** :

```
1. اللقب (Nom de famille)
2. إسم الشخص الذي يمكن التواصل معه (Prénom du contact)
3. رقم هاتف الشخص الذي يمكن التواصل معه (Téléphone)
...
```

**Exemple pour l'anglais** :

```
1. Last Name
2. First Name of the Contact Person
3. Phone Number of the Contact Person
...
```

---

## ⏰ Configuration des triggers

Les triggers (déclencheurs) permettent au système de réagir automatiquement aux événements.

### Triggers à configurer

#### 1. Trigger onFormSubmit

Déclenché à chaque soumission de formulaire.

**Configuration manuelle** :

1. Dans l'éditeur Apps Script
2. Cliquez sur **Triggers** (icône horloge à gauche)
3. Cliquez sur **Add Trigger** en bas à droite
4. Configuration :
   - Choose which function to run : `handleFormSubmission`
   - Choose which deployment should run : `Head`
   - Select event source : `From spreadsheet`
   - Select event type : `On form submit`
5. Cliquez sur **Save**

**Configuration par script** :

```javascript
function setupFormSubmitTrigger() {
  // Supprimer les triggers existants
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'handleFormSubmission') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Créer le nouveau trigger
  ScriptApp.newTrigger('handleFormSubmission')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onFormSubmit()
    .create();
  
  console.log('✓ Trigger onFormSubmit configuré');
}
```

#### 2. Trigger onEdit

Déclenché à chaque modification manuelle du sheet.

**Configuration manuelle** :

1. **Triggers** > **Add Trigger**
2. Configuration :
   - Function : `handleEdit`
   - Deployment : `Head`
   - Event source : `From spreadsheet`
   - Event type : `On edit`
3. **Save**

**Configuration par script** :

```javascript
function setupEditTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'handleEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  ScriptApp.newTrigger('handleEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  
  console.log('✓ Trigger onEdit configuré');
}
```

#### 3. Trigger onOpen

Déclenché à l'ouverture du spreadsheet.

**Configuration manuelle** :

1. **Triggers** > **Add Trigger**
2. Configuration :
   - Function : `onOpen`
   - Deployment : `Head`
   - Event source : `From spreadsheet`
   - Event type : `On open`
3. **Save**

**Configuration par script** :

```javascript
function setupOpenTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onOpen') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  ScriptApp.newTrigger('onOpen')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onOpen()
    .create();
  
  console.log('✓ Trigger onOpen configuré');
}
```

#### Configuration complète

Exécutez cette fonction pour configurer tous les triggers :

```javascript
function setupAllTriggers() {
  setupFormSubmitTrigger();
  setupEditTrigger();
  setupOpenTrigger();
  console.log('✅ Tous les triggers sont configurés');
}
```

### Vérification des triggers

```javascript
function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  console.log(`Nombre de triggers : ${triggers.length}\n`);
  
  triggers.forEach((trigger, index) => {
    console.log(`Trigger ${index + 1}:`);
    console.log(`  - Fonction : ${trigger.getHandlerFunction()}`);
    console.log(`  - Type : ${trigger.getEventType()}`);
    console.log(`  - Source : ${trigger.getTriggerSource()}`);
    console.log('');
  });
}
```

---

## 📁 Configuration de Google Drive

### Structure des dossiers

Créez la structure suivante dans Google Drive :

```
Gestion Familles/               (Dossier racine)
├── familles/                   (Dossiers des familles)
│   ├── FAM_1234567890_123/
│   │   ├── identity_1.pdf
│   │   ├── CAF_1.pdf
│   │   └── resource_1.pdf
│   └── FAM_1234567890_456/
│       └── ...
└── uploads/                    (Uploads temporaires des formulaires)
    ├── FR/
    ├── AR/
    └── EN/
```

### Script de création

```javascript
function setupDriveStructure() {
  // Obtenir l'ID du dossier racine depuis les propriétés
  const config = getScriptConfig();
  const rootFolder = DriveApp.getFolderById(config.gestionFamillesFolderId);
  
  // Créer les sous-dossiers
  getOrCreateFolder(rootFolder, 'familles');
  
  const uploadsFolder = getOrCreateFolder(rootFolder, 'uploads');
  getOrCreateFolder(uploadsFolder, 'FR');
  getOrCreateFolder(uploadsFolder, 'AR');
  getOrCreateFolder(uploadsFolder, 'EN');
  
  console.log('✓ Structure Drive créée');
  console.log(`Dossier racine : ${rootFolder.getUrl()}`);
}
```

### Permissions

Configurez les permissions du dossier racine :

1. Clic droit sur "Gestion Familles" > **Share**
2. Ajoutez les personnes autorisées :
   - Administrateurs : **Editor**
   - Bénévoles : **Viewer**
3. Settings > **Disable options for viewers**

---

## 🌍 Configuration de l'API externe

### API de géocodage

Le système nécessite une API de géocodage pour :

- Valider les adresses
- Obtenir les coordonnées GPS
- Trouver le quartier le plus proche

### Format attendu

L'API doit exposer deux endpoints :

#### 1. Géocodage

```
GET /geo?action=geocode&address=ADRESSE&country=PAYS
```

**Réponse attendue** :

```json
{
  "error": false,
  "isValid": true,
  "coordinates": {
    "latitude": 47.2184,
    "longitude": -1.5536
  },
  "formattedAddress": "1 Rue de la Paix, 44000 Nantes, France"
}
```

#### 2. Recherche de quartier

```
GET /geo?action=findquartier&lat=47.2184&lng=-1.5536&maxDistance=50
```

**Réponse attendue** :

```json
{
  "error": false,
  "quartierId": "Q_001",
  "quartierName": "Centre-Ville",
  "distance": 0.5
}
```

### Configuration

Ajoutez l'URL de base dans les propriétés du script :

```javascript
GEO_API_URL = https://votre-api.com/geo
```

---

## 🔓 Activation des API Google

### People API (Google Contacts)

1. Ouvrez l'éditeur Apps Script
2. Cliquez sur **Services** (+ à gauche)
3. Trouvez "People API"
4. Cliquez sur **Add**
5. Identifiant : `People`
6. Version : `v1`

Ou via `appsscript.json` (déjà configuré) :

```json
{
  "dependencies": {
    "enabledAdvancedServices": [
      {
        "userSymbol": "People",
        "version": "v1",
        "serviceId": "people"
      }
    ]
  }
}
```

---

## ✅ Vérification de la configuration

### Script de vérification complète

```javascript
function verifyConfiguration() {
  console.log('=== Vérification de la configuration ===\n');
  
  let errors = 0;
  
  // 1. Propriétés du script
  console.log('1. Propriétés du script...');
  const config = getScriptConfig();
  
  if (!config.spreadsheetId) {
    console.error('✗ SPREADSHEET_ID manquant');
    errors++;
  } else {
    console.log('✓ SPREADSHEET_ID configuré');
  }
  
  if (!config.gestionFamillesFolderId) {
    console.error('✗ GESTION_FAMILLES_FOLDER_ID manquant');
    errors++;
  } else {
    console.log('✓ GESTION_FAMILLES_FOLDER_ID configuré');
  }
  
  if (!config.geoApiUrl) {
    console.error('✗ GEO_API_URL manquant');
    errors++;
  } else {
    console.log('✓ GEO_API_URL configuré');
  }
  
  // 2. Sheets
  console.log('\n2. Onglets du Sheet...');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Object.values(CONFIG.SHEETS).forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      console.error(`✗ Onglet "${sheetName}" manquant`);
      errors++;
    } else {
      console.log(`✓ Onglet "${sheetName}" présent`);
    }
  });
  
  // 3. Triggers
  console.log('\n3. Triggers...');
  const triggers = ScriptApp.getProjectTriggers();
  const requiredTriggers = ['handleFormSubmission', 'handleEdit', 'onOpen'];
  
  requiredTriggers.forEach(funcName => {
    const found = triggers.some(t => t.getHandlerFunction() === funcName);
    if (!found) {
      console.error(`✗ Trigger "${funcName}" manquant`);
      errors++;
    } else {
      console.log(`✓ Trigger "${funcName}" configuré`);
    }
  });
  
  // 4. Drive
  console.log('\n4. Accès Google Drive...');
  try {
    const folder = DriveApp.getFolderById(config.gestionFamillesFolderId);
    console.log(`✓ Dossier Drive accessible : ${folder.getName()}`);
  } catch (e) {
    console.error('✗ Impossible d\'accéder au dossier Drive');
    errors++;
  }
  
  // 5. API People
  console.log('\n5. API People (Contacts)...');
  try {
    People.People.searchContacts({ query: 'test', readMask: 'names' });
    console.log('✓ API People accessible');
  } catch (e) {
    console.error('✗ API People non activée');
    errors++;
  }
  
  // Résultat
  console.log('\n=== Résultat ===');
  if (errors === 0) {
    console.log('✅ Configuration complète et valide !');
  } else {
    console.error(`❌ ${errors} erreur(s) détectée(s)`);
  }
  
  return errors === 0;
}
```

Exécutez cette fonction pour vérifier que tout est correctement configuré.

---

[← Installation](INSTALLATION.md) | [Retour au README principal](../README.md) | [Architecture →](ARCHITECTURE.md)
