# 📥 Guide d'installation

## Table des matières

- [Prérequis](#prérequis)
- [Installation de clasp](#installation-de-clasp)
- [Création du projet](#création-du-projet)
- [Configuration initiale](#configuration-initiale)
- [Déploiement du code](#déploiement-du-code)
- [Vérification de l'installation](#vérification-de-linstallation)
- [Prochaines étapes](#prochaines-étapes)

---

## ✅ Prérequis

### Comptes et permissions

1. **Compte Google Workspace** avec accès à :
   - Google Sheets
   - Google Forms
   - Google Drive
   - Google Contacts (People API)

2. **Permissions Google Cloud** :
   - Capacité à créer des projets Apps Script
   - Accès aux API avancées (People API)

3. **Outils de développement** :
   - Node.js version 14 ou supérieure
   - npm (inclus avec Node.js)
   - Git (optionnel mais recommandé)
   - Un éditeur de code (VS Code, Sublime, etc.)

### Vérification des prérequis

```bash
# Vérifier Node.js
node --version
# Attendu : v14.0.0 ou supérieur

# Vérifier npm
npm --version
# Attendu : 6.0.0 ou supérieur

# Vérifier Git (optionnel)
git --version
# Attendu : 2.0.0 ou supérieur
```

---

## 🛠️ Installation de clasp

### Qu'est-ce que clasp ?

**clasp** (Command Line Apps Script Projects) est l'outil officiel de Google pour développer des projets Apps Script localement. Il permet de :

- Créer des projets Apps Script depuis la ligne de commande
- Synchroniser le code local avec Google Apps Script
- Gérer les versions et les déploiements

### Installation globale

```bash
npm install -g @google/clasp
```

### Vérification

```bash
clasp --version
# Attendu : 2.4.0 ou supérieur
```

### Authentification

```bash
clasp login
```

Cette commande :

1. Ouvre votre navigateur
2. Vous demande de vous connecter avec votre compte Google
3. Demande les permissions nécessaires
4. Stocke les credentials localement dans `~/.clasprc.json`

**Note** : Si vous travaillez sur un serveur sans interface graphique, utilisez :

```bash
clasp login --no-localhost
```

---

## 🚀 Création du projet

### Option A : Nouveau projet (Recommandé)

#### 1. Créer le dossier du projet

```bash
mkdir gestion_familles
cd gestion_familles
```

#### 2. Initialiser le projet Apps Script

```bash
clasp create --type sheets --title "Gestion Familles" --rootDir ./Google_app_script
```

Cette commande :

- Crée un nouveau projet Apps Script
- Le lie automatiquement à un nouveau Google Sheet
- Crée le fichier `.clasp.json` avec la configuration
- Génère un ID de script unique

**Sortie attendue** :

```
Created new Google Sheet: https://drive.google.com/open?id=1abc...xyz
Created new Google Sheets Add-on script: https://script.google.com/d/1def...uvw/edit
Warning: files in subfolder are not accounted for unless you set a '.claspignore' file.
Cloned 1 file.
└─ Google_app_script/appsscript.json
```

#### 3. Noter les IDs importants

Depuis la sortie de la commande, notez :

- **Sheet ID** : `1abc...xyz` (dans l'URL du Sheet)
- **Script ID** : `1def...uvw` (dans l'URL du script)

### Option B : Projet existant

Si vous avez déjà un projet Apps Script :

```bash
# Obtenir le Script ID depuis l'URL
# https://script.google.com/d/SCRIPT_ID/edit

clasp clone SCRIPT_ID
```

### Structure créée

Après la création, vous devriez avoir :

```
gestion_familles/
└── Google_app_script/
    ├── .clasp.json          # Configuration clasp
    └── appsscript.json      # Manifeste du projet
```

---

## ⚙️ Configuration initiale

### 1. Fichier .clasp.json

Vérifiez ou créez le fichier `.clasp.json` :

```json
{
  "scriptId": "VOTRE_SCRIPT_ID",
  "rootDir": ".",
  "parentId": ["VOTRE_SPREADSHEET_ID"]
}
```

**Où trouver ces IDs ?**

- **scriptId** : Dans l'URL de l'éditeur Apps Script

  ```
  https://script.google.com/d/1abc123def456/edit
                              ^^^^^^^^^^^^ Script ID
  ```

- **parentId** (Spreadsheet ID) : Dans l'URL du Google Sheet

  ```
  https://docs.google.com/spreadsheets/d/1xyz789uvw456/edit
                                           ^^^^^^^^^^^^ Spreadsheet ID
  ```

### 2. Fichier .claspignore

Créez un fichier `.claspignore` pour exclure certains fichiers :

```bash
cat > Google_app_script/.claspignore << 'EOF'
**/**~
**/.DS_Store
**/node_modules/**
**/.git/**
**/.github/**
**/README.md
**/docs/**
EOF
```

### 3. Fichier appsscript.json

Mettez à jour `appsscript.json` avec la configuration complète :

```json
{
  "timeZone": "Europe/Paris",
  "dependencies": {
    "enabledAdvancedServices": [
      {
        "userSymbol": "People",
        "version": "v1",
        "serviceId": "people"
      }
    ]
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/script.external_request"
  ],
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE"
  }
}
```

**Explications** :

- `timeZone` : Fuseau horaire pour les dates
- `enabledAdvancedServices` : Active l'API People pour Google Contacts
- `runtimeVersion` : Utilise le moteur V8 moderne
- `oauthScopes` : Permissions nécessaires
- `webapp` : Configuration pour l'API REST

---

## 📤 Déploiement du code

### 1. Copier les fichiers source

Copiez tous les fichiers du projet dans `Google_app_script/` :

```
Google_app_script/
├── .clasp.json
├── .claspignore
├── appsscript.json
├── src/
│   ├── core/
│   │   ├── config.js
│   │   └── utils.js
│   ├── handlers/
│   │   ├── formHandler.js
│   │   └── editHandler.js
│   ├── services/
│   │   ├── driveService.js
│   │   ├── contactService.js
│   │   └── geoService.js
│   ├── api/
│   │   └── familyApiHandler.js
│   └── ui/
│       ├── menu.js
│       └── helpers.js
├── views/
│   └── dialogs/
│       └── manualEntry.html
├── assets/
│   └── css/
│       └── styles.html
└── tests/
    └── tests.js
```

### 2. Pousser le code vers Apps Script

```bash
cd Google_app_script
clasp push
```

**Sortie attendue** :

```
└─ appsscript.json
└─ src/core/config.js
└─ src/core/utils.js
└─ src/handlers/formHandler.js
└─ src/handlers/editHandler.js
...
Pushed 15 files.
```

### 3. Surveillance des changements (développement)

Pour pousser automatiquement les changements :

```bash
clasp push --watch
```

Cela surveille les fichiers et pousse automatiquement chaque modification.

### 4. Ouvrir l'éditeur Apps Script

```bash
clasp open
```

Cette commande ouvre l'éditeur Apps Script dans votre navigateur.

---

## ✓ Vérification de l'installation

### 1. Vérifier les fichiers

Dans l'éditeur Apps Script, vous devriez voir tous vos fichiers organisés :

```
Fichiers
├── appsscript.json
├── src/core/config
├── src/core/utils
├── src/handlers/formHandler
├── src/handlers/editHandler
├── src/services/driveService
├── src/services/contactService
├── src/services/geoService
├── src/api/familyApiHandler
├── src/ui/menu
├── src/ui/helpers
├── views/dialogs/manualEntry
├── assets/css/styles
└── tests/tests
```

### 2. Tester l'exécution

Dans l'éditeur Apps Script :

1. Sélectionnez la fonction `onOpen`
2. Cliquez sur **Exécuter**
3. Autorisez les permissions si demandé
4. Vérifiez qu'aucune erreur n'apparaît dans les logs

### 3. Vérifier le menu

1. Ouvrez votre Google Sheet
2. Rafraîchissez la page
3. Vous devriez voir un nouveau menu : **📦 Gestion Familles**

### 4. Test de base

Exécutez ce test dans l'éditeur :

```javascript
function testInstallation() {
  try {
    // Test 1 : Configuration
    console.log('Test 1 : Chargement de la configuration...');
    const config = CONFIG;
    console.log('✓ Configuration chargée');
    
    // Test 2 : Accès au Sheet
    console.log('Test 2 : Accès au Google Sheet...');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    console.log('✓ Sheet accessible:', ss.getName());
    
    // Test 3 : Fonctions utilitaires
    console.log('Test 3 : Fonctions utilitaires...');
    const testPhone = normalizePhone('06 12 34 56 78');
    console.assert(testPhone === '0612345678', 'Normalisation du téléphone');
    console.log('✓ Utilitaires fonctionnels');
    
    console.log('\n✅ Installation validée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}
```

---

## 🎯 Prochaines étapes

Une fois l'installation terminée, procédez à la configuration :

1. **[Configuration du système](CONFIGURATION.md)** :
   - Configurer les propriétés du script
   - Créer la structure des sheets
   - Configurer les formulaires
   - Mettre en place les triggers

2. **[Déployer l'API REST](API.md#déploiement)** :
   - Créer un déploiement Web App
   - Obtenir l'URL de l'API
   - Tester les endpoints

3. **[Premiers tests](TESTING.md)** :
   - Exécuter les tests unitaires
   - Tester une soumission de formulaire
   - Vérifier l'organisation des documents

---

## 🔧 Commandes clasp utiles

### Commandes de base

```bash
# Pousser le code
clasp push

# Pousser avec surveillance
clasp push --watch

# Tirer le code depuis Apps Script
clasp pull

# Ouvrir l'éditeur
clasp open

# Ouvrir le Sheet parent
clasp open --webapp
```

### Gestion des versions

```bash
# Créer une version
clasp version "Version 1.0.0"

# Lister les versions
clasp versions

# Déployer une version spécifique
clasp deploy --versionNumber 1
```

### Déploiements

```bash
# Lister les déploiements
clasp deployments

# Créer un déploiement
clasp deploy --description "Production v1.0"

# Désactiver un déploiement
clasp undeploy DEPLOYMENT_ID
```

### Logs

```bash
# Afficher les logs
clasp logs

# Suivre les logs en temps réel
clasp logs --watch

# Logs simplifiés
clasp logs --simplified
```

---

## ❓ Problèmes courants

### Erreur : "User has not enabled the Google Apps Script API"

**Solution** :

1. Allez sur <https://script.google.com/home/usersettings>
2. Activez "Google Apps Script API"
3. Réessayez `clasp login`

### Erreur : "Push failed. Errors: Invalid value at 'files[0].source'"

**Solution** :

Vérifiez que tous vos fichiers sont encodés en UTF-8 sans BOM.

```bash
# Sur Linux/Mac
file -I your_file.js

# Convertir si nécessaire
iconv -f UTF-8 -t UTF-8 -c your_file.js > temp && mv temp your_file.js
```

### Erreur : "Script file not found"

**Solution** :

Vérifiez que `.clasp.json` contient le bon `scriptId` :

```bash
clasp open
# Copiez l'ID depuis l'URL et mettez à jour .clasp.json
```

### Les fichiers ne sont pas poussés

**Solution** :

Vérifiez `.claspignore` et assurez-vous que vos fichiers ne sont pas exclus.

---

## 📚 Ressources

- [Documentation officielle de clasp](https://github.com/google/clasp)
- [Guide Apps Script](https://developers.google.com/apps-script/guides)
- [Référence API Apps Script](https://developers.google.com/apps-script/reference)

---

[← Retour au README principal](../README.md) | [Configuration suivante →](CONFIGURATION.md)
