/**
 * @file src/ui/helpers_manual.js
 * @description Traitement des saisies manuelles et mises à jour depuis le formulaire UI
 */

/**
 * Traite une nouvelle saisie manuelle depuis le formulaire de menu.
 */
function processManualEntry(formData) {
    try {
        logInfo('Traitement saisie manuelle', formData);

        const criticite = parseInt(formData.criticite);
        if (isNaN(criticite) || criticite < CONFIG.CRITICITE.MIN || criticite > CONFIG.CRITICITE.MAX) {
            return {
                success: false,
                error: `Criticité invalide. Doit être entre ${CONFIG.CRITICITE.MIN} et ${CONFIG.CRITICITE.MAX}.`
            };
        }

        const fieldValidation = validateRequiredFields(formData);
        if (!fieldValidation.isValid) {
            return {
                success: false,
                error: `Champs requis manquants: ${fieldValidation.errors.join(', ')}`
            };
        }

        const duplicate = findDuplicateFamily(formData.phone, formData.lastName, formData.email);

        if (duplicate.exists) {
            const familyId = generateFamilyId();
            const comment = formatComment('🚫', `Doublon détecté - Famille existante ID: ${duplicate.id}`);
            const langue = formData.langue || CONFIG.LANGUAGES.FR;

            const rowNumber = writeToFamilySheet(formData, {
                status: CONFIG.STATUS.REJECTED,
                comment: comment,
                familyId: familyId,
                quartierId: null,
                criticite: criticite,
                langue: langue,
                zakatElFitr: formData.zakatElFitr || false,
                sadaqa: formData.sadaqa || false,
                seDeplace: formData.seDeplace || false
            });

            const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
            if (sheet) autoFormatFamilleRow(sheet, rowNumber);

            notifyAdmin(
                '🚫 Doublon détecté',
                `Nouvelle tentative d'inscription rejetée\nID créé: ${familyId}\nFamille existante: ${duplicate.id}\nNom: ${formData.lastName} ${formData.firstName}\nTéléphone: ${normalizePhone(formData.phone)}\nLangue: ${langue}`
            );

            return {
                success: false,
                warning: true,
                duplicate: true,
                message: `Une famille avec ce téléphone et nom existe déjà (ID: ${duplicate.id})`,
                familyId: duplicate.id,
                newId: familyId
            };
        }

        const addressValidation = validateAddressAndGetQuartier(
            formData.address,
            formData.postalCode,
            formData.city
        );

        if (!addressValidation.isValid) {
            return {
                success: false,
                error: `Adresse invalide: ${addressValidation.error}`
            };
        }

        const familyId = generateFamilyId();
        const langue = formData.langue || CONFIG.LANGUAGES.FR;
        let comment = formatComment('➕', 'Créé manuellement');

        if (addressValidation.quartierInvalid) {
            comment += '\n' + formatComment('⚠️', addressValidation.warning);
        }

        const rowNumber = writeToFamilySheet(formData, {
            status: CONFIG.STATUS.IN_PROGRESS,
            comment: comment,
            familyId: familyId,
            quartierId: addressValidation.quartierId,
            criticite: criticite,
            langue: langue,
            zakatElFitr: formData.zakatElFitr || false,
            sadaqa: formData.sadaqa || false,
            seDeplace: formData.seDeplace || false
        });

        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (sheet) autoFormatFamilleRow(sheet, rowNumber);

        notifyAdmin(
            '✅ Nouvelle famille ajoutée manuellement',
            `ID: ${familyId}\nNom: ${formData.lastName} ${formData.firstName}\nTéléphone: ${normalizePhone(formData.phone)}\nAdresse: ${formData.address}, ${formData.postalCode} ${formData.city}\nQuartier: ${addressValidation.quartierName || 'Non assigné'}\nCriticité: ${criticite}\nLangue: ${langue}\nZakat El Fitr: ${formData.zakatElFitr ? 'Oui' : 'Non'}\nSadaqa: ${formData.sadaqa ? 'Oui' : 'Non'}\nSe Déplace: ${formData.seDeplace ? 'Oui' : 'Non'}`
        );

        logInfo('Saisie manuelle traitée avec succès', { familyId, criticite, langue });

        return {
            success: true,
            familyId: familyId,
            quartierId: addressValidation.quartierId,
            quartierName: addressValidation.quartierName,
            criticite: criticite,
            langue: langue,
            zakatElFitr: formData.zakatElFitr || false,
            sadaqa: formData.sadaqa || false,
            seDeplace: formData.seDeplace || false,
            status: CONFIG.STATUS.IN_PROGRESS,
            message: 'Famille créée avec succès. Changez le statut à "Validé" pour créer le contact Google.'
        };

    } catch (error) {
        logError('Échec saisie manuelle', error);
        notifyAdmin('❌ Erreur saisie manuelle', `Erreur: ${error.toString()}\nFamille: ${formData.lastName} ${formData.firstName}`);
        return { success: false, error: error.toString() };
    }
}

/**
 * Traite une mise à jour manuelle depuis le formulaire de menu.
 * Force le statut à "En cours" après toute mise à jour réussie.
 */
function processManualUpdate(familyId, updateData) {
    try {
        logInfo('Traitement mise à jour manuelle', { familyId, updateData });

        if (!familyId) {
            return { success: false, error: 'ID famille obligatoire' };
        }

        const hasData = Object.keys(updateData).some(key => {
            const value = updateData[key];
            return value !== '' && value !== null && value !== undefined;
        });

        if (!hasData) {
            return { success: false, error: 'Au moins un champ doit être renseigné pour la mise à jour' };
        }

        updateData.forceInProgress = true;

        const result = updateFamilyById(familyId, updateData);

        if (result.success) {
            logInfo('Mise à jour manuelle traitée avec succès', result);
            return {
                success: true,
                familyId: result.familyId,
                updatedFields: result.updatedFields,
                quartierWarning: result.quartierWarning
            };
        } else {
            return { success: false, error: result.error };
        }

    } catch (error) {
        logError('Échec mise à jour manuelle', error);
        return { success: false, error: error.toString() };
    }
}