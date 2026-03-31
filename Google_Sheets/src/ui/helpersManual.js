/**
 * @file src/ui/helpersManual.js
 */

function processManualEntry(formData) {
    try {
        logInfo('Traitement saisie manuelle', formData);

        const criticite = parseInt(formData.criticite);
        if (isNaN(criticite) || criticite < CONFIG.CRITICITE.MIN || criticite > CONFIG.CRITICITE.MAX) {
            return { success: false, error: `Criticité invalide. Doit être entre ${CONFIG.CRITICITE.MIN} et ${CONFIG.CRITICITE.MAX}.` };
        }

        const fieldValidation = validateRequiredFields(formData);
        if (!fieldValidation.isValid) {
            return { success: false, error: `Champs requis manquants: ${fieldValidation.errors.join(', ')}` };
        }

        const duplicate = findDuplicateFamily(formData.phone, formData.lastName, formData.email);

        if (duplicate.exists) {
            const familyId = generateFamilyId();
            const langue = formData.langue || CONFIG.LANGUAGES.FR;

            const rowNumber = writeToFamilySheet(formData, {
                status: CONFIG.STATUS.REJECTED,
                familyId,
                quartierId: null,
                criticite,
                langue,
                zakatElFitr: formData.zakatElFitr || false,
                sadaqa: formData.sadaqa || false,
                seDeplace: formData.seDeplace || false
            });

            appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.SAISIE_MANUELLE, `🚫 Doublon détecté - Famille existante ID: ${duplicate.id}`);

            const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
            if (sheet) autoFormatFamilleRow(sheet, rowNumber);

            notifyAdmin('🚫 Doublon détecté',
                `Nouvelle tentative d'inscription rejetée\nID créé: ${familyId}\nFamille existante: ${duplicate.id}\nNom: ${formData.lastName} ${formData.firstName}\nTéléphone: ${normalizePhone(formData.phone)}\nLangue: ${langue}`);

            return {
                success: false, warning: true, duplicate: true,
                message: `Une famille avec ce téléphone et nom existe déjà (ID: ${duplicate.id})`,
                familyId: duplicate.id, newId: familyId
            };
        }

        const addressValidation = validateAddressAndGetQuartier(formData.address, formData.postalCode, formData.city);
        if (!addressValidation.isValid) {
            return { success: false, error: `Adresse invalide: ${addressValidation.error}` };
        }

        const familyId = generateFamilyId();
        const langue = formData.langue || CONFIG.LANGUAGES.FR;

        const rowNumber = writeToFamilySheet(formData, {
            status: CONFIG.STATUS.IN_PROGRESS,
            familyId,
            quartierId: addressValidation.quartierId,
            criticite,
            langue,
            zakatElFitr: formData.zakatElFitr || false,
            sadaqa: formData.sadaqa || false,
            seDeplace: formData.seDeplace || false
        });

        appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.SAISIE_MANUELLE, '➕ Créé manuellement');

        if (addressValidation.quartierInvalid) {
            appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.RESOLUTION_ADRESSE, `⚠️ ${addressValidation.warning}`);
        }

        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (sheet) autoFormatFamilleRow(sheet, rowNumber);

        notifyAdmin('✅ Nouvelle famille ajoutée manuellement',
            `ID: ${familyId}\nNom: ${formData.lastName} ${formData.firstName}\nTéléphone: ${normalizePhone(formData.phone)}\nAdresse: ${formData.address}, ${formData.postalCode} ${formData.city}\nQuartier: ${addressValidation.quartierName || 'Non assigné'}\nCriticité: ${criticite}\nLangue: ${langue}\nZakat El Fitr: ${formData.zakatElFitr ? 'Oui' : 'Non'}\nSadaqa: ${formData.sadaqa ? 'Oui' : 'Non'}\nSe Déplace: ${formData.seDeplace ? 'Oui' : 'Non'}`);

        logInfo('Saisie manuelle traitée avec succès', { familyId, criticite, langue });

        return {
            success: true, familyId, quartierId: addressValidation.quartierId,
            quartierName: addressValidation.quartierName, criticite, langue,
            zakatElFitr: formData.zakatElFitr || false, sadaqa: formData.sadaqa || false,
            seDeplace: formData.seDeplace || false, status: CONFIG.STATUS.IN_PROGRESS,
            message: 'Famille créée avec succès. Changez le statut à "Validé" pour créer le contact Google.'
        };
    } catch (error) {
        logError('Échec saisie manuelle', error);
        notifyAdmin('❌ Erreur saisie manuelle', `Erreur: ${error.toString()}\nFamille: ${formData.lastName} ${formData.firstName}`);
        return { success: false, error: error.toString() };
    }
}

function processManualUpdate(familyId, updateData) {
    try {
        logInfo('Traitement mise à jour manuelle', { familyId, updateData });

        if (!familyId) return { success: false, error: 'ID famille obligatoire' };

        const hasData = Object.keys(updateData).some(key => {
            const value = updateData[key];
            return value !== '' && value !== null && value !== undefined;
        });

        if (!hasData) return { success: false, error: 'Au moins un champ doit être renseigné pour la mise à jour' };

        updateData.forceInProgress = true;

        const result = updateFamilyById(familyId, updateData);

        if (result.success) {
            logInfo('Mise à jour manuelle traitée avec succès', result);
            return { success: true, familyId: result.familyId, updatedFields: result.updatedFields, quartierWarning: result.quartierWarning };
        }
        return { success: false, error: result.error };
    } catch (error) {
        logError('Échec mise à jour manuelle', error);
        return { success: false, error: error.toString() };
    }
}
