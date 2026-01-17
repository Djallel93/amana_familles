# 🌐 Documentation API REST

## Table des matières

- [Vue d'ensemble](#-vue-densemble)
- [Déploiement](#-déploiement)
- [Authentification](#-authentification)
- [Endpoints](#-endpoints)
- [Exemples d'utilisation](#-exemples-dutilisation)
- [Gestion du cache](#-gestion-du-cache)
- [Codes d'erreur](#-codes-derreur)
- [Limites et quotas](#-limites-et-quotas)
- [Bonnes pratiques](#-bonnes-pratiques)

---

## 🎯 Vue d'ensemble

L'API REST permet d'accéder aux données des familles de manière programmatique depuis n'importe quelle application externe.

### Caractéristiques

- **Format** : JSON
- **Méthode** : GET uniquement (lecture seule)
- **Cache** : Réponses mises en cache (5 min à 6 heures)
- **Sécurité** : Peut être configurée avec authentification
- **Rate limiting** : Limites Google Apps Script (voir section Quotas)

### URL de base

Après le déploiement, l'URL aura ce format :

```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

---

## 🚀 Déploiement

### Déployer l'API comme Web App

#### Étape 1 : Créer un déploiement

1. Dans l'éditeur Apps Script
2. Cliquez sur **Deploy** > **New deployment**
3. Type : **Web app**
4. Configuration :

```
Description : API Gestion Familles v1.0
Execute as : Me (votre email)
Who has access : Anyone (ou selon vos besoins)
```

5. Cliquez sur **Deploy**
6. Copiez l'**URL Web app**

#### Étape 2 : Options d'accès

**Option 1 : Anyone (Public)**

- Accessible sans authentification
- ⚠️ Attention : données publiques
- Recommandé pour : données non sensibles

**Option 2 : Anyone with Google account**

- Nécessite une connexion Google
- Utilisateur doit autoriser l'accès
- Recommandé pour : données semi-publiques

**Option 3 : Only myself**

- Accessible uniquement par vous
- Recommandé pour : tests et développement

### Déploiement par script

```javascript
function deployAsWebApp() {
  // Cette fonction nécessite clasp pour créer un déploiement
  console.log('Utilisez l\'interface ou clasp pour déployer');
  console.log('Commande : clasp deploy --description "API v1.0"');
}
```

### Mise à jour du déploiement

#### Méthode 1 : Nouveau déploiement

1. **Deploy** > **New deployment**
2. Choisir une nouvelle description (v1.1, v1.2, etc.)
3. L'URL changera

#### Méthode 2 : Gérer les déploiements

1. **Deploy** > **Manage deployments**
2. Cliquez sur l'icône ✏️ du déploiement actif
3. Cliquez sur **New version**
4. L'URL reste identique

### Test du déploiement

```bash
# Test simple avec curl
curl "https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?action=ping"

# Réponse attendue
{
  "status": "ok",
  "message": "Famille API operational",
  "timestamp": "2025-12-17T14:30:25.123Z"
}
```

---

## 🔐 Authentification

### API publique (Anyone)

Aucune authentification requise :

```javascript
fetch('https://script.google.com/.../exec?action=allfamilies')
  .then(res => res.json())
  .then(data => console.log(data));
```

### API avec authentification Google

Si configuré avec "Anyone with Google account" :

```javascript
// L'utilisateur doit autoriser l'accès
// Google Apps Script gère automatiquement l'authentification
```

### Sécurité supplémentaire (Optionnel)

Ajoutez une clé API dans les paramètres :

```javascript
// Dans doGet, ajoutez :
function doGet(e) {
    const API_KEY = getProperty('API_KEY');
    
    if (e.parameter.apikey !== API_KEY) {
        return jsonResponse({ error: 'Invalid API key' }, 401);
    }
    
    // ... reste du code
}

// Utilisation
fetch('https://script.google.com/.../exec?action=ping&apikey=VOTRE_CLE')
```

---

## 📡 Endpoints

### 1. Ping / Healthcheck

Vérifier que l'API est opérationnelle.

```http
GET /?action=ping
```

**Paramètres** : Aucun

**Réponse** :

```json
{
  "status": "ok",
  "message": "Famille API operational",
  "timestamp": "2025-12-17T14:30:25.123Z"
}
```

**Cache** : Aucun

---

### 2. Toutes les familles

Récupérer toutes les familles validées.

```http
GET /?action=allfamilies
```

**Paramètres** : Aucun

**Réponse** :

```json
{
  "count": 45,
  "families": [
    {
      "id": "FAM_1234567890_123",
      "nom": "Dupont",
      "prenom": "Marie",
      "zakatElFitr": true,
      "sadaqa": false,
      "nombreAdulte": 2,
      "nombreEnfant": 3,
      "adresse": "1 Rue de la Paix, 44000 Nantes",
      "idQuartier": "Q_001",
      "seDeplace": false,
      "email": "marie.dupont@example.com",
      "telephone": "0612345678",
      "telephoneBis": "0623456789",
      "circonstances": "Situation difficile suite à perte d'emploi",
      "ressentit": "Famille courageuse",
      "specificites": "Enfant avec allergies alimentaires"
    },
    // ... autres familles
  ]
}
```

**Cache** : 5 minutes (SHORT)

---

### 3. Famille par ID

Récupérer les détails d'une famille spécifique.

```http
GET /?action=familybyid&id={FAMILY_ID}
```

**Paramètres** :

| Paramètre | Type   | Requis | Description                               |
| --------- | ------ | ------ | ----------------------------------------- |
| `id`      | string | ✅      | ID de la famille (ex: FAM_1234567890_123) |

**Réponse** :

```json
{
  "id": "FAM_1234567890_123",
  "nom": "Dupont",
  "prenom": "Marie",
  "zakatElFitr": true,
  "sadaqa": false,
  "nombreAdulte": 2,
  "nombreEnfant": 3,
  "adresse": "1 Rue de la Paix, 44000 Nantes",
  "idQuartier": "Q_001",
  "seDeplace": false,
  "email": "marie.dupont@example.com",
  "telephone": "0612345678",
  "telephoneBis": "0623456789",
  "circonstances": "Situation difficile suite à perte d'emploi",
  "ressentit": "Famille courageuse",
  "specificites": "Enfant avec allergies alimentaires"
}
```

**Erreurs** :

```json
{
  "error": "Family not found"
}
```

**Cache** : 30 minutes (MEDIUM)

---

### 4. Adresse d'une famille

Récupérer uniquement l'adresse d'une famille.

```http
GET /?action=familyaddressbyid&id={FAMILY_ID}
```

**Paramètres** :

| Paramètre | Type   | Requis | Description      |
| --------- | ------ | ------ | ---------------- |
| `id`      | string | ✅      | ID de la famille |

**Réponse** :

```json
{
  "id": "FAM_1234567890_123",
  "nom": "Dupont",
  "prenom": "Marie",
  "adresse": "1 Rue de la Paix, 44000 Nantes",
  "idQuartier": "Q_001"
}
```

**Cache** : 30 minutes (MEDIUM)

---

### 5. Familles éligibles Zakat El Fitr

Récupérer les familles marquées comme éligibles pour Zakat El Fitr.

```http
GET /?action=familieszakatfitr
```

**Paramètres** : Aucun

**Réponse** :

```json
{
  "count": 25,
  "families": [
    {
      "id": "FAM_1234567890_123",
      "nom": "Dupont",
      "prenom": "Marie",
      "zakatElFitr": true,
      "nombreAdulte": 2,
      "nombreEnfant": 3,
      // ... autres champs
    }
  ]
}
```

**Cache** : 5 minutes (SHORT)

---

### 6. Familles éligibles Sadaqa

Récupérer les familles marquées comme éligibles pour Sadaqa.

```http
GET /?action=familiessadaka
```

**Paramètres** : Aucun

**Réponse** :

```json
{
  "count": 30,
  "families": [
    {
      "id": "FAM_1234567890_456",
      "nom": "Martin",
      "prenom": "Jean",
      "sadaqa": true,
      "nombreAdulte": 1,
      "nombreEnfant": 2,
      // ... autres champs
    }
  ]
}
```

**Cache** : 5 minutes (SHORT)

---

### 7. Familles par quartier

Récupérer les familles d'un quartier spécifique.

```http
GET /?action=familiesbyquartier&quartierId={QUARTIER_ID}
```

**Paramètres** :

| Paramètre    | Type   | Requis | Description                |
| ------------ | ------ | ------ | -------------------------- |
| `quartierId` | string | ✅      | ID du quartier (ex: Q_001) |

**Réponse** :

```json
{
  "quartierId": "Q_001",
  "count": 12,
  "families": [
    {
      "id": "FAM_1234567890_123",
      "nom": "Dupont",
      "prenom": "Marie",
      "idQuartier": "Q_001",
      "adresse": "1 Rue de la Paix, 44000 Nantes",
      // ... autres champs
    }
  ]
}
```

**Cache** : 5 minutes (SHORT)

---

### 8. Familles pouvant se déplacer

Récupérer les familles qui peuvent se déplacer (seDeplace = true).

```http
GET /?action=familiessedeplace
```

**Paramètres** : Aucun

**Réponse** :

```json
{
  "count": 8,
  "families": [
    {
      "id": "FAM_1234567890_789",
      "nom": "Bernard",
      "prenom": "Sophie",
      "seDeplace": true,
      "telephone": "0634567890",
      // ... autres champs
    }
  ]
}
```

**Cache** : 5 minutes (SHORT)

---

## 💻 Exemples d'utilisation

### JavaScript / Fetch API

#### Exemple basique

```javascript
const API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

async function getAllFamilies() {
  try {
    const response = await fetch(`${API_URL}?action=allfamilies`);
    const data = await response.json();
    
    console.log(`Total: ${data.count} familles`);
    return data.families;
  } catch (error) {
    console.error('Erreur API:', error);
  }
}

// Utilisation
getAllFamilies().then(families => {
  families.forEach(f => {
    console.log(`${f.prenom} ${f.nom} - ${f.adresse}`);
  });
});
```

#### Exemple avec gestion d'erreurs

```javascript
async function getFamilyById(familyId) {
  try {
    const response = await fetch(
      `${API_URL}?action=familybyid&id=${familyId}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data;
  } catch (error) {
    console.error('Erreur:', error.message);
    return null;
  }
}

// Utilisation
getFamilyById('FAM_1234567890_123').then(family => {
  if (family) {
    console.log(`Famille trouvée: ${family.prenom} ${family.nom}`);
  } else {
    console.log('Famille non trouvée');
  }
});
```

#### Application React complète

```javascript
import React, { useState, useEffect } from 'react';

const API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

function FamilyList() {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadFamilies();
  }, [filter]);

  const loadFamilies = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let action = 'allfamilies';
      if (filter === 'zakatfitr') action = 'familieszakatfitr';
      if (filter === 'sadaka') action = 'familiessadaka';
      
      const response = await fetch(`${API_URL}?action=${action}`);
      const data = await response.json();
      
      setFamilies(data.families || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error}</div>;

  return (
    <div>
      <h1>Liste des Familles ({families.length})</h1>
      
      <select value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">Toutes</option>
        <option value="zakatfitr">Zakat El Fitr</option>
        <option value="sadaka">Sadaqa</option>
      </select>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Téléphone</th>
            <th>Quartier</th>
            <th>Adultes</th>
            <th>Enfants</th>
          </tr>
        </thead>
        <tbody>
          {families.map(f => (
            <tr key={f.id}>
              <td>{f.id}</td>
              <td>{f.nom}</td>
              <td>{f.prenom}</td>
              <td>{f.telephone}</td>
              <td>{f.idQuartier}</td>
              <td>{f.nombreAdulte}</td>
              <td>{f.nombreEnfant}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default FamilyList;
```

### Python

#### Exemple basique

```python
import requests

API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'

def get_all_families():
    """Récupérer toutes les familles"""
    response = requests.get(f'{API_URL}?action=allfamilies')
    data = response.json()
    return data['families']

def get_family_by_id(family_id):
    """Récupérer une famille par ID"""
    response = requests.get(
        f'{API_URL}?action=familybyid&id={family_id}'
    )
    return response.json()

def get_families_by_quartier(quartier_id):
    """Récupérer les familles d'un quartier"""
    response = requests.get(
        f'{API_URL}?action=familiesbyquartier&quartierId={quartier_id}'
    )
    data = response.json()
    return data['families']

# Utilisation
if __name__ == '__main__':
    # Toutes les familles
    families = get_all_families()
    print(f'Total: {len(families)} familles')
    
    # Famille spécifique
    family = get_family_by_id('FAM_1234567890_123')
    print(f"Famille: {family['prenom']} {family['nom']}")
    
    # Par quartier
    families_q1 = get_families_by_quartier('Q_001')
    print(f'Quartier Q_001: {len(families_q1)} familles')
```

#### Classe wrapper complète

```python
import requests
from typing import List, Dict, Optional

class FamilyAPI:
    def __init__(self, api_url: str):
        self.api_url = api_url
        self.session = requests.Session()
    
    def _get(self, action: str, params: Dict = None) -> Dict:
        """Requête GET générique"""
        query_params = {'action': action}
        if params:
            query_params.update(params)
        
        response = self.session.get(self.api_url, params=query_params)
        response.raise_for_status()
        return response.json()
    
    def ping(self) -> Dict:
        """Vérifier l'état de l'API"""
        return self._get('ping')
    
    def get_all_families(self) -> List[Dict]:
        """Récupérer toutes les familles"""
        data = self._get('allfamilies')
        return data.get('families', [])
    
    def get_family(self, family_id: str) -> Optional[Dict]:
        """Récupérer une famille par ID"""
        try:
            return self._get('familybyid', {'id': family_id})
        except requests.HTTPError:
            return None
    
    def get_family_address(self, family_id: str) -> Optional[Dict]:
        """Récupérer l'adresse d'une famille"""
        try:
            return self._get('familyaddressbyid', {'id': family_id})
        except requests.HTTPError:
            return None
    
    def get_zakat_fitr_families(self) -> List[Dict]:
        """Récupérer les familles éligibles Zakat El Fitr"""
        data = self._get('familieszakatfitr')
        return data.get('families', [])
    
    def get_sadaka_families(self) -> List[Dict]:
        """Récupérer les familles éligibles Sadaqa"""
        data = self._get('familiessadaka')
        return data.get('families', [])
    
    def get_families_by_quartier(self, quartier_id: str) -> List[Dict]:
        """Récupérer les familles d'un quartier"""
        data = self._get('familiesbyquartier', {'quartierId': quartier_id})
        return data.get('families', [])
    
    def get_mobile_families(self) -> List[Dict]:
        """Récupérer les familles pouvant se déplacer"""
        data = self._get('familiessedeplace')
        return data.get('families', [])

# Utilisation
api = FamilyAPI('https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec')

# Vérifier l'API
status = api.ping()
print(f"API Status: {status['status']}")

# Récupérer toutes les familles
families = api.get_all_families()
print(f"Total: {len(families)} familles")

# Filtrer par critères
zakat_families = api.get_zakat_fitr_families()
print(f"Zakat El Fitr: {len(zakat_families)} familles")

# Par quartier
q1_families = api.get_families_by_quartier('Q_001')
for family in q1_families:
    print(f"- {family['prenom']} {family['nom']}: {family['telephone']}")
```

### cURL

#### Exemples basiques

```bash
# Ping
curl "https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=ping"

# Toutes les familles
curl "https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=allfamilies"

# Famille par ID
curl "https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=familybyid&id=FAM_1234567890_123"

# Familles Zakat El Fitr
curl "https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=familieszakatfitr"

# Par quartier
curl "https://script.google.com/macros/s/DEPLOYMENT_ID/exec?action=familiesbyquartier&quartierId=Q_001"
```

#### Avec formatage JSON (jq)

```bash
# Compter les familles
curl -s "https://script.google.com/.../exec?action=allfamilies" | jq '.count'

# Extraire les noms
curl -s "https://script.google.com/.../exec?action=allfamilies" | \
  jq '.families[] | "\(.prenom) \(.nom)"'

# Filtrer par nombre d'enfants > 3
curl -s "https://script.google.com/.../exec?action=allfamilies" | \
  jq '.families[] | select(.nombreEnfant > 3)'

# Grouper par quartier
curl -s "https://script.google.com/.../exec?action=allfamilies" | \
  jq 'group_by(.idQuartier) | map({quartier: .[0].idQuartier, count: length})'
```

#### Script bash complet

```bash
#!/bin/bash

API_URL="https://script.google.com/macros/s/DEPLOYMENT_ID/exec"

# Fonction pour faire une requête
api_call() {
    local action=$1
    local params=$2
    curl -s "${API_URL}?action=${action}${params}"
}

# Statistiques
echo "=== Statistiques ==="
all_data=$(api_call "allfamilies")
total=$(echo "$all_data" | jq '.count')
echo "Total familles: $total"

zakat_count=$(api_call "familieszakatfitr" | jq '.count')
echo "Zakat El Fitr: $zakat_count"

sadaka_count=$(api_call "familiessadaka" | jq '.count')
echo "Sadaqa: $sadaka_count"

mobile_count=$(api_call "familiessedeplace" | jq '.count')
echo "Peuvent se déplacer: $mobile_count"

# Liste par quartier
echo ""
echo "=== Par quartier ==="
echo "$all_data" | jq -r '.families | group_by(.idQuartier) | .[] | 
  "\(.[0].idQuartier): \(length) familles"'
```

---

## 🗄️ Gestion du cache

### Durées de cache

```javascript
CONFIG.CACHE = {
    SHORT: 300,      // 5 minutes - Données fréquemment mises à jour
    MEDIUM: 1800,    // 30 minutes - Données semi-statiques
    LONG: 3600,      // 1 heure - Configuration
    VERY_LONG: 21600 // 6 heures - Données quasi-immuables
}
```

### Par endpoint

| Endpoint             | Cache  | Raison                |
| -------------------- | ------ | --------------------- |
| `ping`               | Aucun  | Healthcheck           |
| `allfamilies`        | 5 min  | Mise à jour fréquente |
| `familybyid`         | 30 min | Changements rares     |
| `familyaddressbyid`  | 30 min | Changements rares     |
| `familieszakatfitr`  | 5 min  | Liste dynamique       |
| `familiessadaka`     | 5 min  | Liste dynamique       |
| `familiesbyquartier` | 5 min  | Liste dynamique       |
| `familiessedeplace`  | 5 min  | Liste dynamique       |

### Rafraîchir le cache

#### Via l'interface

Menu Google Sheets : **📦 Gestion Familles** > **🔄 Rafraîchir Cache**

#### Par script

```javascript
function clearAPICache() {
  const cache = CacheService.getScriptCache();
  cache.removeAll([
    'api_all_families',
    'api_zakat_fitr',
    'api_sadaka',
    'api_se_deplace_true'
  ]);
  console.log('✓ Cache API effacé');
}
```

---

## ❌ Codes d'erreur

### Codes HTTP

| Code | Signification         | Description                    |
| ---- | --------------------- | ------------------------------ |
| 200  | OK                    | Requête réussie                |
| 400  | Bad Request           | Paramètre manquant ou invalide |
| 404  | Not Found             | Ressource non trouvée          |
| 500  | Internal Server Error | Erreur serveur                 |

### Format des erreurs

```json
{
  "error": "Message d'erreur détaillé"
}
```

### Exemples

```json
// Paramètre manquant
{
  "error": "Missing action parameter"
}

// Action inconnue
{
  "error": "Unknown action"
}

// Famille non trouvée
{
  "error": "Family not found"
}

// Erreur serveur
{
  "error": "Sheet not found"
}
```

---

## ⚠️ Limites et quotas

### Quotas Google Apps Script

| Limite         | Valeur | Par            |
| -------------- | ------ | -------------- |
| URL Fetches    | 20,000 | Jour           |
| Script runtime | 6 min  | Exécution      |
| Triggers       | 90 min | Jour (gratuit) |
| Script size    | 50 MB  | Projet         |

### Recommandations

1. **Utiliser le cache** : Minimise les requêtes répétées
2. **Batch les requêtes** : Utiliser `allfamilies` plutôt que plusieurs `familybyid`
3. **Rate limiting côté client** : Espacer les requêtes
4. **Pagination** : Pour les grandes listes (à implémenter si nécessaire)

### Implémenter la pagination (optionnel)

```javascript
function getAllFamilies(e) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'api_all_families';
  
  // Paramètres de pagination
  const page = parseInt(e.parameter.page) || 1;
  const perPage = parseInt(e.parameter.perPage) || 50;
  
  const cached = cache.get(cacheKey);
  if (cached) {
    const allFamilies = JSON.parse(cached);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginatedFamilies = allFamilies.slice(start, end);
    
    return jsonResponse({
      page: page,
      perPage: perPage,
      total: allFamilies.length,
      totalPages: Math.ceil(allFamilies.length / perPage),
      families: paginatedFamilies
    });
  }
  
  // ... reste du code
}
```

---

## ✅ Bonnes pratiques

### 1. Gestion des erreurs

```javascript
async function safeApiCall(action, params = {}) {
  try {
    const queryString = new URLSearchParams({ action, ...params });
    const response = await fetch(`${API_URL}?${queryString}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    // Gérer l'erreur (retry, fallback, notification, etc.)
    throw error;
  }
}
```

### 2. Cache côté client

```javascript
class FamilyAPIClient {
  constructor(apiUrl, cacheDuration = 5 * 60 * 1000) {
    this.apiUrl = apiUrl;
    this.cacheDuration = cacheDuration;
    this.cache = new Map();
  }
  
  async get(action, params = {}) {
    const cacheKey = JSON.stringify({ action, params });
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }
    
    const data = await this._fetch(action, params);
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    
    return data;
  }
  
  async _fetch(action, params) {
    const queryString = new URLSearchParams({ action, ...params });
    const response = await fetch(`${this.apiUrl}?${queryString}`);
    return response.json();
  }
  
  clearCache() {
    this.cache.clear();
  }
}

// Utilisation
const api = new FamilyAPIClient(API_URL);
const families = await api.get('allfamilies');
```

### 3. Retry logic

```javascript
async function apiCallWithRetry(action, params = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await safeApiCall(action, params);
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Attente exponentielle: 1s, 2s, 4s
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 4. Logging et monitoring

```javascript
class MonitoredAPIClient {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
    this.stats = {
      requests: 0,
      errors: 0,
      totalTime: 0
    };
  }
  
  async call(action, params = {}) {
    const startTime = Date.now();
    this.stats.requests++;
    
    try {
      const data = await safeApiCall(action, params);
      this.stats.totalTime += Date.now() - startTime;
      return data;
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }
  
  getStats() {
    return {
      ...this.stats,
      avgTime: this.stats.requests > 0 
        ? this.stats.totalTime / this.stats.requests 
        : 0,
      errorRate: this.stats.requests > 0
        ? (this.stats.errors / this.stats.requests) * 100
        : 0
    };
  }
}
```

### 5. Variables d'environnement

```javascript
// config.js
const config = {
  development: {
    apiUrl: 'https://script.google.com/macros/s/DEV_ID/exec'
  },
  production: {
    apiUrl: 'https://script.google.com/macros/s/PROD_ID/exec'
  }
};

const env = process.env.NODE_ENV || 'development';
export const API_URL = config[env].apiUrl;
```

---

## 🔄 Webhooks (Avancé)

Pour recevoir des notifications lors de changements :

```javascript
// Dans formHandler.js, ajouter :
function notifyWebhook(familyData, event) {
  const webhookUrl = getProperty('WEBHOOK_URL');
  if (!webhookUrl) return;
  
  const payload = {
    event: event, // 'created', 'updated', 'validated'
    timestamp: new Date().toISOString(),
    family: {
      id: familyData.id,
      nom: familyData.nom,
      prenom: familyData.prenom,
      quartier: familyData.idQuartier
    }
  };
  
  try {
    UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    logError('Webhook notification failed', e);
  }
}
```

---

[← Configuration](CONFIGURATION.md) | [Retour au README principal](../README.md) | [Utilisation →](USAGE.md)
