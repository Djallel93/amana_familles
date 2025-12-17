# 📦 Système de Gestion des Familles - Google Apps Script

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Documentation complète](#documentation-complète)
- [Démarrage rapide](#démarrage-rapide)
- [Architecture](#architecture)
- [Support](#support)

---

## 🎯 Vue d'ensemble

Ce système de gestion des familles est une application complète développée en Google Apps Script qui permet de :

- **Collecter** les demandes d'aide via des formulaires multilingues (FR, AR, EN)
- **Valider** automatiquement les adresses et assigner des quartiers
- **Gérer** les documents justificatifs dans Google Drive
- **Synchroniser** les contacts dans Google Contacts
- **Exposer** les données via une API REST sécurisée
- **Organiser** les familles pour les distributions (Zakat El Fitr, Sadaqa)

Le système traite automatiquement les soumissions de formulaires, valide les données, organise les documents et maintient une base de données propre et structurée dans Google Sheets.

---

## 📚 Documentation complète

La documentation est organisée en plusieurs fichiers pour faciliter la navigation :

### Documents principaux

| Document | Description | Lien |
|----------|-------------|------|
| **[INSTALLATION.md](docs/INSTALLATION.md)** | Guide d'installation complet avec clasp | [→ Voir](docs/INSTALLATION.md) |
| **[CONFIGURATION.md](docs/CONFIGURATION.md)** | Configuration du système (propriétés, sheets, formulaires, triggers) | [→ Voir](docs/CONFIGURATION.md) |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Architecture technique et flux de données | [→ Voir](docs/ARCHITECTURE.md) |
| **[API.md](docs/API.md)** | Documentation complète de l'API REST | [→ Voir](docs/API.md) |
| **[USAGE.md](docs/USAGE.md)** | Guide d'utilisation et scénarios pratiques | [→ Voir](docs/USAGE.md) |

### Documents de référence

| Document | Description |
|----------|-------------|
| **[COLUMN_MAPPING.md](docs/COLUMN_MAPPING.md)** | Mapping des colonnes multilingues |
| **[CODE_STRUCTURE.md](docs/CODE_STRUCTURE.md)** | Structure détaillée du code |
| **[WORKFLOWS.md](docs/WORKFLOWS.md)** | Workflows et diagrammes de flux |

---

## 🚀 Démarrage rapide

### Prérequis

- Compte Google Workspace
- Node.js 14+ (pour clasp)
- Accès à Google Sheets, Drive, Forms, Contacts

### Installation en 5 minutes

```bash
# 1. Installer clasp
npm install -g @google/clasp

# 2. Se connecter
clasp login

# 3. Créer le projet
clasp create --type sheets --title "Gestion Familles"

# 4. Déployer le code
cd Google_app_script
clasp push

# 5. Configurer les propriétés (voir CONFIGURATION.md)
```

➡️ **Guide complet** : [INSTALLATION.md](docs/INSTALLATION.md)

### Configuration minimale

Trois propriétés essentielles à configurer dans **Projet Settings** > **Script Properties** :

```javascript
SPREADSHEET_ID         = "1a2b3c4d..."  // ID de votre Google Sheet
GESTION_FAMILLES_FOLDER_ID = "1x2y3z..."  // ID du dossier Drive
GEO_API_URL           = "https://..."   // URL de l'API de géocodage
```

➡️ **Guide complet** : [CONFIGURATION.md](docs/CONFIGURATION.md)

### Premier test

```javascript
// Dans l'éditeur Apps Script
function test() {
    logInfo('Test du système');
    
    // Tester la configuration
    const config = getScriptConfig();
    console.log(config);
    
    // Tester l'accès aux sheets
    const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
    console.log('Sheet trouvée:', sheet.getName());
}
```

---

## 🏗️ Architecture

### Schéma de flux simplifié

```
Formulaire (FR/AR/EN) → Validation → Géocodage → Vérification doublons
                                                           ↓
                                    API REST ← Cache ← Sheet "Famille"
                                                           ↓
                            Google Contacts ← Organisation ← Google Drive
```

### Composants principaux

```
src/
├── core/              # Configuration et utilitaires
│   ├── config.js      # CONFIG, COLUMN_MAP, OUTPUT_COLUMNS
│   └── utils.js       # Fonctions réutilisables
│
├── handlers/          # Gestionnaires d'événements
│   ├── formHandler.js # onFormSubmit
│   └── editHandler.js # onEdit
│
├── services/          # Services externes
│   ├── driveService.js    # Organisation documents
│   ├── contactService.js  # Synchronisation contacts
│   └── geoService.js      # Géocodage et quartiers
│
├── api/               # REST API
│   └── familyApiHandler.js # doGet endpoints
│
└── ui/                # Interface utilisateur
    ├── menu.js        # Menu personnalisé
    └── helpers.js     # Inscription manuelle
```

➡️ **Documentation complète** : [ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## 📊 Fonctionnalités clés

### 1. Traitement automatique des formulaires

- Validation des champs obligatoires
- Géocodage et attribution de quartier
- Vérification des documents
- Détection des doublons
- Notification automatique

### 2. Gestion des documents

- Organisation automatique dans Drive
- Structure : `Gestion Familles/familles/FAM_ID/`
- Renommage selon le type : `identity_1.pdf`, `CAF_1.pdf`

### 3. Synchronisation Google Contacts

- Création/mise à jour automatique
- Stockage de l'ID famille dans les notes
- Support multi-téléphones et adresses

### 4. API REST

8 endpoints disponibles pour l'intégration externe :

- `/allfamilies` - Liste complète
- `/familybyid` - Détails d'une famille
- `/familieszakatfitr` - Éligibles Zakat El Fitr
- `/familiesbyquartier` - Par quartier
- Et plus...

➡️ **Documentation API** : [API.md](docs/API.md)

### 5. Cache multi-niveaux

- SHORT (5 min) - Requêtes fréquentes
- MEDIUM (30 min) - Données semi-statiques
- LONG (1h) - Configuration
- VERY_LONG (6h) - Données quasi-immuables

---

## 🎯 Utilisation rapide

### Traiter une nouvelle demande

1. La famille soumet le formulaire
2. Le système valide et géocode automatiquement
3. L'admin vérifie dans l'onglet "Famille"
4. Changement du statut : `Recu` → `En cours` → `Validé`
5. À la validation :
   - Documents organisés
   - Contact créé
   - Cache actualisé

### Inscription manuelle

Menu : **📦 Gestion Familles** > **➕ Inscription Manuelle**

Formulaire graphique avec :

- Validation en temps réel
- Vérification des doublons
- Création immédiate avec statut "Validé"
- Pas besoin de documents (optionnels)

### API - Exemple rapide

```bash
# Liste toutes les familles validées
curl "https://script.google.com/.../exec?action=allfamilies"

# Familles d'un quartier
curl "https://script.google.com/.../exec?action=familiesbyquartier&quartierId=Q_001"

# Éligibles Zakat El Fitr
curl "https://script.google.com/.../exec?action=familieszakatfitr"
```

➡️ **Guide complet** : [USAGE.md](docs/USAGE.md)

---

## 🧪 Tests

### Tests unitaires

```javascript
// Dans l'éditeur Apps Script
runAllTests();  // Tous les tests

// Ou individuellement
testNormalizePhone();
testIsValidEmail();
testExtractFileIds();
```

### Tests d'intégration

```javascript
// Test du flux complet
testFullSubmissionFlow();

// Test de l'API
testApiEndpoints();
```

➡️ **Guide des tests** : [TESTING.md](docs/TESTING.md)

---

## 🔧 Dépannage rapide

| Problème | Solution rapide |
|----------|----------------|
| Trigger ne fonctionne pas | Vérifier dans Triggers (icône horloge), recréer si nécessaire |
| Erreur "Service invoked too many times" | Ajouter `Utilities.sleep(100)` dans les boucles |
| Documents non organisés | Vérifier l'ID du dossier Drive dans les propriétés |
| API retourne 404 | Vérifier le déploiement Web App et l'URL |
| Cache obsolète | Menu : **📦 Gestion Familles** > **🔄 Rafraîchir Cache** |

➡️ **Guide complet** : [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## 📈 Monitoring

### Vérifications quotidiennes

```javascript
// Statistiques
function dailyStats() {
    const stats = calculateStatistics();
    console.log(`Total: ${stats.total}`);
    console.log(`Validées: ${stats.validated}`);
    console.log(`En cours: ${stats.inProgress}`);
}
```

### Logs

- **Executions** : Apps Script Editor > Executions
- **Logs** : Afficher les logs de chaque exécution
- **Erreurs** : Filtrer par "Failed" pour voir les échecs

➡️ **Guide maintenance** : [MAINTENANCE.md](docs/MAINTENANCE.md)

---

## 🤝 Support

### Problème avec le système ?

1. Consulter [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
2. Vérifier les logs dans Apps Script
3. Tester avec les fonctions de test unitaire

### Questions sur l'utilisation ?

1. Consulter [USAGE.md](docs/USAGE.md) pour les scénarios courants
2. Consulter [API.md](docs/API.md) pour l'intégration

### Besoin d'aide pour l'installation ?

1. Suivre [INSTALLATION.md](docs/INSTALLATION.md) pas-à-pas
2. Vérifier [CONFIGURATION.md](docs/CONFIGURATION.md) pour la configuration

---

## 📝 Changelog

### Version 1.0.0 (Décembre 2025)

- ✅ Traitement automatique des formulaires multilingues
- ✅ Validation d'adresses avec géocodage
- ✅ Gestion des documents Drive
- ✅ Synchronisation Google Contacts
- ✅ API REST avec 8 endpoints
- ✅ Cache multi-niveaux
- ✅ Détection des doublons
- ✅ Inscription manuelle via UI
- ✅ Tests unitaires complets

---

## 📄 Licence

Ce projet est destiné à un usage interne pour la gestion des familles bénéficiaires.

---

## 🔗 Liens rapides

- [Installation](docs/INSTALLATION.md)
- [Configuration](docs/CONFIGURATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Utilisation](docs/USAGE.md)
- [Tests](docs/TESTING.md)
- [Dépannage](docs/TROUBLESHOOTING.md)
- [Maintenance](docs/MAINTENANCE.md)
