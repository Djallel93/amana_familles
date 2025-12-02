/**
 * @file src/services/contactService.js (ENHANCED)
 * @description Manage Google Contacts with custom fields and reverse sync support
 */

/**
 * Create or update Google Contact for a family
 * ENHANCED: Now stores criticité, household composition, and eligibility in notes
 */
function syncFamilyContact(familyData) {
    try {
        const { id, nom, prenom, email, telephone, adresse } = familyData;

        const existingContact = findContactByFamilyId(id);

        if (existingContact) {
            // Delete and recreate to avoid etag/404 issues
            logInfo(`Deleting existing contact for family: ${id}`);
            People.People.deleteContact(existingContact.resourceName);

            // Wait for deletion to propagate
            Utilities.sleep(500);

            logInfo(`Creating fresh contact for family: ${id}`);
            createContact(familyData);
        } else {
            createContact(familyData);
            logInfo(`Contact created for family: ${id}`);
        }

        return { success: true };
    } catch (e) {
        logError('Failed to sync contact', e);
        return { success: false, error: e.toString() };
    }
}

/**
 * Delete contact when family is archived
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
        logError('Failed to delete contact', e);
        return { success: false, error: e.toString() };
    }
}

/**
 * Find contact by family ID stored in notes
 */
function findContactByFamilyId(familyId) {
    try {
        const searchId = String(familyId);

        logInfo(`Searching for contact with family ID: ${searchId}`);

        const response = People.People.Connections.list('people/me', {
            pageSize: 2000,
            personFields: 'names,emailAddresses,phoneNumbers,addresses,biographies,memberships'
        });

        if (response.connections && response.connections.length > 0) {
            logInfo(`Scanning ${response.connections.length} total contacts...`);

            for (const contact of response.connections) {
                if (contact.biographies) {
                    for (const bio of contact.biographies) {
                        if (bio.value && bio.value.includes(`Family ID: ${searchId}`)) {
                            logInfo(`Found match in connections list for family ${searchId}`);
                            return contact;
                        }
                    }
                }
            }
        }

        logInfo(`No contact found for family ID: ${searchId}`);
        return null;

    } catch (e) {
        logError(`Error finding contact for family ${familyId}`, e);
        return null;
    }
}

/**
 * Get or create contact group by name
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
        logInfo(`Created new contact group: ${groupName}`);

        return newGroup.resourceName;

    } catch (e) {
        logError('Failed to get or create contact group', e);
        return null;
    }
}

/**
 * Get location-based group name from quartier ID
 */
function getLocationGroupName(quartierId) {
    if (!quartierId) {
        return null;
    }

    try {
        const hierarchy = getLocationHierarchyFromQuartier(quartierId);

        if (hierarchy.error || !hierarchy.ville || !hierarchy.secteur) {
            logWarning(`Unable to get location hierarchy for quartier ${quartierId}`);
            return null;
        }

        return `${hierarchy.ville.nom} - ${hierarchy.secteur.nom}`;

    } catch (e) {
        logError('Failed to get location group name', e);
        return null;
    }
}

/**
 * Parse address from full address string
 */
function parseAddress(fullAddress) {
    if (!fullAddress) {
        return { street: '', postalCode: '', city: '', country: 'France' };
    }

    const parts = fullAddress.split(',').map(p => p.trim());

    if (parts.length < 2) {
        return { street: fullAddress, postalCode: '', city: '', country: 'France' };
    }

    const street = parts[0];
    const secondPart = parts[1];

    const postalCodeMatch = secondPart.match(/\b(\d{5})\b/);
    const postalCode = postalCodeMatch ? postalCodeMatch[1] : '';
    const city = postalCode ? secondPart.replace(postalCode, '').trim() : secondPart;

    const country = parts.length >= 3 ? parts[parts.length - 1] : 'France';

    return { street, postalCode, city, country };
}

/**
 * Build comprehensive notes field with all family metadata
 * ENHANCED: Now includes criticité, household composition, and eligibility
 */
function buildFamilyNotes(familyData) {
    const {
        id,
        criticite = 0,
        nombreAdulte = 0,
        nombreEnfant = 0,
        zakatElFitr = false,
        sadaqa = false,
        langue = CONFIG.LANGUAGES.FR
    } = familyData;

    const eligibilityList = [];
    if (zakatElFitr) eligibilityList.push('Zakat El Fitr');
    if (sadaqa) eligibilityList.push('Sadaqa');
    const eligibilityText = eligibilityList.length > 0 ? eligibilityList.join(', ') : 'Aucune';

    // Build structured notes (one line per field for easy parsing)
    const notes = [
        `Family ID: ${id}`,
        `Criticité: ${criticite}`,
        `Adultes: ${nombreAdulte}`,
        `Enfants: ${nombreEnfant}`,
        `Éligibilité: ${eligibilityText}`,
        `Langue: ${langue}`
    ].join('\n');

    return notes;
}

/**
 * Parse family metadata from contact notes
 * Returns structured object with all custom fields
 */
function parseFamilyNotesFromContact(biographies) {
    const metadata = {
        familyId: null,
        criticite: 0,
        nombreAdulte: 0,
        nombreEnfant: 0,
        zakatElFitr: false,
        sadaqa: false,
        langue: CONFIG.LANGUAGES.FR
    };

    if (!biographies || biographies.length === 0) {
        return metadata;
    }

    const notes = biographies[0].value;
    if (!notes) return metadata;

    // Parse each line
    const lines = notes.split('\n');
    lines.forEach(line => {
        const [key, value] = line.split(':').map(s => s.trim());

        if (key === 'Family ID') {
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
        }
    });

    return metadata;
}

/**
 * Create new contact with groups, structured address, and custom fields
 * ENHANCED: Now stores criticité, household, and eligibility in notes
 */
function createContact(familyData) {
    const { id, nom, prenom, email, telephone, phoneBis, adresse, idQuartier } = familyData;

    const contactResource = {
        names: [{
            givenName: prenom || '',
            familyName: nom || '',
            displayName: `${prenom} ${nom}`
        }],
        biographies: [{
            value: buildFamilyNotes(familyData),
            contentType: 'TEXT_PLAIN'
        }]
    };

    if (telephone) {
        const normalizedPhone = normalizePhone(telephone);

        if (!normalizedPhone) {
            logWarning(`Invalid phone number for family ${id}: ${telephone}`);
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
        const parsedAddress = parseAddress(adresse);
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

    logInfo(`Creating contact for family ${id}`, {
        name: `${prenom} ${nom}`,
        phone: contactResource.phoneNumbers ? contactResource.phoneNumbers[0].value : 'none',
        email: email || 'none',
        criticite: familyData.criticite,
        household: `${familyData.nombreAdulte}A/${familyData.nombreEnfant}E`
    });

    People.People.createContact(contactResource);
    logInfo(`Contact created with metadata for family: ${id}`);
}

/**
 * Update contact group memberships
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
                        logInfo(`Identified old location group to remove: ${groupInfo.name}`);
                    }
                } catch (e) {
                    logWarning(`Could not fetch group info for ${groupResourceName}`, e);
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
                    logInfo(`Removed contact from old location group: ${oldGroupId}`);
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
            logInfo(`Added contact to main group: Famille dans le besoin`);
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
                logInfo(`Added contact to new location group: ${newLocationGroupName}`);
            }
        }

    } catch (e) {
        logError('Failed to update contact groups', e);
    }
}