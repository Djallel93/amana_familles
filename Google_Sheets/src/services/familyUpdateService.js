function updateFamilyById(familyId, updateData) {
    try {
        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (!sheet) {
            return { success: false, error: 'Feuille Famille introuvable' };
        }

        const data = sheet.getDataRange().getValues();
        let targetRow = -1;

        for (let i = 1; i < data.length; i++) {
            if (data[i][OUTPUT_COLUMNS.ID] === familyId || data[i][OUTPUT_COLUMNS.ID] == familyId) {
                targetRow = i + 1;
                break;
            }
        }

        if (targetRow === -1) {
            return { success: false, error: `Famille introuvable: ${familyId}` };
        }

        const existingData = data[targetRow - 1];
        const changes = [];
        const forceInProgress = updateData.forceInProgress === true;
        delete updateData.forceInProgress;
        let quartierWarning = null;

        if (updateData.lastName) {
            sheet.getRange(targetRow, OUTPUT_COLUMNS.NOM + 1).setValue(updateData.lastName);
            changes.push('nom');
        }

        if (updateData.firstName) {
            sheet.getRange(targetRow, OUTPUT_COLUMNS.PRENOM + 1).setValue(updateData.firstName);
            changes.push('prenom');
        }

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

        if (updateData.nombreAdulte !== undefined && updateData.nombreAdulte !== null) {
            const adultes = parseInt(updateData.nombreAdulte);
            if (isNaN(adultes) || adultes < 0) {
                return { success: false, error: "Nombre d'adultes invalide" };
            }
            sheet.getRange(targetRow, OUTPUT_COLUMNS.NOMBRE_ADULTE + 1).setValue(adultes);
            changes.push('nombre_adulte');
        }

        if (updateData.nombreEnfant !== undefined && updateData.nombreEnfant !== null) {
            const enfants = parseInt(updateData.nombreEnfant);
            if (isNaN(enfants) || enfants < 0) {
                return { success: false, error: "Nombre d'enfants invalide" };
            }
            sheet.getRange(targetRow, OUTPUT_COLUMNS.NOMBRE_ENFANT + 1).setValue(enfants);
            changes.push('nombre_enfant');
        }

        if (updateData.address || updateData.postalCode || updateData.city) {
            const newAddress = updateData.address;
            const newPostalCode = updateData.postalCode;
            const newCity = updateData.city;

            const existingParsed = parseAddressComponents(existingData[OUTPUT_COLUMNS.ADRESSE]);
            const resolvedAddress = newAddress || existingParsed.street || '';
            const resolvedPostalCode = newPostalCode || existingParsed.postalCode || '';
            const resolvedCity = newCity || existingParsed.city || '';

            if (resolvedAddress && resolvedPostalCode && resolvedCity) {
                const addressValidation = validateAddressAndGetQuartier(
                    resolvedAddress,
                    resolvedPostalCode,
                    resolvedCity
                );

                if (!addressValidation.isValid) {
                    return { success: false, error: `Adresse invalide: ${addressValidation.error}` };
                }

                const fullAddress = formatAddressCanonical(resolvedAddress, resolvedPostalCode, resolvedCity);
                sheet.getRange(targetRow, OUTPUT_COLUMNS.ADRESSE + 1).setValue(fullAddress);
                sheet.getRange(targetRow, OUTPUT_COLUMNS.ID_QUARTIER + 1).setValue(addressValidation.quartierId || '');
                changes.push('adresse');

                if (addressValidation.quartierInvalid) {
                    quartierWarning = addressValidation.warning;
                }
            }
        }

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

        if (updateData.langue) {
            const validLanguages = [CONFIG.LANGUAGES.FR, CONFIG.LANGUAGES.AR, CONFIG.LANGUAGES.EN];
            if (!validLanguages.includes(updateData.langue)) {
                return { success: false, error: 'Langue invalide (doit être: Français, Arabe, ou Anglais)' };
            }
            sheet.getRange(targetRow, OUTPUT_COLUMNS.LANGUE + 1).setValue(updateData.langue);
            changes.push('langue');
        }

        if (updateData.seDeplace !== undefined) {
            sheet.getRange(targetRow, OUTPUT_COLUMNS.SE_DEPLACE + 1).setValue(updateData.seDeplace === true);
            changes.push('se_deplace');
        }

        if (updateData.zakatElFitr !== undefined) {
            sheet.getRange(targetRow, OUTPUT_COLUMNS.ZAKAT_EL_FITR + 1).setValue(updateData.zakatElFitr === true);
            changes.push('zakat_el_fitr');
        }

        if (updateData.sadaqa !== undefined) {
            sheet.getRange(targetRow, OUTPUT_COLUMNS.SADAQA + 1).setValue(updateData.sadaqa === true);
            changes.push('sadaqa');
        }

        const currentStatus = existingData[OUTPUT_COLUMNS.ETAT_DOSSIER];
        if (forceInProgress || (quartierWarning && currentStatus === CONFIG.STATUS.VALIDATED)) {
            sheet.getRange(targetRow, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).setValue(CONFIG.STATUS.IN_PROGRESS);
            changes.push('statut (changé à En cours)');
        }

        if (changes.length > 0) {
            let commentMsg = `Mis à jour: ${changes.join(', ')}`;
            if (forceInProgress) {
                commentMsg += ' | Statut → En cours (màj en masse)';
            }
            if (quartierWarning) {
                commentMsg += ` | ${quartierWarning}`;
            }
            appendSheetComment(sheet, targetRow, '📝', commentMsg);
        }

        const finalStatus = sheet.getRange(targetRow, OUTPUT_COLUMNS.ETAT_DOSSIER + 1).getValue();
        if (finalStatus === CONFIG.STATUS.VALIDATED) {
            const contactData = {
                id: familyId,
                nom: updateData.lastName || existingData[OUTPUT_COLUMNS.NOM],
                prenom: updateData.firstName || existingData[OUTPUT_COLUMNS.PRENOM],
                email: updateData.email || existingData[OUTPUT_COLUMNS.EMAIL],
                telephone: updateData.phone ? normalizePhone(updateData.phone) : existingData[OUTPUT_COLUMNS.TELEPHONE],
                phoneBis: updateData.phoneBis ? normalizePhone(updateData.phoneBis) : existingData[OUTPUT_COLUMNS.TELEPHONE_BIS],
                adresse: updateData.address || existingData[OUTPUT_COLUMNS.ADRESSE],
                idQuartier: existingData[OUTPUT_COLUMNS.ID_QUARTIER]
            };
            syncFamilyContact(contactData);
        }

        const cache = CacheService.getScriptCache();
        cache.remove(`api_family_${familyId}`);
        cache.remove(`folder_${familyId}`);

        logInfo('Family updated successfully', { familyId, changes, forceInProgress });

        return {
            success: true,
            familyId: familyId,
            updatedFields: changes,
            quartierWarning: quartierWarning
        };

    } catch (error) {
        logError('Failed to update family', error);
        return { success: false, error: error.toString() };
    }
}

function processManualUpdate(familyId, updateData) {
    try {
        logInfo('Processing manual update', { familyId, updateData });

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

        const result = updateFamilyById(familyId, updateData);

        if (result.success) {
            logInfo('Manual update processed successfully', result);
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
        logError('Manual update processing failed', error);
        return { success: false, error: error.toString() };
    }
}