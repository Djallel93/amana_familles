# 📦 Family Delivery Management System

Production-ready Google Apps Script system for managing family delivery registrations via multilingual Google Forms (FR/AR/EN) with automatic validation, geocoding, and document organization.

## 📂 Project Structure

```txt
├── Google_app_script/
│   ├── appsscript.json                 # Apps Script manifest
│   ├── .claspignore                    # Files to ignore when pushing
│   ├── assets/
│   │   └── css/
│   │       └── styles.html             # Shared CSS styles
│   ├── src/
│   │   ├── api/
│   │   │   └── familyApiHandler.js     # REST API endpoints
│   │   ├── core/
│   │   │   ├── config.js               # Configuration & constants
│   │   │   └── utils.js                # Utility functions
│   │   ├── handlers/
│   │   │   ├── editHandler.js          # OnEdit trigger handler
│   │   │   └── formHandler.js          # Form submission handler
│   │   ├── services/
│   │   │   ├── contactService.js       # Google Contacts sync
│   │   │   ├── driveService.js         # Document management
│   │   │   └── geoService.js           # Geocoding & quartier API
│   │   └── ui/
│   │       ├── helpers.js              # UI helper functions
│   │       └── menu.js                 # Spreadsheet menu
│   ├── tests/
│   │   └── tests.js                    # Unit tests
│   └── views/
│       └── dialogs/
│           └── manualEntry.html        # Manual entry form
└── README.md
```

## 🚀 Features

✅ **Multilingual Form Support** - French, Arabic, English  
✅ **Address Validation & Geocoding** - Via external GEO API  
✅ **Automatic Document Organization** - Drive folder structure per family  
✅ **Google Contacts Sync** - Auto-create/update contacts  
✅ **Duplicate Detection** - Phone + last name matching  
✅ **Smart Caching** - Minimized API calls (free tier optimized)  
✅ **REST API** - 8 endpoints for external access  
✅ **Manual Entry UI** - Admin dialog for direct family registration  
✅ **Modular Architecture** - Clean separation of concerns

## 🛠️ Installation

### Prerequisites

1. **Google Account** with access to:
   - Google Sheets
   - Google Drive
   - Google Forms
   - Google Apps Script
   - Google Contacts

2. **External GEO API** credentials:
   - API URL
   - API Key

3. **clasp** (Google Apps Script CLI):

   ```bash
   npm install -g @google/clasp
   clasp login
   ```

### Step 1: Clone or Create Project

```bash
# Create new Apps Script project
clasp create --type sheets --title "Family Delivery Management"

# Or clone existing project
clasp clone <SCRIPT_ID>
```

### Step 2: Setup Project Structure

```bash
# Copy all files from this repository into your local folder
# Make sure the structure matches the one shown above
```

### Step 3: Configure Script Properties

1. Open your project in Apps Script editor:

   ```bash
   clasp open
   ```

2. Go to **Project Settings** → **Script Properties**

3. Add the following properties:

   ```
   GESTION_FAMILLES_FOLDER_ID = [Your main Drive folder ID]
   SPREADSHEET_ID = [Your Google Sheets ID]
   GEO_API_URL = [Your GEO API endpoint URL]
   ```

### Step 4: Enable APIs

In the Apps Script editor:

1. Click **Services** (+)
2. Add **People API** (Google Contacts)

### Step 5: Push Code

```bash
cd Google_app_script
clasp push
```

### Step 6: Setup Triggers

In Apps Script editor → **Triggers**:

1. **Form Submission Trigger**
   - Function: `handleFormSubmission`
   - Event source: From spreadsheet
   - Event type: On form submit

2. **Edit Trigger**
   - Function: `handleEdit`
   - Event source: From spreadsheet
   - Event type: On edit

3. **Open Trigger** (Optional)
   - Function: `onOpen`
   - Event source: From spreadsheet
   - Event type: On open

### Step 7: Deploy Web App (for API)

```bash
# Deploy via command line
clasp deploy --description "v1.0 - Initial release"

# Or deploy via editor:
# Click Deploy → New deployment → Web app
# Execute as: Me
# Who has access: Anyone (or as needed)
```

## 📊 Google Sheets Structure

### Form Response Sheets

Create three sheets for multilingual forms:

- `Familles – FR` (French)
- `Familles – AR` (Arabic)
- `Familles – EN` (English)

### Output Sheet

`Famille (Cleaned & Enriched)` with columns:

| Column              | Type     | Description         |
| ------------------- | -------- | ------------------- |
| id                  | Text     | Unique family ID    |
| nom                 | Text     | Last name           |
| prenom              | Text     | First name          |
| zakat_el_fitr       | Checkbox | Eligible for Zakat  |
| sadaqa              | Checkbox | Eligible for Sadaqa |
| nombre_adulte       | Number   | Number of adults    |
| nombre_enfant       | Number   | Number of children  |
| adresse             | Text     | Full address        |
| id_quartier         | Number   | Quartier ID         |
| se_deplace          | Checkbox | Can travel          |
| email               | Email    | Contact email       |
| telephone           | Text     | Phone number        |
| telephone_bis       | Text     | Secondary phone     |
| identite            | Text     | Identity doc links  |
| caf                 | Text     | CAF doc links       |
| circonstances       | Text     | Current situation   |
| ressentit           | Text     | Notes               |
| specificites        | Text     | Special needs       |
| etat_dossier        | Text     | Status              |
| commentaire_dossier | Text     | Comments            |

## 🔄 Workflows

### Automatic Form Submission

```
User submits form (FR/AR/EN)
    ↓
Validate fields, address, documents
    ↓
Check for duplicates
    ↓
Write to "Famille" sheet (status: "En cours")
    ↓
Admin notified
    ↓
Admin reviews and sets status to "Validé"
    ↓
Documents organized + Contact synced
```

### Manual Entry

```
Admin opens: 📦 Gestion Familles → ➕ Inscription Manuelle
    ↓
Fills form with family data
    ↓
Validates address
    ↓
Checks for duplicates
    ↓
Saves with status "Validé"
    ↓
Contact created immediately
```

## 🌐 API Endpoints

### Base URL

```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

### Available Endpoints

| Action               | Parameters   | Description                  |
| -------------------- | ------------ | ---------------------------- |
| `ping`               | -            | Health check                 |
| `allfamilies`        | -            | Get all validated families   |
| `familybyid`         | `id`         | Get specific family          |
| `familyaddressbyid`  | `id`         | Get family address only      |
| `familieszakatfitr`  | -            | Get Zakat eligible families  |
| `familiessadaka`     | -            | Get Sadaqa eligible families |
| `familiesbyquartier` | `quartierId` | Get families by quartier     |
| `familiessedeplace`  | -            | Get families who can travel  |

### Example Request

```bash
curl "https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=allfamilies"
```

### Example Response

```json
{
  "count": 25,
  "families": [
    {
      "id": "FAM_1234567890_123",
      "nom": "Dupont",
      "prenom": "Jean",
      "nombreAdulte": 2,
      "nombreEnfant": 3,
      "adresse": "1 Rue de la Paix, 44000 Nantes",
      "idQuartier": 42,
      "telephone": "0612345678",
      "email": "jean.dupont@example.com"
    }
  ]
}
```

## 🧪 Testing

Run tests in Apps Script editor:

```javascript
runAllTests()
```

Or test individual functions:

```javascript
testNormalizePhone()
testIsValidEmail()
testIsValidPhone()
```

## ⚡ Performance Optimization

### Caching Strategy

| Data Type         | Cache Duration |
| ----------------- | -------------- |
| Script Properties | 6 hours        |
| GEO API Results   | 6 hours        |
| Family Lookups    | 30 minutes     |
| API Responses     | 5 minutes      |

### Best Practices

✅ Batch operations when possible  
✅ Cache everything that doesn't change often  
✅ Lazy load data only when needed  
✅ Minimize sheet access  
✅ Use aggressive caching on free tier

## 🔧 Development

### Local Development with clasp

```bash
# Pull latest changes
clasp pull

# Make changes locally

# Push to Apps Script
clasp push

# Watch for changes (auto-push)
clasp push --watch
```

### File Organization

- **Core** (`src/core/`) - Configuration and utilities (no dependencies)
- **Services** (`src/services/`) - External integrations (Drive, Contacts, GEO API)
- **Handlers** (`src/handlers/`) - Business logic (form processing, edits)
- **API** (`src/api/`) - REST endpoints
- **UI** (`src/ui/`) - Menu and dialogs
- **Views** (`views/`) - HTML templates
- **Assets** (`assets/`) - Shared CSS/JS

## 🐛 Debugging

### View Execution Logs

In Apps Script editor:

1. Click **Executions**
2. Find your execution
3. View logs and errors

### Common Issues

**"Sheet not found"**

- Check sheet names match `CONFIG.SHEETS` in `config.js`

**"GEO API call failed"**

- Verify credentials in Script Properties
- Check API endpoint URL

**"Contact sync failed"**

- Enable People API in Services
- Check OAuth scopes in `appsscript.json`

**"Documents not organized"**

- Verify Drive folder permissions
- Check `GESTION_FAMILLES_FOLDER_ID`

## 📝 Maintenance

### Update Configuration

Edit `src/core/config.js` to update:

- Sheet names
- Column mappings
- Cache durations
- Status values

### Clear Caches

In spreadsheet: **📦 Gestion Familles** → **🔄 Rafraîchir Cache**

### View Statistics

In spreadsheet: **📦 Gestion Familles** → **📊 Statistiques**

## 🔒 Security

- Script properties store sensitive data (API keys)
- API endpoints return only validated families
- Document access controlled via Drive permissions
- No authentication required for public forms
- OAuth scopes defined in `appsscript.json`

## 📄 License

Internal use - AMANA Organization

## 🤝 Support

For issues:

1. Check execution logs first
2. Review common issues above
3. Verify script properties
4. Test with `runAllTests()`
