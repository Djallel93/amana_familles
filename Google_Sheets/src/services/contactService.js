/**
 * @file src/services/contactService.js (FIXED - Correct Delete Method)
 * @description Manage Google Contacts synchronization with groups and archiving
 */

/**
 * Create or update Google Contact for a family
 * SIMPLIFIED: Delete and recreate instead of update to avoid 404 errors
 */
function syncFamilyContact(familyData) {
    try {
        const { id, nom, prenom, email, telephone, adresse } = familyData;

        const existingContact = findContactByFamilyId(id);

        if (existingContact) {
            // SIMPLIFIED: Delete the old contact and create a new one
            // This avoids etag/404 issues with updates
            logInfo(`Deleting existing contact for family: ${id}`);
            People.People.deleteContact(existingContact.resourceName);

            // Wait a moment for deletion to propagate
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
 * FIXED: Use deleteContact method with resource name
 */
function deleteContactForArchivedFamily(familyId) {
    try {
        const contact = findContactByFamilyId(familyId);

        if (!contact) {
            logInfo(`No contact found for family ${familyId}, skipping deletion`);
            return { success: true, message: 'No contact to delete' };
        }

        // CORRECT: Use deleteContact method
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

        // List all connections and search manually
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
 * Create new contact with groups and structured address
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
            value: `Family ID: ${id}`,
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
        email: email || 'none'
    });

    People.People.createContact(contactResource);
    logInfo(`Contact created with groups for family: ${id}`);
}

/**
 * Update existing contact with groups and structured address
 * FIXED: Use correct updatePeopleContact method signature
 */
function updateContact(contact, familyData) {
    const { id, nom, prenom, email, telephone, phoneBis, adresse, idQuartier } = familyData;

    try {
        // IMPORTANT: Refetch the contact to get the latest etag
        const freshContact = People.People.get({
            resourceName: contact.resourceName,
            personFields: 'names,emailAddresses,phoneNumbers,addresses,biographies,etags'
        });

        const updateResource = {
            resourceName: freshContact.resourceName,
            etag: freshContact.etag,
            names: [{
                givenName: prenom || '',
                familyName: nom || '',
                displayName: `${prenom} ${nom}`
            }],
            biographies: freshContact.biographies || contact.biographies
        };

        if (telephone) {
            const normalizedPhone = normalizePhone(telephone);

            if (!normalizedPhone) {
                logWarning(`Invalid phone number for family ${id}: ${telephone}`);
            } else {
                updateResource.phoneNumbers = [{
                    value: normalizedPhone,
                    type: 'mobile'
                }];

                if (phoneBis) {
                    const normalizedPhoneBis = normalizePhone(phoneBis);
                    if (normalizedPhoneBis) {
                        updateResource.phoneNumbers.push({
                            value: normalizedPhoneBis,
                            type: 'home'
                        });
                    }
                }
            }
        }

        if (email && isValidEmail(email)) {
            updateResource.emailAddresses = [{
                value: email,
                type: 'home'
            }];
        }

        if (adresse) {
            const parsedAddress = parseAddress(adresse);
            updateResource.addresses = [{
                streetAddress: parsedAddress.street,
                city: parsedAddress.city,
                postalCode: parsedAddress.postalCode,
                country: parsedAddress.country,
                type: 'home'
            }];
        }

        logInfo(`Updating contact for family ${id}`, {
            name: `${prenom} ${nom}`,
            phone: updateResource.phoneNumbers ? updateResource.phoneNumbers[0].value : 'none',
            email: email || 'none',
            resourceName: freshContact.resourceName
        });

        // FIXED: Correct signature according to Google Apps Script Advanced Service
        // https://developers.google.com/apps-script/advanced/people
        const updatedContact = People.People.updateContact(
            freshContact.resourceName,
            updateResource,
            {
                updatePersonFields: 'names,emailAddresses,phoneNumbers,addresses'
            }
        );

        logInfo(`Contact updated successfully: ${updatedContact.resourceName}`);

        updateContactGroups(freshContact.resourceName, idQuartier);

        logInfo(`Contact groups updated for family: ${id}`);

    } catch (e) {
        logError(`Failed to update contact for family ${id}`, e);
        throw e;
    }
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