# 📖 Guide d'utilisation

## Table des matières

- [Accès au système](#accès-au-système)
- [Scénarios courants](#scénarios-courants)
- [Menu personnalisé](#menu-personnalisé)
- [Gestion des dossiers](#gestion-des-dossiers)
- [Filtrage et recherche](#filtrage-et-recherche)
- [Export et rapports](#export-et-rapports)
- [Utilisation de l'API](#utilisation-de-lapi)
- [Conseils et astuces](#conseils-et-astuces)

---

## 🔐 Accès au système

### Pour les administrateurs

1. **Ouvrir le Google Sheet** : "Gestion Familles"
2. **Menu principal** : **📦 Gestion Familles**
3. **Onglets disponibles** :
   - **Famille** : Base de données principale
   - **Familles – FR/AR/EN** : Réponses des formulaires

### Pour les bénévoles

Accès en **lecture seule** ou **commentaire** selon les permissions configurées.

### Première utilisation

Au premier accès :

1. Le système demande les autorisations nécessaires
2. Cliquez sur **Autoriser**
3. Sélectionnez votre compte Google
4. Cliquez sur **Autoriser** pour chaque permission

---

## 📋 Scénarios courants

### Scénario 1 : Traiter une nouvelle demande

#### Étape 1 : Notification de soumission

Lorsqu'une famille soumet le formulaire :

- Le système traite automatiquement la soumission
- Une ligne apparaît dans l'onglet "Famille"
- Le statut initial est **"Recu"** ou **"En cours"**

#### Étape 2 : Vérification du dossier

1. Ouvrez l'onglet **"Famille"**
2. Trouvez la nouvelle ligne (généralement en bas)
3. Vérifiez les informations :

```
✓ Nom et prénom corrects
✓ Téléphone valide (format français)
✓ Adresse complète avec code postal et ville
✓ Nombre d'adultes et d'enfants cohérent
✓ ID Quartier attribué automatiquement
```

#### Étape 3 : Vérification des documents

Cliquez sur les liens dans les colonnes **Identité** et **CAF** :

```
Colonne N (Identité) : 
  https://drive.google.com/file/d/ABC123/view

Colonne O (CAF) :
  https://drive.google.com/file/d/DEF456/view
```

Vérifiez que :

- Les documents sont lisibles
- Les informations correspondent au formulaire
- Les documents sont à jour (< 3 mois pour la CAF)

#### Étape 4 : Décision

**Si le dossier est complet et valide :**

1. Changez le statut (colonne S) : **"Validé"**
2. Le système automatiquement :
   - Organise les documents dans Drive
   - Crée/met à jour le contact Google
   - Active le cache API

**Si le dossier nécessite des corrections :**

1. Changez le statut : **"En attente"**
2. Ajoutez un commentaire (colonne T) :

   ```
   Document d'identité illisible. 
   Merci de renvoyer une photo plus claire.
   Contacté le 17/12/2025.
   ```

3. Contactez la famille par téléphone

**Si le dossier doit être rejeté :**

1. Changez le statut : **"Rejeté"**
2. Ajoutez un commentaire détaillé :

   ```
   Adresse hors zone de couverture.
   Famille redirigée vers l'association XYZ.
   ```

#### Exemple complet

```
Ligne 45 - Nouvelle demande

ID : FAM_1703001234_567
Nom : MARTIN
Prénom : Sarah
Téléphone : 0612345678
Adresse : 15 Rue des Lilas, 44000 Nantes
Quartier : Q_003

Documents :
✓ Carte d'identité claire
✓ Attestation CAF datée de novembre 2025

Décision : VALIDER
  → Colonne S : "Validé"
  → Le système traite automatiquement
```

---

### Scénario 2 : Inscription manuelle

Pour inscrire une famille directement (sans formulaire) :

#### Étape 1 : Ouvrir le formulaire

Menu : **📦 Gestion Familles** > **➕ Inscription Manuelle**

#### Étape 2 : Remplir les informations

**Informations obligatoires :**

```
Nom de famille : BERNARD
Prénom : Jean
Téléphone : 0623456789
Adresse : 10 Avenue de la République
Code postal : 44200
Ville : Nantes
Nombre d'adultes : 2
Nombre d'enfants : 3
```

**Informations optionnelles :**

```
Téléphone secondaire : 0634567890
Email : jean.bernard@example.com
Circonstances : Perte d'emploi récente...
Spécificités : Allergie au gluten (enfant)
```

#### Étape 3 : Validation

1. Cliquez sur **Enregistrer**
2. Le système :
   - Valide l'adresse
   - Vérifie les doublons
   - Attribue un quartier
   - Crée la famille avec statut "Validé"
   - Synchronise le contact

#### Étape 4 : Confirmation

Message de succès :

```
✅ Succès!
Famille enregistrée avec succès.
ID: FAM_1703001234_789
Quartier: Centre-Ville
```

#### Note importante

Les familles inscrites manuellement :

- Sont créées avec statut **"Validé"** directement
- N'ont pas de documents initiaux (ajoutables plus tard)
- Sont immédiatement visibles dans l'API

---

### Scénario 3 : Mise à jour d'une famille

#### Cas A : Changement de téléphone

1. Trouvez la famille dans l'onglet "Famille"
2. Modifiez le téléphone (colonne L)
3. Ajoutez un commentaire (colonne T) :

   ```
   Téléphone mis à jour sur demande de la famille
   Ancien : 0612345678
   Nouveau : 0698765432
   Date : 17/12/2025
   ```

#### Cas B : Changement d'adresse

1. Modifiez l'adresse (colonne H)
2. **Important** : L'ID Quartier doit être mis à jour manuellement
3. Pour recalculer automatiquement :

```javascript
function recalculateQuartier(row) {
  const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
  const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const address = data[OUTPUT_COLUMNS.ADRESSE];
  const [street, postalCode, city] = address.split(',').map(s => s.trim());
  
  const validation = validateAddressAndGetQuartier(street, postalCode, city);
  
  if (validation.isValid) {
    sheet.getRange(row, OUTPUT_COLUMNS.ID_QUARTIER + 1)
      .setValue(validation.quartierId);
    console.log(`Quartier mis à jour : ${validation.quartierName}`);
  }
}

// Utilisation : recalculateQuartier(45); // Ligne 45
```

#### Cas C : Ajout de documents ultérieurs

Si une famille inscrite manuellement fournit des documents plus tard :

1. Uploadez les documents dans Drive
2. Copiez les IDs des fichiers
3. Ajoutez les liens dans les colonnes N (Identité) ou O (CAF)
4. Format : `https://drive.google.com/file/d/FILE_ID/view`

---

### Scénario 4 : Gérer les doublons

#### Détection automatique

Le système détecte automatiquement les doublons lors de la soumission basés sur :

- **Téléphone + Nom de famille**
- **Adresse email** (si fournie)

#### Cas d'un doublon détecté

Si une famille soumet plusieurs fois :

1. Le système met à jour l'enregistrement existant
2. Un commentaire est ajouté automatiquement :

   ```
   Mis à jour: téléphone, documents - 17/12/2025 14:30:25
   ```

#### Vérification manuelle

Pour vérifier manuellement :

```javascript
function findPotentialDuplicates() {
  const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
  const data = sheet.getDataRange().getValues();
  
  const families = new Map();
  const duplicates = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const phone = normalizePhone(row[OUTPUT_COLUMNS.TELEPHONE]);
    const name = row[OUTPUT_COLUMNS.NOM].toLowerCase().trim();
    const key = `${phone}_${name}`;
    
    if (families.has(key)) {
      duplicates.push({
        original: families.get(key),
        duplicate: {
          row: i + 1,
          id: row[OUTPUT_COLUMNS.ID],
          nom: row[OUTPUT_COLUMNS.NOM],
          prenom: row[OUTPUT_COLUMNS.PRENOM]
        }
      });
    } else {
      families.set(key, {
        row: i + 1,
        id: row[OUTPUT_COLUMNS.ID],
        nom: row[OUTPUT_COLUMNS.NOM],
        prenom: row[OUTPUT_COLUMNS.PRENOM]
      });
    }
  }
  
  if (duplicates.length === 0) {
    console.log('✓ Aucun doublon détecté');
  } else {
    console.log(`⚠️ ${duplicates.length} doublon(s) potentiel(s) :\n`);
    duplicates.forEach(dup => {
      console.log(`Ligne ${dup.original.row}: ${dup.original.nom} ${dup.original.prenom}`);
      console.log(`  Doublon ligne ${dup.duplicate.row}: ${dup.duplicate.nom} ${dup.duplicate.prenom}\n`);
    });
  }
  
  return duplicates;
}
```

#### Fusion de doublons

Si vous identifiez manuellement des doublons à fusionner :

1. Comparez les deux lignes
2. Conservez l'enregistrement le plus complet
3. Copiez les informations manquantes de l'autre
4. Changez le statut du doublon à "Archivé"
5. Ajoutez un commentaire :

   ```
   Doublon de FAM_XXXXX (ligne XX)
   Archivé le 17/12/2025
   ```

---

## 🎨 Menu personnalisé

### **📦 Gestion Familles**

#### **➕ Inscription Manuelle**

Ouvre le formulaire d'inscription directe.

**Quand l'utiliser :**

- Inscription téléphonique
- Visite en personne
- Besoin urgent sans documents

#### **🔄 Rafraîchir Cache**

Vide tous les caches du système.

**Quand l'utiliser :**

- Après modifications importantes
- Avant une distribution
- Si l'API retourne des données obsolètes

#### **📊 Statistiques**

Affiche un résumé statistique.

**Informations affichées :**

```
📊 Statistiques des Familles

Total: 125
Validées: 98
En cours: 15
Rejetées: 12

Adultes: 245
Enfants: 387
```

---

## 🔍 Filtrage et recherche

### Filtres natifs Google Sheets

#### Activer les filtres

1. Sélectionnez la ligne d'en-tête (ligne 1)
2. **Données** > **Créer un filtre**
3. Des icônes d'entonnoir apparaissent sur chaque colonne

#### Exemples de filtres

**Familles validées d'un quartier :**

```
Colonne I (ID Quartier) : Q_001
Colonne S (État Dossier) : Validé
```

**Familles avec plus de 3 enfants :**

```
Colonne G (Nombre Enfant) : Filtre par condition > Supérieur à > 3
```

**Familles éligibles Zakat El Fitr et Sadaqa :**

```
Colonne D (Zakat El Fitr) : ✓
Colonne E (Sadaqa) : ✓
```

### Vues filtrées

Créez des vues personnalisées pour un accès rapide :

1. Appliquez vos filtres
2. **Données** > **Vues filtrées** > **Créer une nouvelle vue filtrée**
3. Nommez la vue : "Zakat Q1", "Sadaqa Nord", etc.
4. La vue est sauvegardée et accessible à tous

### Recherche par ID

```javascript
function searchFamilyById(familyId) {
  const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][OUTPUT_COLUMNS.ID] === familyId) {
      // Sélectionner et surligner la ligne
      const range = sheet.getRange(i + 1, 1, 1, sheet.getLastColumn());
      range.activate();
      sheet.setActiveRange(range);
      
      SpreadsheetApp.getUi().alert(
        'Famille trouvée',
        `Ligne ${i + 1}\nNom: ${data[i][OUTPUT_COLUMNS.NOM]}\nPrénom: ${data[i][OUTPUT_COLUMNS.PRENOM]}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      
      return;
    }
  }
  
  SpreadsheetApp.getUi().alert('Famille non trouvée');
}
```

### Recherche par téléphone

```javascript
function searchFamilyByPhone(phone) {
  const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
  const data = sheet.getDataRange().getValues();
  const normalizedSearch = normalizePhone(phone);
  
  const results = [];
  
  for (let i = 1; i < data.length; i++) {
    const normalizedPhone = normalizePhone(data[i][OUTPUT_COLUMNS.TELEPHONE]);
    if (normalizedPhone === normalizedSearch) {
      results.push({
        row: i + 1,
        id: data[i][OUTPUT_COLUMNS.ID],
        nom: data[i][OUTPUT_COLUMNS.NOM],
        prenom: data[i][OUTPUT_COLUMNS.PRENOM]
      });
    }
  }
  
  if (results.length === 0) {
    SpreadsheetApp.getUi().alert('Aucune famille trouvée avec ce téléphone');
  } else if (results.length === 1) {
    const r = results[0];
    sheet.getRange(r.row, 1, 1, sheet.getLastColumn()).activate();
    SpreadsheetApp.getUi().alert(`Famille trouvée : ${r.prenom} ${r.nom}`);
  } else {
    const message = results.map(r => `Ligne ${r.row}: ${r.prenom} ${r.nom}`).join('\n');
    SpreadsheetApp.getUi().alert(`${results.length} familles trouvées :\n\n${message}`);
  }
}
```

---

## 📊 Export et rapports

### Export simple (CSV/Excel)

1. Appliquez les filtres souhaités
2. Sélectionnez les données visibles
3. **Fichier** > **Télécharger**
4. Choisissez le format :
   - **CSV** : Pour traitement ultérieur
   - **Excel (.xlsx)** : Pour partage
   - **PDF** : Pour impression

### Rapport mensuel automatique

```javascript
function generateMonthlyReport() {
  const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
  const data = sheet.getDataRange().getValues();
  
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const report = {
    period: `${lastMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
    newFamilies: 0,
    validated: 0,
    rejected: 0,
    totalAdultes: 0,
    totalEnfants: 0,
    byQuartier: {}
  };
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const id = row[OUTPUT_COLUMNS.ID];
    
    // Extraire le timestamp de l'ID (FAM_timestamp_random)
    const timestamp = parseInt(id.split('_')[1]);
    const familyDate = new Date(timestamp);
    
    if (familyDate >= lastMonth && familyDate < thisMonth) {
      report.newFamilies++;
      
      if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] === CONFIG.STATUS.VALIDATED) {
        report.validated++;
        report.totalAdultes += row[OUTPUT_COLUMNS.NOMBRE_ADULTE] || 0;
        report.totalEnfants += row[OUTPUT_COLUMNS.NOMBRE_ENFANT] || 0;
        
        const quartier = row[OUTPUT_COLUMNS.ID_QUARTIER] || 'Non assigné';
        report.byQuartier[quartier] = (report.byQuartier[quartier] || 0) + 1;
      } else if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] === CONFIG.STATUS.REJECTED) {
        report.rejected++;
      }
    }
  }
  
  // Créer le rapport
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reportSheet = ss.insertSheet(`Rapport_${lastMonth.getMonth() + 1}_${lastMonth.getFullYear()}`);
  
  const reportData = [
    ['Rapport Mensuel', report.period],
    [''],
    ['Nouvelles demandes', report.newFamilies],
    ['Dossiers validés', report.validated],
    ['Dossiers rejetés', report.rejected],
    [''],
    ['Total personnes aidées', report.totalAdultes + report.totalEnfants],
    ['  - Adultes', report.totalAdultes],
    ['  - Enfants', report.totalEnfants],
    [''],
    ['Répartition par quartier', '']
  ];
  
  Object.entries(report.byQuartier)
    .sort((a, b) => b[1] - a[1])
    .forEach(([quartier, count]) => {
      reportData.push([quartier, count]);
    });
  
  reportSheet.getRange(1, 1, reportData.length, 2).setValues(reportData);
  
  // Format
  reportSheet.getRange(1, 1, 1, 2)
    .setBackground('#4a86e8')
    .setFontColor('#ffffff')
    .setFontSize(14)
    .setFontWeight('bold');
  
  reportSheet.autoResizeColumns(1, 2);
  
  console.log(`Rapport généré : ${reportSheet.getName()}`);
}
```

### Export pour impression

```javascript
function createPrintableList(quartierId) {
  const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
  const data = sheet.getDataRange().getValues();
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const printSheet = ss.insertSheet(`Impression_${quartierId}`);
  
  // En-tête
  const header = ['N°', 'Nom Prénom', 'Adresse', 'Téléphone', 'Personnes', 'Signature'];
  printSheet.getRange(1, 1, 1, header.length).setValues([header]);
  
  // Données
  const printData = [];
  let num = 1;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (row[OUTPUT_COLUMNS.ID_QUARTIER] !== quartierId) continue;
    if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] !== CONFIG.STATUS.VALIDATED) continue;
    if (!row[OUTPUT_COLUMNS.ZAKAT_EL_FITR]) continue;
    
    const adultes = row[OUTPUT_COLUMNS.NOMBRE_ADULTE] || 0;
    const enfants = row[OUTPUT_COLUMNS.NOMBRE_ENFANT] || 0;
    
    printData.push([
      num++,
      `${row[OUTPUT_COLUMNS.PRENOM]} ${row[OUTPUT_COLUMNS.NOM]}`,
      row[OUTPUT_COLUMNS.ADRESSE],
      row[OUTPUT_COLUMNS.TELEPHONE],
      `${adultes}A + ${enfants}E`,
      '' // Colonne signature vide
    ]);
  }
  
  if (printData.length > 0) {
    printSheet.getRange(2, 1, printData.length, header.length).setValues(printData);
  }
  
  // Format pour impression
  printSheet.getRange(1, 1, 1, header.length)
    .setBackground('#000000')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  
  // Bordures
  printSheet.getRange(1, 1, printData.length + 1, header.length)
    .setBorder(true, true, true, true, true, true);
  
  // Largeurs
  printSheet.setColumnWidth(1, 50);   // N°
  printSheet.setColumnWidth(2, 150);  // Nom
  printSheet.setColumnWidth(3, 250);  // Adresse
  printSheet.setColumnWidth(4, 110);  // Téléphone
  printSheet.setColumnWidth(5, 80);   // Personnes
  printSheet.setColumnWidth(6, 150);  // Signature
  
  // Hauteur des lignes
  printSheet.setRowHeights(2, printData.length, 30);
  
  console.log(`Liste d'impression créée : ${printData.length} familles`);
}
```

---

## 🌐 Utilisation de l'API

### Cas d'usage : Application de distribution mobile

```javascript
// app.js - Application mobile de distribution
const API_URL = 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec';

class DistributionApp {
  constructor() {
    this.currentQuartier = null;
    this.families = [];
  }
  
  async loadQuartier(quartierId) {
    this.currentQuartier = quartierId;
    const response = await fetch(
      `${API_URL}?action=familiesbyquartier&quartierId=${quartierId}`
    );
    const data = await response.json();
    this.families = data.families.filter(f => f.zakatElFitr);
    this.render();
  }
  
  render() {
    const list = document.getElementById('family-list');
    list.innerHTML = '';
    
    this.families.forEach((family, index) => {
      const item = document.createElement('div');
      item.className = 'family-item';
      item.innerHTML = `
        <div class="family-number">${index + 1}</div>
        <div class="family-info">
          <strong>${family.prenom} ${family.nom}</strong>
          <div>${family.adresse}</div>
          <div>${family.telephone}</div>
          <div>${family.nombreAdulte} adultes, ${family.nombreEnfant} enfants</div>
        </div>
        <button onclick="app.markDelivered('${family.id}')">
          ✓ Livré
        </button>
      `;
      list.appendChild(item);
    });
    
    document.getElementById('total').textContent = 
      `${this.families.length} familles`;
  }
  
  markDelivered(familyId) {
    // Marquer localement (localStorage)
    const delivered = JSON.parse(localStorage.getItem('delivered') || '[]');
    delivered.push({ id: familyId, date: new Date().toISOString() });
    localStorage.setItem('delivered', JSON.stringify(delivered));
    
    // Retirer de la liste
    this.families = this.families.filter(f => f.id !== familyId);
    this.render();
  }
}

const app = new DistributionApp();
```

### Cas d'usage : Dashboard statistiques

```javascript
// dashboard.js
async function loadDashboard() {
  const allFamilies = await fetch(`${API_URL}?action=allfamilies`)
    .then(r => r.json());
  
  const zakatFamilies = await fetch(`${API_URL}?action=familieszakatfitr`)
    .then(r => r.json());
  
  const sadakaFamilies = await fetch(`${API_URL}?action=familiessadaka`)
    .then(r => r.json());
  
  // Statistiques globales
  document.getElementById('total-families').textContent = allFamilies.count;
  document.getElementById('zakat-families').textContent = zakatFamilies.count;
  document.getElementById('sadaka-families').textContent = sadakaFamilies.count;
  
  // Total personnes
  const totalPersons = allFamilies.families.reduce((sum, f) => 
    sum + f.nombreAdulte + f.nombreEnfant, 0
  );
  document.getElementById('total-persons').textContent = totalPersons;
  
  // Par quartier (graphique)
  const byQuartier = {};
  allFamilies.families.forEach(f => {
    byQuartier[f.idQuartier] = (byQuartier[f.idQuartier] || 0) + 1;
  });
  
  renderChart('quartier-chart', byQuartier);
}

function renderChart(elementId, data) {
  // Utiliser Chart.js ou autre bibliothèque
  const ctx = document.getElementById(elementId).getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: 'Familles par quartier',
        data: Object.values(data),
        backgroundColor: '#4a86e8'
      }]
    }
  });
}
```

---

## 💡 Conseils et astuces

### 1. Raccourcis clavier

| Raccourci        | Action                   |
| ---------------- | ------------------------ |
| `Ctrl + /`       | Ouvrir les raccourcis    |
| `Ctrl + F`       | Rechercher               |
| `Ctrl + H`       | Rechercher et remplacer  |
| `Ctrl + Alt + V` | Créer une vue filtrée    |
| `Alt + ↓`        | Ouvrir le menu du filtre |

### 2. Formules utiles

**Calculer l'âge d'un dossier :**

```
=SI(A2<>""; AUJOURDHUI() - DATEVAL(STXT(A2;5;13)/1000); "")
```

(Colonne A = ID, extrait le timestamp)

**Colorer selon l'ancienneté :**

Format conditionnel personnalisé :

```
=AUJOURDHUI() - DATEVAL(STXT($A2;5;13)/1000) > 30
```

(Rouge si > 30 jours)

**Compter par statut :**

```
=NB.SI(S:S; "Validé")
```

### 3. Validation conditionnelle

Pour rendre certains champs obligatoires selon le statut :

1. Apps Script > Créer un trigger onEdit
2. Vérifier les conditions
3. Bloquer la modification si invalide

```javascript
function validateOnEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.SHEETS.FAMILLE_CLEANED) return;
  
  const row = e.range.getRow();
  const col = e.range.getColumn();
  
  // Si on change le statut à "Validé"
  if (col === OUTPUT_COLUMNS.ETAT_DOSSIER + 1 && 
      e.value === CONFIG.STATUS.VALIDATED) {
    
    const data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Vérifier que les documents sont présents
    if (!data[OUTPUT_COLUMNS.IDENTITE]) {
      e.range.setValue(e.oldValue);
      SpreadsheetApp.getUi().alert(
        'Documents manquants',
        'Impossible de valider sans documents d\'identité',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  }
}
```

### 4. Notifications personnalisées

Configurez des notifications par email pour certains événements :

```javascript
function notifyNewSubmission(familyData) {
  const recipients = getProperty('ADMIN_EMAILS').split(',');
  
  const subject = `Nouvelle demande : ${familyData.prenom} ${familyData.nom}`;
  
  const body = `
    Nouvelle demande reçue le ${new Date().toLocaleString('fr-FR')}
    
    Famille : ${familyData.prenom} ${familyData.nom}
    Téléphone : ${familyData.telephone}
    Adresse : ${familyData.adresse}
    Composition : ${familyData.nombreAdulte} adultes, ${familyData.nombreEnfant} enfants
    Quartier : ${familyData.idQuartier}
    
    Voir le dossier : ${SpreadsheetApp.getActiveSpreadsheet().getUrl()}
  `;
  
  MailApp.sendEmail({
    to: recipients.join(','),
    subject: subject,
    body: body
  });
}
```

### 5. Sauvegarde automatique

Créez une copie de sauvegarde régulière :

```javascript
function createBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const backupFolder = DriveApp.getFolderById(getProperty('BACKUP_FOLDER_ID'));
  
  const today = new Date();
  const backupName = `Backup_Familles_${today.toISOString().split('T')[0]}`;
  
  const backup = ss.copy(backupName);
  backupFolder.addFile(DriveApp.getFileById(backup.getId()));
  
  console.log(`Sauvegarde créée : ${backupName}`);
}

// Créer un trigger quotidien
function setupDailyBackup() {
  ScriptApp.newTrigger('createBackup')
    .timeBased()
    .everyDays(1)
    .atHour(2) // 2h du matin
    .create();
}
```

### 6. Import massif (CSV)

Pour importer des données existantes :

```javascript
function importFromCSV() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Import CSV',
    'Entrez l\'ID du fichier CSV dans Drive :',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() !== ui.Button.OK) return;
  
  const fileId = response.getResponseText();
  const file = DriveApp.getFileById(fileId);
  const csvContent = file.getBlob().getDataAsString();
  const rows = Utilities.parseCsv(csvContent);
  
  const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
  
  let imported = 0;
  let errors = 0;
  
  // Ignorer la première ligne (en-têtes)
  for (let i = 1; i < rows.length; i++) {
    try {
      const row = rows[i];
      
      const formData = {
        lastName: row[0],
        firstName: row[1],
        phone: row[2],
        email: row[3],
        address: row[4],
        postalCode: row[5],
        city: row[6],
        nombreAdulte: parseInt(row[7]),
        nombreEnfant: parseInt(row[8])
      };
      
      // Vérifier si existe déjà
      const duplicate = findDuplicateFamily(
        formData.phone,
        formData.lastName
      );
      
      if (!duplicate.exists) {
        writeToFamilySheet(formData, {
          status: CONFIG.STATUS.IN_PROGRESS
        });
        imported++;
      }
      
    } catch (e) {
      console.error(`Erreur ligne ${i + 1}:`, e);
      errors++;
    }
  }
  
  ui.alert(
    'Import terminé',
    `${imported} familles importées\n${errors} erreurs`,
    ui.ButtonSet.OK
  );
}
```

### 7. Audit trail (historique des modifications)

Suivre les modifications importantes :

```javascript
function logChange(familyId, field, oldValue, newValue, user) {
  const logSheet = getSheetByName('Audit_Log') || 
    SpreadsheetApp.getActiveSpreadsheet().insertSheet('Audit_Log');
  
  logSheet.appendRow([
    new Date().toISOString(),
    familyId,
    field,
    oldValue,
    newValue,
    user || Session.getActiveUser().getEmail()
  ]);
}

// Modifier handleEdit pour enregistrer les changements
function handleEditWithLog(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.SHEETS.FAMILLE_CLEANED) return;
  
  const row = e.range.getRow();
  const col = e.range.getColumn();
  
  if (row === 1) return; // En-têtes
  
  const familyId = sheet.getRange(row, OUTPUT_COLUMNS.ID + 1).getValue();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const fieldName = headers[col - 1];
  
  logChange(familyId, fieldName, e.oldValue, e.value);
  
  // Continuer avec le traitement normal
  handleEdit(e);
}
```

---

## 📞 Support utilisateur

### Questions fréquentes

**Q : Comment savoir si une famille peut se déplacer ?**

R : Vérifiez la colonne J (Se Déplace). Si cochée ✓, la famille peut venir chercher l'aide.

**Q : Que faire si l'adresse ne trouve pas de quartier ?**

R : Vérifiez l'adresse complète. Si correcte, l'adresse est peut-être hors zone. Contactez l'administrateur système.

**Q : Comment ajouter un nouveau quartier ?**

R : Cela doit être fait dans l'API de géocodage externe. Le système Apps Script ne gère que l'attribution.

**Q : Les documents sont-ils accessibles après validation ?**

R : Oui, dans Google Drive sous `Gestion Familles/familles/FAM_ID/`

**Q : Comment annuler une validation ?**

R : Changez simplement le statut de "Validé" à "En cours". Les documents restent organisés.

---

[← API](API.md) | [Retour au README principal](../README.md)
