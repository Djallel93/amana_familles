/**
 * @file src/services/contactService.js
 */

function padFamilyId(id) {
    return String(id).padStart(3, '0');
}

function syncFamilyContact(familyData) {
    try {
        const existingContact = findContactByFamilyId(familyData.id);

        if (existingContact) {
            logInfo(`Suppression contact existant famille: ${familyData.id}`);
            People.People.deleteContact(existingContact.resourceName);
            Utilities.sleep(500);
        }

        createContact(familyData);
        logInfo(`Contact créé/mis à jour pour famille: ${familyData.id}`);
        return { success: true };
    } catch (e) {
        logError('Échec synchronisation contact', e);
        return { success: false, error: e.toString() };
    }
}

function deleteContactForArchivedFamily(familyId) {
    try {
        const contact = findContactByFamilyId(familyId);

        if (!contact) {
            logInfo(`Aucun contact trouvé pour famille ${familyId}, suppression ignorée`);
            return { success: true, message: 'Aucun contact à supprimer' };
        }

        People.People.deleteContact(contact.resourceName);
        logInfo(`Contact supprimé pour famille archivée: ${familyId}`);
        return { success: true, message: 'Contact supprimé avec succès' };
    } catch (e) {
        logError('Échec suppression contact', e);
        return { success: false, error: e.toString() };
    }
}

function findContactByFamilyId(familyId) {
    try {
        const searchId = String(familyId);
        const paddedId = padFamilyId(familyId);
        logInfo(`Recherche contact famille ID: ${searchId} (padded: ${paddedId})`);

        const response = People.People.Connections.list('people/me', {
            pageSize: 2000,
            personFields: 'names,emailAddresses,phoneNumbers,addresses,userDefined,memberships'
        });

        if (!response.connections || response.connections.length === 0) {
            logInfo(`Aucun contact trouvé pour famille ID: ${searchId}`);
            return null;
        }

        logInfo(`Analyse de ${response.connections.length} contacts...`);

        for (const contact of response.connections) {
            if (!contact.names || contact.names.length === 0) continue;

            const givenName = contact.names[0].givenName || '';
            const match = givenName.match(/^(\d+)\s*-/);

            if (match) {
                const contactId = String(parseInt(match[1], 10));
                if (contactId === searchId) {
                    logInfo(`Contact trouvé pour famille ${searchId}`);
                    return contact;
                }
            }
        }

        logInfo(`Aucun contact trouvé pour famille ID: ${searchId}`);
        return null;
    } catch (e) {
        logError(`Échec recherche contact famille ${familyId}`, e);
        return null;
    }
}

function getOrCreateContactGroup(groupName) {
    const cache = CacheService.getScriptCache();
    const cacheKey = `contact_group_${groupName}`;
    const cachedGroupId = cache.get(cacheKey);

    if (cachedGroupId) {
        try {
            People.ContactGroups.get(cachedGroupId);
            return cachedGroupId;
        } catch (e) {
            if (e.message && e.message.includes('404')) {
                logInfo(`Groupe en cache ${groupName} introuvable, suppression cache`);
                cache.remove(cacheKey);
            } else {
                logWarning(`Erreur validation groupe en cache ${groupName}`, e);
            }
        }
    }

    try {
        const groups = People.ContactGroups.list({ pageSize: 1000 });

        if (groups.contactGroups) {
            for (const group of groups.contactGroups) {
                if (group.name === groupName) {
                    cache.put(cacheKey, group.resourceName, CONFIG.CACHE.VERY_LONG);
                    logInfo(`Groupe contact existant trouvé: ${groupName}`);
                    return group.resourceName;
                }
            }
        }

        const newGroup = People.ContactGroups.create({ contactGroup: { name: groupName } });
        cache.put(cacheKey, newGroup.resourceName, CONFIG.CACHE.VERY_LONG);
        logInfo(`Nouveau groupe contact créé: ${groupName}`);
        return newGroup.resourceName;
    } catch (e) {
        logError('Échec récupération/création groupe contact', e);
        return null;
    }
}

function getLocationGroupName(quartierId) {
    if (!quartierId) return null;

    try {
        const hierarchy = getLocationHierarchyFromQuartier(quartierId);

        if (hierarchy.error || !hierarchy.ville || !hierarchy.secteur) {
            logWarning(`Impossible d'obtenir la hiérarchie pour quartier ${quartierId}`);
            return null;
        }

        return `${hierarchy.ville.nom} - ${hierarchy.secteur.nom}`;
    } catch (e) {
        logError('Échec récupération nom groupe localisation', e);
        return null;
    }
}

function buildCustomFields(familyData) {
    const {
        criticite = 0, nombreAdulte = 0, nombreEnfant = 0,
        zakatElFitr = false, sadaqa = false,
        langue = CONFIG.LANGUAGES.FR, seDeplace = false
    } = familyData;

    return [
        { key: 'Criticité', value: String(criticite) },
        { key: 'Adultes', value: String(nombreAdulte) },
        { key: 'Enfants', value: String(nombreEnfant) },
        { key: 'Zakat El Fitr', value: zakatElFitr ? 'Oui' : 'Non' },
        { key: 'Sadaqa', value: sadaqa ? 'Oui' : 'Non' },
        { key: 'Langue', value: langue },
        { key: 'Se Déplace', value: seDeplace ? 'Oui' : 'Non' },
        { key: 'Dernière mise à jour', value: formatDateTime(new Date()) }
    ];
}

function parseFamilyMetadataFromContact(userDefined) {
    const metadata = {
        criticite: 0, nombreAdulte: 0, nombreEnfant: 0,
        zakatElFitr: false, sadaqa: false,
        langue: CONFIG.LANGUAGES.FR, seDeplace: false, lastUpdate: null
    };

    if (!userDefined || userDefined.length === 0) return metadata;

    userDefined.forEach(field => {
        switch (field.key) {
            case 'Criticité': metadata.criticite = parseInt(field.value) || 0; break;
            case 'Adultes': metadata.nombreAdulte = parseInt(field.value) || 0; break;
            case 'Enfants': metadata.nombreEnfant = parseInt(field.value) || 0; break;
            case 'Zakat El Fitr': metadata.zakatElFitr = parseOuiNonToBoolean(field.value); break;
            case 'Sadaqa': metadata.sadaqa = parseOuiNonToBoolean(field.value); break;
            case 'Langue': metadata.langue = field.value; break;
            case 'Se Déplace': metadata.seDeplace = parseOuiNonToBoolean(field.value); break;
            case 'Dernière mise à jour': metadata.lastUpdate = field.value; break;
        }
    });

    return metadata;
}

function parseOuiNonToBoolean(value) {
    if (typeof value === 'boolean') return value;
    const str = String(value).trim().toLowerCase();
    if (str === 'oui' || str === 'yes' || str === 'نعم') return true;
    if (str === 'non' || str === 'no' || str === 'لا') return false;
    return false;
}

function _buildContactResource(familyData) {
    const { id, nom, prenom, email, telephone, phoneBis, adresse } = familyData;
    const paddedId = padFamilyId(id);

    const resource = {
        names: [{
            givenName: `${paddedId} -`,
            middleName: prenom || '',
            familyName: nom || '',
            displayName: `${paddedId} - ${prenom} ${nom}`
        }],
        userDefined: buildCustomFields(familyData)
    };

    if (telephone) {
        const normalizedPhone = normalizePhone(telephone);
        if (!normalizedPhone) {
            logWarning(`Téléphone invalide pour famille ${id}: ${telephone}`);
        } else {
            resource.phoneNumbers = [{ value: normalizedPhone, type: 'mobile' }];
            if (phoneBis) {
                const normalizedPhoneBis = normalizePhone(phoneBis);
                if (normalizedPhoneBis) {
                    resource.phoneNumbers.push({ value: normalizedPhoneBis, type: 'home' });
                }
            }
        }
    }

    if (email && isValidEmail(email)) {
        resource.emailAddresses = [{ value: email, type: 'home' }];
    }

    if (adresse) {
        const parsed = parseAddressComponents(adresse);
        const canonical = formatAddressCanonical(parsed.street, parsed.postalCode, parsed.city);
        resource.addresses = [{
            streetAddress: parsed.street,
            city: parsed.city,
            postalCode: parsed.postalCode,
            country: parsed.country,
            type: 'home',
            formattedValue: canonical
        }];
    }

    return resource;
}

function createContact(familyData) {
    const { id, idQuartier } = familyData;
    const resource = _buildContactResource(familyData);
    const memberships = [];

    const mainGroupId = getOrCreateContactGroup('Famille dans le besoin');
    if (mainGroupId) {
        memberships.push({ contactGroupMembership: { contactGroupResourceName: mainGroupId } });
    }

    const valideGroupId = getOrCreateContactGroup('Validé');
    if (valideGroupId) {
        memberships.push({ contactGroupMembership: { contactGroupResourceName: valideGroupId } });
    }

    if (idQuartier) {
        const locationGroupName = getLocationGroupName(idQuartier);
        if (locationGroupName) {
            const locationGroupId = getOrCreateContactGroup(locationGroupName);
            if (locationGroupId) {
                memberships.push({ contactGroupMembership: { contactGroupResourceName: locationGroupId } });
            }
        }
    }

    if (memberships.length > 0) resource.memberships = memberships;

    logInfo(`Création contact famille ${id} (padded: ${padFamilyId(id)})`, {
        displayName: resource.names[0].displayName,
        groupes: memberships.length
    });

    People.People.createContact(resource);
    logInfo(`Contact créé avec labels: Famille dans le besoin, Validé — famille: ${id}`);
}

function createContactWithStatusLabel(familyData, statusLabel) {
    try {
        const { id } = familyData;
        const resource = _buildContactResource(familyData);
        const memberships = [];

        const statusGroupId = getOrCreateContactGroup(statusLabel);
        if (statusGroupId) {
            memberships.push({ contactGroupMembership: { contactGroupResourceName: statusGroupId } });
        }

        if (memberships.length > 0) resource.memberships = memberships;

        logInfo(`Création contact famille ${id} avec label: ${statusLabel}`);
        People.People.createContact(resource);
        logInfo(`Contact créé avec label ${statusLabel} pour famille: ${id}`);
        return { success: true };
    } catch (e) {
        logError('Échec création contact avec label statut', e);
        return { success: false, error: e.toString() };
    }
}

function updateContactGroups(contactResourceName, idQuartier) {
    try {
        const contact = People.People.get(contactResourceName, { personFields: 'memberships' });
        const currentMemberships = contact.memberships || [];
        const mainGroupId = getOrCreateContactGroup('Famille dans le besoin');
        const newLocationGroupName = idQuartier ? getLocationGroupName(idQuartier) : null;
        const newLocationGroupId = newLocationGroupName ? getOrCreateContactGroup(newLocationGroupName) : null;
        const locationGroupPattern = /^.+ - .+$/;
        const oldLocationGroups = [];

        currentMemberships.forEach(membership => {
            if (!membership.contactGroupMembership) return;
            const groupResourceName = membership.contactGroupMembership.contactGroupResourceName;
            if (groupResourceName === mainGroupId) return;
            if (newLocationGroupId && groupResourceName === newLocationGroupId) return;

            try {
                const groupInfo = People.ContactGroups.get(groupResourceName);
                if (groupInfo.name && locationGroupPattern.test(groupInfo.name)) {
                    oldLocationGroups.push(groupResourceName);
                    logInfo(`Ancien groupe localisation identifié: ${groupInfo.name}`);
                }
            } catch (e) {
                logWarning(`Impossible d'obtenir info groupe ${groupResourceName}`, e);
            }
        });

        oldLocationGroups.forEach(oldGroupId => {
            try {
                People.ContactGroups.Members.modify(oldGroupId, { resourceNamesToRemove: [contactResourceName] });
                logInfo(`Contact retiré de l'ancien groupe: ${oldGroupId}`);
            } catch (e) {
                logError(`Échec retrait contact du groupe ${oldGroupId}`, e);
            }
        });

        const hasMainGroup = currentMemberships.some(m =>
            m.contactGroupMembership &&
            m.contactGroupMembership.contactGroupResourceName === mainGroupId
        );

        if (!hasMainGroup && mainGroupId) {
            People.ContactGroups.Members.modify(mainGroupId, { resourceNamesToAdd: [contactResourceName] });
            logInfo('Contact ajouté au groupe principal: Famille dans le besoin');
        }

        if (newLocationGroupId) {
            const hasNewLocationGroup = currentMemberships.some(m =>
                m.contactGroupMembership &&
                m.contactGroupMembership.contactGroupResourceName === newLocationGroupId
            );
            if (!hasNewLocationGroup) {
                People.ContactGroups.Members.modify(newLocationGroupId, { resourceNamesToAdd: [contactResourceName] });
                logInfo(`Contact ajouté au nouveau groupe localisation: ${newLocationGroupName}`);
            }
        }
    } catch (e) {
        logError('Échec mise à jour groupes contact', e);
    }
}

function updateContactLabelsForStatus(familyId, statusLabel) {
    try {
        logInfo(`Mise à jour labels contact famille ${familyId} vers: ${statusLabel}`);
        const contact = findContactByFamilyId(familyId);

        if (!contact) {
            logWarning(`Aucun contact trouvé pour famille ${familyId}, mise à jour labels ignorée`);
            return { success: true, message: 'Aucun contact à mettre à jour' };
        }

        const statusGroupId = getOrCreateContactGroup(statusLabel);
        if (!statusGroupId) {
            logError(`Échec récupération/création groupe: ${statusLabel}`);
            return { success: false, error: `Impossible de créer/récupérer le groupe: ${statusLabel}` };
        }

        People.People.updateContact(
            {
                resourceName: contact.resourceName,
                memberships: [{ contactGroupMembership: { contactGroupResourceName: statusGroupId } }],
                etag: contact.etag
            },
            contact.resourceName,
            { updatePersonFields: 'memberships', personFields: 'memberships' }
        );

        logInfo(`Labels mis à jour avec succès: ${statusLabel} — famille: ${familyId}`);
        return { success: true, message: `Labels mis à jour: ${statusLabel}` };
    } catch (e) {
        logError(`Échec mise à jour labels contact famille ${familyId}`, e);
        return { success: false, error: e.toString() };
    }
}

function clearContactGroupCache(groupName) {
    try {
        const cache = CacheService.getScriptCache();
        cache.remove(`contact_group_${groupName}`);
        logInfo(`Cache groupe contact effacé: ${groupName}`);
    } catch (e) {
        logWarning(`Échec effacement cache groupe ${groupName}`, e);
    }
}