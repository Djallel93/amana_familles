/**
 * @file src/services/contactService.js (UPDATED v8.0 - FIXED BOOLEAN PARSING)
 * @description Contact management - Uses CANONICAL address formatting
 * CRITICAL FIX: parseFamilyMetadataFromContact now correctly handles 'Oui'/'Non' strings
 */

/**
 * Create or update Google contact for a family
 */
function syncFamilyContact(familyData) {
    try {
        const { id, nom, prenom, email, telephone, adresse } = familyData;

        const existingContact = findContactByFamilyId(id);

        if (existingContact) {
            logInfo(`Deleting existing contact for family: ${id}`);
            People.People.deleteContact(existingContact.resourceName);
            Utilities.sleep(500);
            logInfo(`Creating new contact for family: ${id}`);
            createContact(familyData);
        } else {
            createContact(familyData);
            logInfo(`Contact created for family: ${id}`);
        }

        return { success: true };
    } catch (e) {
        logError('Contact sync failed', e);
        return { success: false, error: e.toString() };
    }
}

/**
 * Delete contact for archived family
 */
function deleteContactForArchivedFamily(familyId) {
    try {
        const contact = findContactByFamilyId(familyId);

        if (!contact) {
            logInfo(`No contact found for family ${familyId}, skipping deletion`);
            return { success: true, message: 'No contact to delete' };
        }

        People.People.deleteContact(contact.resourceName);
        logInfo(`Contact deleted for archived family: ${familyId}`);

        return { success: true, message: 'Contact deleted successfully' };
    } catch (e) {
        logError('Contact deletion failed', e);
        return { success: false, error: e.toString() };
    }
}

/**
 * Find contact by family ID parsed from givenName (first name)
 * Format: "{ID} -" in givenName field
 */
function findContactByFamilyId(familyId) {
    try {
        const searchId = String(familyId);
        logInfo(`Searching for contact with family ID: ${searchId}`);

        const response = People.People.Connections.list('people/me', {
            pageSize: 2000,
            personFields: 'names,emailAddresses,phoneNumbers,addresses,userDefined,memberships'
        });

        if (response.connections && response.connections.length > 0) {
            logInfo(`Scanning ${response.connections.length} contacts...`);

            for (const contact of response.connections) {
                if (contact.names && contact.names.length > 0) {
                    const givenName = contact.names[0].givenName || '';

                    // Parse ID from givenName format: "{ID} -"
                    const match = givenName.match(/^(\d+)\s*-/);
                    if (match && match[1] === searchId) {
                        logInfo(`Contact found for family ${searchId}`);
                        return contact;
                    }
                }
            }
        }

        logInfo(`No contact found for family ID: ${searchId}`);
        return null;

    } catch (e) {
        logError(`Contact search failed for family ${familyId}`, e);
        return null;
    }
}

/**
 * Get or create contact group
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
        logInfo(`New contact group created: ${groupName}`);

        return newGroup.resourceName;

    } catch (e) {
        logError('Failed to get/create contact group', e);
        return null;
    }
}

/**
 * Get location group name based on quartier
 */
function getLocationGroupName(quartierId) {
    if (!quartierId) {
        return null;
    }

    try {
        const hierarchy = getLocationHierarchyFromQuartier(quartierId);

        if (hierarchy.error || !hierarchy.ville || !hierarchy.secteur) {
            logWarning(`Cannot get hierarchy for quartier ${quartierId}`);
            return null;
        }

        return `${hierarchy.ville.nom} - ${hierarchy.secteur.nom}`;

    } catch (e) {
        logError('Failed to get location group name', e);
        return null;
    }
}

/**
 * Build custom fields for a contact (WITHOUT ID - ID is in givenName)
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

    // Format current timestamp for last update
    const lastUpdate = formatDateTime(new Date());

    const customFields = [
        // ID REMOVED - now in givenName
        { key: 'Criticité', value: String(criticite) },
        { key: 'Adultes', value: String(nombreAdulte) },
        { key: 'Enfants', value: String(nombreEnfant) },
        { key: 'Zakat El Fitr', value: zakatElFitr ? 'Oui' : 'Non' },
        { key: 'Sadaqa', value: sadaqa ? 'Oui' : 'Non' },
        { key: 'Langue', value: langue },
        { key: 'Se Déplace', value: seDeplace ? 'Oui' : 'Non' },
        { key: 'Dernière mise à jour', value: lastUpdate }
    ];

    return customFields;
}

/**
 * Parse family metadata from contact custom fields (ID parsed from givenName separately)
 * CRITICAL FIX: Properly parse 'Oui'/'Non' strings to boolean
 */
function parseFamilyMetadataFromContact(userDefined) {
    const metadata = {
        // familyId NOT parsed here - parsed from givenName instead
        criticite: 0,
        nombreAdulte: 0,
        nombreEnfant: 0,
        zakatElFitr: false,
        sadaqa: false,
        langue: CONFIG.LANGUAGES.FR,
        seDeplace: false,
        lastUpdate: null
    };

    if (!userDefined || userDefined.length === 0) {
        return metadata;
    }

    userDefined.forEach(field => {
        const key = field.key;
        const value = field.value;

        switch (key) {
            // ID REMOVED - no longer in custom fields
            case 'Criticité':
                metadata.criticite = parseInt(value) || 0;
                break;
            case 'Adultes':
                metadata.nombreAdulte = parseInt(value) || 0;
                break;
            case 'Enfants':
                metadata.nombreEnfant = parseInt(value) || 0;
                break;
            case 'Zakat El Fitr':
                // CRITICAL FIX: Properly handle 'Oui'/'Non' strings
                metadata.zakatElFitr = parseOuiNonToBoolean(value);
                break;
            case 'Sadaqa':
                // CRITICAL FIX: Properly handle 'Oui'/'Non' strings
                metadata.sadaqa = parseOuiNonToBoolean(value);
                break;
            case 'Langue':
                metadata.langue = value;
                break;
            case 'Se Déplace':
                // CRITICAL FIX: Properly handle 'Oui'/'Non' strings
                metadata.seDeplace = parseOuiNonToBoolean(value);
                break;
            case 'Dernière mise à jour':
                metadata.lastUpdate = value;
                break;
        }
    });

    return metadata;
}

/**
 * CRITICAL NEW FUNCTION: Parse 'Oui'/'Non' strings to boolean
 * Handles French, English, Arabic, and boolean values
 * 
 * @param {*} value - Value to parse (string, boolean, or other)
 * @returns {boolean} - Parsed boolean value
 */
function parseOuiNonToBoolean(value) {
    // If already boolean, return as-is
    if (typeof value === 'boolean') {
        return value;
    }

    // Convert to lowercase string for comparison
    const strValue = String(value).trim().toLowerCase();

    // Check for positive values (French, English, Arabic)
    if (strValue === 'oui' || strValue === 'yes' || strValue === 'نعم') {
        return true;
    }

    // Check for negative values (French, English, Arabic)
    if (strValue === 'non' || strValue === 'no' || strValue === 'لا') {
        return false;
    }

    // Default to false for unrecognized values
    return false;
}

/**
 * Create new contact with complete structure (ID in givenName)
 * UPDATED: Uses formatAddressCanonical for consistent address storage
 */
function createContact(familyData) {
    const { id, nom, prenom, email, telephone, phoneBis, adresse, idQuartier } = familyData;

    const contactResource = {
        names: [{
            givenName: `${id} -`,  // ID in givenName
            middleName: prenom || '',
            familyName: nom || '',
            displayName: `${id} - ${prenom} ${nom}`
        }],
        userDefined: buildCustomFields(familyData)  // No ID in custom fields
    };

    if (telephone) {
        const normalizedPhone = normalizePhone(telephone);

        if (!normalizedPhone) {
            logWarning(`Invalid phone for family ${id}: ${telephone}`);
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

    // CRITICAL FIX: Use canonical address formatting
    if (adresse) {
        const parsedAddress = parseAddressComponents(adresse);

        // Store in canonical format using formatAddressCanonical
        const canonicalAddress = formatAddressCanonical(
            parsedAddress.street,
            parsedAddress.postalCode,
            parsedAddress.city
        );

        logInfo(`Storing contact address in canonical format: "${canonicalAddress}"`);

        contactResource.addresses = [{
            streetAddress: parsedAddress.street,
            city: parsedAddress.city,
            postalCode: parsedAddress.postalCode,
            country: parsedAddress.country,
            type: 'home',
            formattedValue: canonicalAddress  // Store canonical format
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

    logInfo(`Creating contact for family ${id}`, {
        displayName: `${id} - ${prenom} ${nom}`,
        phone: contactResource.phoneNumbers ? contactResource.phoneNumbers[0].value : 'none',
        email: email || 'none',
        criticite: familyData.criticite,
        household: `${familyData.nombreAdulte}A/${familyData.nombreEnfant}E`,
        customFieldsCount: contactResource.userDefined.length
    });

    People.People.createContact(contactResource);
    logInfo(`Contact created with custom fields for family: ${id}`);
}

/**
 * Update contact groups
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
                        logInfo(`Old location group identified: ${groupInfo.name}`);
                    }
                } catch (e) {
                    logWarning(`Cannot get group info for ${groupResourceName}`, e);
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
                    logInfo(`Contact removed from old location group: ${oldGroupId}`);
                } catch (e) {
                    logError(`Failed to remove contact from group ${oldGroupId}`, e);
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
            logInfo(`Contact added to main group: Famille dans le besoin`);
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
                logInfo(`Contact added to new location group: ${newLocationGroupName}`);
            }
        }

    } catch (e) {
        logError('Failed to update contact groups', e);
    }
}