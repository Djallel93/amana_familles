/**
 * @file src/services/familyUpdateService.js
 * @description Core family update functionality
 */

/**
 * Update family by ID with partial data
 * @param {string} familyId - Family ID to update
 * @param {Object} updateData - Data to update (only non-empty fields)
 * @returns {Object} - Success status and details
 */
function updateFamilyById(familyId, updateData) {
    try {
        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE_CLEANED);
        if (!sheet) {
            return { success: false, error: 'Feuille Famille introuvable' };
        }

        // Find family row
        const data = sheet.getDataRange().getValues();
        let targetRow = -1;

        for (let i = 1; i < data.length; i++) {
            if (data[i][OUTPUT_COLUMNS.ID] === familyId) {
                targetRow = i + 1; // Convert to 1-based
                break;
            }
        }

        if (targetRow === -1) {
            return { success: false, error: `Famille introuvable: ${familyId}` };
        }

        const existingData = data[targetRow - 1];
        const changes = [];
        let needsAddressValidation = false;

        // Update name fields
        if (updateData.lastName) {
            sheet.getRange(targetRow, OUTPUT_COLUMNS.NOM + 1).setValue(updateData.lastName);
            changes.push('nom');
        }

        if (updateData.firstName) {
            sheet.getRange(targetRow, OUTPUT_COLUMNS.PRENOM + 1).setValue(updateData.firstName);
            changes.push('prenom');
        }

        // Update contact fields
        if (updateData.phone) {
            const normalizedPhone = normalizePhone(updateData.phone);
            if (!isValidPhone(normalizedPhone)) {
                return { success: false, error: 'Numéro de téléphone invalide' };
            }
            sheet.getRange(targetRow, OUTPUT_COLUMNS.TELEPHONE + 1).setValue(normalizedPhone);
            changes.push('telephone');
        }

        if (updateData.phoneBis) {
            const normalizedPhoneBis = normalizePhone(updateData.phoneBis);
            sheet.getRange(targetRow, OUTPUT_COLUMNS.TELEPHONE_BIS + 1).setValue(normalizedPhoneBis);
            changes.push('telephone_bis');
        }

        if (updateData.email) {
            if (!isValidEmail(updateData.email)) {
                return { success: false, error: 'Email invalide' };
            }
            sheet.getRange(targetRow, OUTPUT_COLUMNS.EMAIL + 1).setValue(updateData.email);
            changes.push('email');
        }

        // Update household composition
        if (updateData.nombreAdulte !== undefined && updateData.nombreAdulte !== null) {
            const adultes = parseInt(updateData.nombreAdulte);
            if (isNaN(adultes) || adultes < 0) {
                return { success: false, error: 'Nombre d\'adultes invalide' };
            }
            sheet.getRange(targetRow, OUTPUT_COLUMNS.NOMBRE_ADULTE + 1).setValue(adultes);
            changes.push('nombre_adulte');
        }

        if (updateData.nombreEnfant !== undefined && updateData.nombreEnfant !== null) {
            const enfants = parseInt(updateData.nombreEnfant);
            if (isNaN(enfants) || enfants < 0) {
                return { success: false, error: 'Nombre d\'enfants invalide' };
            }
            sheet.getRange(targetRow, OUTPUT_COLUMNS.NOMBRE_ENFANT + 1).setValue(enfants);
            changes.push('nombre_enfant');
        }

        // Update address fields (requires validation)
        if (updateData.address || updateData.postalCode || updateData.city) {
            needsAddressValidation = true;

            const currentAddress = updateData.address || existingData[OUTPUT_COLUMNS.ADRESSE];
            const currentPostalCode = updateData.postalCode ||
                (existingData[OUTPUT_COLUMNS.ADRESSE] ? existingData[OUTPUT_COLUMNS.ADRESSE].match(/\b\d{5}\b/)?.[0] : '');
            const currentCity = updateData.city ||
                (existingData[OUTPUT_COLUMNS.ADRESSE] ? existingData[OUTPUT_COLUMNS.ADRESSE].split(',').pop().trim() : '');

            if (currentAddress && currentPostalCode && currentCity) {
                const addressValidation = validateAddressAndGetQuartier(
                    currentAddress,
                    currentPostalCode,
                    currentCity
                );

                if (!addressValidation.isValid) {
                    return { success: false, error: `Adresse invalide: ${addressValidation.error}` };
                }

                const fullAddress = formatAddressForGeocoding(currentAddress, currentPostalCode, currentCity);
                sheet.getRange(targetRow, OUTPUT_COLUMNS.ADRESSE + 1).setValue(fullAddress);
                sheet.getRange(targetRow, OUTPUT_COLUMNS.ID_QUARTIER + 1).setValue(addressValidation.quartierId || '');
                changes.push('adresse');
            }
        }

        // Update text fields
        if (updateData.circonstances) {
            sheet.getRange(targetRow, OUTPUT_COLUMNS.CIRCONSTANCES + 1).setValue(updateData.circonstances);
            changes.push('circonstances');
        }

        if (updateData.ressentit) {
            sheet.getRange(targetRow, OUTPUT_COLUMNS.RESSENTIT + 1).setValue(updateData.ressentit);
            changes.push('ressentit');
        }

        if (updateData.specificites) {
            sheet.getRange(targetRow, OUTPUT_COLUMNS.SPECIFICITES + 1).setValue(updateData.specificites);
            changes.push('specificites');
        }

        // Update criticite
        if (updateData.criticite !== undefined && updateData.criticite !== null) {
            const criticite = parseInt(updateData.criticite);
            if (isNaN(criticite) || criticite < CONFIG.CRITICITE.MIN || criticite > CONFIG.CRITICITE.MAX) {
                return {
                    success: false,
                    error: `Criticité invalide. Doit être entre ${CONFIG.CRITICITE.MIN} et ${CONFIG.CRITICITE.MAX}`
                };
            }
            sheet.getRange(targetRow, OUTPUT_COLUMNS.CRITICITE + 1).setValue(criticite);
            changes.push('criticite');
        }

        // Add comment
        const existingComment = existingData[OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';
        const updateComment = `\nMis à jour: ${changes.join(', ')} - ${new Date().toLocaleString('fr-FR')}`;
        sheet.getRange(targetRow, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(
            existingComment + updateComment
        );

        // Sync with Google Contacts
        const contactData = {
            id: familyId,
            nom: updateData.lastName || existingData[OUTPUT_COLUMNS.NOM],
            prenom: updateData.firstName || existingData[OUTPUT_COLUMNS.PRENOM],
            email: updateData.email || existingData[OUTPUT_COLUMNS.EMAIL],
            telephone: updateData.phone ? normalizePhone(updateData.phone) : existingData[OUTPUT_COLUMNS.TELEPHONE],
            phoneBis: updateData.phoneBis ? normalizePhone(updateData.phoneBis) : existingData[OUTPUT_COLUMNS.TELEPHONE_BIS],
            adresse: updateData.address || existingData[OUTPUT_COLUMNS.ADRESSE]
        };

        syncFamilyContact(contactData);

        // Clear relevant caches
        const cache = CacheService.getScriptCache();
        cache.remove(`api_family_${familyId}`);
        cache.remove(`folder_${familyId}`);

        logInfo('Family updated successfully', { familyId, changes });

        return {
            success: true,
            familyId: familyId,
            updatedFields: changes
        };

    } catch (error) {
        logError('Failed to update family', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}

/**
 * Process manual update entry (called from UI)
 */
function processManualUpdate(familyId, updateData) {
    try {
        logInfo('Processing manual update', { familyId, updateData });

        if (!familyId) {
            return {
                success: false,
                error: 'ID famille obligatoire'
            };
        }

        // Check if at least one field is provided
        const hasData = Object.keys(updateData).some(key => {
            const value = updateData[key];
            return value !== '' && value !== null && value !== undefined;
        });

        if (!hasData) {
            return {
                success: false,
                error: 'Au moins un champ doit être renseigné pour la mise à jour'
            };
        }

        // Perform update
        const result = updateFamilyById(familyId, updateData);

        if (result.success) {
            logInfo('Manual update processed successfully', result);
            return {
                success: true,
                familyId: result.familyId,
                updatedFields: result.updatedFields
            };
        } else {
            return {
                success: false,
                error: result.error
            };
        }

    } catch (error) {
        logError('Manual update processing failed', error);
        return {
            success: false,
            error: error.toString()
        };
    }
}