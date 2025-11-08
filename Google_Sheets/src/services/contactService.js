/**
 * @file src/services/contactService.js (FIXED - Delete Contact Bug)
 * @description Manage Google Contacts synchronization with groups and archiving
 */

/**
 * Create or update Google Contact for a family
 */
function syncFamilyContact(familyData) {
    try {
        const { id, nom, prenom, email, telephone, adresse } = familyData;

        const existingContact = findContactByFamilyId(id);

        if (existingContact) {
            updateContact(existingContact, familyData);
            logInfo(`Contact updated for family: ${id}`);
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
 * CORRECT: deleteContact takes the resource name as a direct string parameter
 */
function deleteContactForArchivedFamily(familyId) {
    try {
        const contact = findContactByFamilyId(familyId);

        if (!contact) {
            logInfo(`No contact found for family ${familyId}, skipping deletion`);
            return { success: true, message: 'No contact to delete' };
        }

        // CORRECT: Pass resource name directly as a string
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
 * FIXED: Only use list method (search API not available)
 */
function findContactByFamilyId(familyId) {
    try {
        // Convert familyId to string for comparison
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

    // Check cache first
    const cachedGroupId = cache.get(cacheKey);
    if (cachedGroupId) {
        return cachedGroupId;
    }

    try {
        // Search for existing group
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

        // Create new group if not found
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
 * Returns: { street, postalCode, city, country }
 */
function parseAddress(fullAddress) {
    if (!fullAddress) {
        return { street: '', postalCode: '', city: '', country: 'France' };
    }

    // Expected format: "Street, PostalCode City" or "Street, PostalCode City, France"
    const parts = fullAddress.split(',').map(p => p.trim());

    if (parts.length < 2) {
        return { street: fullAddress, postalCode: '', city: '', country: 'France' };
    }

    const street = parts[0];
    const secondPart = parts[1];

    // Extract postal code (5 digits) and city from second part
    const postalCodeMatch = secondPart.match(/\b(\d{5})\b/);
    const postalCode = postalCodeMatch ? postalCodeMatch[1] : '';
    const city = postalCode ? secondPart.replace(postalCode, '').trim() : secondPart;

    // Country is usually last part if exists, otherwise default to France
    const country = parts.length >= 3 ? parts[parts.length - 1] : 'France';

    return { street, postalCode, city, country };
}

/**
 * Create new contact with groups and structured address
 * FIXED: Always normalize phone numbers before sending to API
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

    // FIXED: Normalize phone numbers before adding to contact
    if (telephone) {
        const normalizedPhone = normalizePhone(telephone);

        if (!normalizedPhone) {
            logWarning(`Invalid phone number for family ${id}: ${telephone}`);
        } else {
            contactResource.phoneNumbers = [{
                value: normalizedPhone,
                type: 'mobile'
            }];

            // Add secondary phone if provided
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

    // Parse and structure address
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

    // Add contact groups
    const memberships = [];

    // Add to main group "Famille dans le besoin"
    const mainGroupId = getOrCreateContactGroup('Famille dans le besoin');
    if (mainGroupId) {
        memberships.push({
            contactGroupMembership: {
                contactGroupResourceName: mainGroupId
            }
        });
    }

    // Add to location-based group if quartier is available
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

    // Log the contact resource before creating
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
 * FIXED: Always normalize phone numbers before sending to API
 */
function updateContact(contact, familyData) {
    const { id, nom, prenom, email, telephone, phoneBis, adresse, idQuartier } = familyData;

    const updateResource = {
        resourceName: contact.resourceName,
        etag: contact.etag,
        names: [{
            givenName: prenom || '',
            familyName: nom || '',
            displayName: `${prenom} ${nom}`
        }],
        biographies: contact.biographies
    };

    // FIXED: Normalize phone numbers before adding to contact
    if (telephone) {
        const normalizedPhone = normalizePhone(telephone);

        if (!normalizedPhone) {
            logWarning(`Invalid phone number for family ${id}: ${telephone}`);
        } else {
            updateResource.phoneNumbers = [{
                value: normalizedPhone,
                type: 'mobile'
            }];

            // Add secondary phone if provided
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

    // Parse and structure address
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

    // Log the update resource before updating
    logInfo(`Updating contact for family ${id}`, {
        name: `${prenom} ${nom}`,
        phone: updateResource.phoneNumbers ? updateResource.phoneNumbers[0].value : 'none',
        email: email || 'none'
    });

    // Update contact basic info
    People.People.updateContact(updateResource, {
        resourceName: contact.resourceName,
        updatePersonFields: 'names,emailAddresses,phoneNumbers,addresses'
    });

    // Update group memberships (this will remove old location groups)
    updateContactGroups(contact.resourceName, idQuartier);

    logInfo(`Contact updated with groups for family: ${id}`);
}

/**
 * Update contact group memberships - removes old location groups, keeps only current
 */
function updateContactGroups(contactResourceName, idQuartier) {
    try {
        // Get current contact with memberships
        const contact = People.People.get({
            resourceName: contactResourceName,
            personFields: 'memberships'
        });

        const currentMemberships = contact.memberships || [];
        const mainGroupId = getOrCreateContactGroup('Famille dans le besoin');
        const newLocationGroupName = idQuartier ? getLocationGroupName(idQuartier) : null;
        const newLocationGroupId = newLocationGroupName ? getOrCreateContactGroup(newLocationGroupName) : null;

        // Identify old location groups (pattern: "{Ville} - {Secteur}")
        const locationGroupPattern = /^.+ - .+$/; // Matches "Something - Something"
        const oldLocationGroups = [];

        currentMemberships.forEach(membership => {
            if (membership.contactGroupMembership) {
                const groupResourceName = membership.contactGroupMembership.contactGroupResourceName;

                // Skip if it's the main group
                if (groupResourceName === mainGroupId) {
                    return;
                }

                // Skip if it's the new location group (no need to remove and re-add)
                if (newLocationGroupId && groupResourceName === newLocationGroupId) {
                    return;
                }

                // Try to identify if this is a location group by checking the group name
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

        // Remove old location groups
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

        // Ensure main group membership
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

        // Add new location group if exists and not already a member
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