/**
 * @file src/services/contactService.js (REFACTORÉ v4.0)
 * @description Gestion des contacts Google avec structure de nom propre
 * CHANGEMENT: Utilise parseAddressComponents() de utils.js (ZERO duplication)
 */

/**
 * Crée ou met à jour un contact Google pour une famille
 * @param {Object} familyData - Données de la famille
 * @returns {Object} {success: boolean, error?: string}
 */
function syncFamilyContact(familyData) {
    try {
        const { id, nom, prenom, email, telephone, adresse } = familyData;

        const existingContact = findContactByFamilyId(id);

        if (existingContact) {
            logInfo(`Suppression contact existant pour famille: ${id}`);
            People.People.deleteContact(existingContact.resourceName);

            Utilities.sleep(500);

            logInfo(`Création nouveau contact pour famille: ${id}`);
            createContact(familyData);
        } else {
            createContact(familyData);
            logInfo(`Contact créé pour famille: ${id}`);
        }

        return { success: true };
    } catch (e) {
        logError('Échec sync contact', e);
        return { success: false, error: e.toString() };
    }
}

/**
 * Supprime le contact d'une famille archivée
 * @param {string} familyId - ID de la famille
 * @returns {Object} {success: boolean, message?: string, error?: string}
 */
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

/**
 * Cherche un contact par ID famille dans le champ personnalisé
 * @param {string} familyId - ID de la famille
 * @returns {Object|null} Contact ou null
 */
function findContactByFamilyId(familyId) {
    try {
        const searchId = String(familyId);

        logInfo(`Recherche contact avec ID famille: ${searchId}`);

        const response = People.People.Connections.list('people/me', {
            pageSize: 2000,
            personFields: 'names,emailAddresses,phoneNumbers,addresses,userDefined,memberships'
        });

        if (response.connections && response.connections.length > 0) {
            logInfo(`Scan de ${response.connections.length} contacts...`);

            for (const contact of response.connections) {
                if (contact.userDefined) {
                    for (const field of contact.userDefined) {
                        if (field.key === 'ID' && field.value === searchId) {
                            logInfo(`Contact trouvé pour famille ${searchId}`);
                            return contact;
                        }
                    }
                }
            }
        }

        logInfo(`Aucun contact trouvé pour ID famille: ${searchId}`);
        return null;

    } catch (e) {
        logError(`Erreur recherche contact pour famille ${familyId}`, e);
        return null;
    }
}

/**
 * Récupère ou crée un groupe de contacts
 * @param {string} groupName - Nom du groupe
 * @returns {string|null} Resource name du groupe
 */
function getOrCreateContactGroup(groupName) {
    const cache = CacheService.getScriptCache();
    const cacheKey = `contact_group_${groupName}`;

    const cachedGroupId = cache.get(cacheKey);
    if (cachedGroupId) {
        return cachedGroupId;
    }

    try {
        const groups = People.ContactGroups.list({
            pageSize: 1000
        });

        if (groups.contactGroups) {
            for (const group of groups.contactGroups) {
                if (group.name === groupName) {
                    cache.put(cacheKey, group.resourceName, CONFIG.CACHE.VERY_LONG);
                    return group.resourceName;
                }
            }
        }

        const newGroup = People.ContactGroups.create({
            contactGroup: {
                name: groupName
            }
        });

        cache.put(cacheKey, newGroup.resourceName, CONFIG.CACHE.VERY_LONG);
        logInfo(`Nouveau groupe de contacts créé: ${groupName}`);

        return newGroup.resourceName;

    } catch (e) {
        logError('Échec récupération/création groupe contact', e);
        return null;
    }
}

/**
 * Récupère le nom du groupe basé sur la localisation
 * @param {string} quartierId - ID du quartier
 * @returns {string|null} Nom du groupe
 */
function getLocationGroupName(quartierId) {
    if (!quartierId) {
        return null;
    }

    try {
        const hierarchy = getLocationHierarchyFromQuartier(quartierId);

        if (hierarchy.error || !hierarchy.ville || !hierarchy.secteur) {
            logWarning(`Impossible de récupérer hiérarchie pour quartier ${quartierId}`);
            return null;
        }

        return `${hierarchy.ville.nom} - ${hierarchy.secteur.nom}`;

    } catch (e) {
        logError('Échec récupération nom groupe localisation', e);
        return null;
    }
}

/**
 * Construit les champs personnalisés pour un contact
 * @param {Object} familyData - Données de la famille
 * @returns {Array} Tableau de champs personnalisés
 */
function buildCustomFields(familyData) {
    const {
        criticite = 0,
        nombreAdulte = 0,
        nombreEnfant = 0,
        zakatElFitr = false,
        sadaqa = false,
        langue = CONFIG.LANGUAGES.FR,
        seDeplace = false
    } = familyData;

    const customFields = [
        { key: 'Criticité', value: String(criticite) },
        { key: 'Adultes', value: String(nombreAdulte) },
        { key: 'Enfants', value: String(nombreEnfant) },
        { key: 'Zakat El Fitr', value: zakatElFitr ? 'Oui' : 'Non' },
        { key: 'Sadaqa', value: sadaqa ? 'Oui' : 'Non' },
        { key: 'Langue', value: langue },
        { key: 'Se Déplace', value: seDeplace ? 'Oui' : 'Non' }
    ];

    return customFields;
}

/**
 * Parse les métadonnées famille depuis les champs personnalisés d'un contact
 * @param {Array} userDefined - Champs personnalisés du contact
 * @returns {Object} Métadonnées parsées
 */
function parseFamilyMetadataFromContact(userDefined) {
    const metadata = {
        familyId: null,
        criticite: 0,
        nombreAdulte: 0,
        nombreEnfant: 0,
        zakatElFitr: false,
        sadaqa: false,
        langue: CONFIG.LANGUAGES.FR,
        seDeplace: false
    };

    if (!userDefined || userDefined.length === 0) {
        return metadata;
    }

    userDefined.forEach(field => {
        const key = field.key;
        const value = field.value;

        if (key === 'ID') {
            metadata.familyId = value;
        } else if (key === 'Criticité') {
            metadata.criticite = parseInt(value) || 0;
        } else if (key === 'Adultes') {
            metadata.nombreAdulte = parseInt(value) || 0;
        } else if (key === 'Enfants') {
            metadata.nombreEnfant = parseInt(value) || 0;
        } else if (key === 'Éligibilité') {
            metadata.zakatElFitr = value.includes('Zakat El Fitr');
            metadata.sadaqa = value.includes('Sadaqa');
        } else if (key === 'Langue') {
            metadata.langue = value;
        } else if (key === 'Se Déplace') {
            metadata.seDeplace = value === 'Oui';
        }
    });

    return metadata;
}

/**
 * Crée un nouveau contact avec structure de nom correcte
 * Structure: givenName: "ID -", middleName: "Prenom", familyName: "Nom"
 * @param {Object} familyData - Données de la famille
 */
function createContact(familyData) {
    const { id, nom, prenom, email, telephone, phoneBis, adresse, idQuartier } = familyData;

    const contactResource = {
        names: [{
            givenName: `${id} -`,
            middleName: prenom || '',
            familyName: nom || '',
            displayName: `${id} - ${prenom} ${nom}`
        }],
        userDefined: buildCustomFields(familyData)
    };

    if (telephone) {
        const normalizedPhone = normalizePhone(telephone);

        if (!normalizedPhone) {
            logWarning(`Numéro téléphone invalide pour famille ${id}: ${telephone}`);
        } else {
            contactResource.phoneNumbers = [{
                value: normalizedPhone,
                type: 'mobile'
            }];

            if (phoneBis) {
                const normalizedPhoneBis = normalizePhone(phoneBis);
                if (normalizedPhoneBis) {
                    contactResource.phoneNumbers.push({
                        value: normalizedPhoneBis,
                        type: 'home'
                    });
                }
            }
        }
    }

    if (email && isValidEmail(email)) {
        contactResource.emailAddresses = [{
            value: email,
            type: 'home'
        }];
    }

    if (adresse) {
        const parsedAddress = parseAddressComponents(adresse);
        contactResource.addresses = [{
            streetAddress: parsedAddress.street,
            city: parsedAddress.city,
            postalCode: parsedAddress.postalCode,
            country: parsedAddress.country,
            type: 'home'
        }];
    }

    const memberships = [];

    const mainGroupId = getOrCreateContactGroup('Famille dans le besoin');
    if (mainGroupId) {
        memberships.push({
            contactGroupMembership: {
                contactGroupResourceName: mainGroupId
            }
        });
    }

    if (idQuartier) {
        const locationGroupName = getLocationGroupName(idQuartier);
        if (locationGroupName) {
            const locationGroupId = getOrCreateContactGroup(locationGroupName);
            if (locationGroupId) {
                memberships.push({
                    contactGroupMembership: {
                        contactGroupResourceName: locationGroupId
                    }
                });
            }
        }
    }

    if (memberships.length > 0) {
        contactResource.memberships = memberships;
    }

    logInfo(`Création contact pour famille ${id}`, {
        displayName: `${id} - ${prenom} ${nom}`,
        phone: contactResource.phoneNumbers ? contactResource.phoneNumbers[0].value : 'aucun',
        email: email || 'aucun',
        criticite: familyData.criticite,
        household: `${familyData.nombreAdulte}A/${familyData.nombreEnfant}E`,
        customFieldsCount: contactResource.userDefined.length
    });

    People.People.createContact(contactResource);
    logInfo(`Contact créé avec champs personnalisés pour famille: ${id}`);
}

/**
 * Met à jour les groupes d'un contact
 * @param {string} contactResourceName - Resource name du contact
 * @param {string} idQuartier - ID du quartier
 */
function updateContactGroups(contactResourceName, idQuartier) {
    try {
        const contact = People.People.get({
            resourceName: contactResourceName,
            personFields: 'memberships'
        });

        const currentMemberships = contact.memberships || [];
        const mainGroupId = getOrCreateContactGroup('Famille dans le besoin');
        const newLocationGroupName = idQuartier ? getLocationGroupName(idQuartier) : null;
        const newLocationGroupId = newLocationGroupName ? getOrCreateContactGroup(newLocationGroupName) : null;

        const locationGroupPattern = /^.+ - .+$/;
        const oldLocationGroups = [];

        currentMemberships.forEach(membership => {
            if (membership.contactGroupMembership) {
                const groupResourceName = membership.contactGroupMembership.contactGroupResourceName;

                if (groupResourceName === mainGroupId) {
                    return;
                }

                if (newLocationGroupId && groupResourceName === newLocationGroupId) {
                    return;
                }

                try {
                    const groupInfo = People.ContactGroups.get({
                        resourceName: groupResourceName
                    });

                    if (groupInfo.name && locationGroupPattern.test(groupInfo.name)) {
                        oldLocationGroups.push(groupResourceName);
                        logInfo(`Ancien groupe localisation identifié: ${groupInfo.name}`);
                    }
                } catch (e) {
                    logWarning(`Impossible récupérer info groupe ${groupResourceName}`, e);
                }
            }
        });

        if (oldLocationGroups.length > 0) {
            oldLocationGroups.forEach(oldGroupId => {
                try {
                    People.ContactGroups.Members.modify({
                        resourceName: oldGroupId,
                        modifyContactGroupMembersRequest: {
                            resourceNamesToRemove: [contactResourceName]
                        }
                    });
                    logInfo(`Contact retiré ancien groupe localisation: ${oldGroupId}`);
                } catch (e) {
                    logError(`Échec retrait contact du groupe ${oldGroupId}`, e);
                }
            });
        }

        const hasMainGroup = currentMemberships.some(m =>
            m.contactGroupMembership &&
            m.contactGroupMembership.contactGroupResourceName === mainGroupId
        );

        if (!hasMainGroup && mainGroupId) {
            People.ContactGroups.Members.modify({
                resourceName: mainGroupId,
                modifyContactGroupMembersRequest: {
                    resourceNamesToAdd: [contactResourceName]
                }
            });
            logInfo(`Contact ajouté au groupe principal: Famille dans le besoin`);
        }

        if (newLocationGroupId) {
            const hasNewLocationGroup = currentMemberships.some(m =>
                m.contactGroupMembership &&
                m.contactGroupMembership.contactGroupResourceName === newLocationGroupId
            );

            if (!hasNewLocationGroup) {
                People.ContactGroups.Members.modify({
                    resourceName: newLocationGroupId,
                    modifyContactGroupMembersRequest: {
                        resourceNamesToAdd: [contactResourceName]
                    }
                });
                logInfo(`Contact ajouté nouveau groupe localisation: ${newLocationGroupName}`);
            }
        }

    } catch (e) {
        logError('Échec mise à jour groupes contact', e);
    }
}