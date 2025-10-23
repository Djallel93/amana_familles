/**
 * @file src/services/contactService.js
 * @description Manage Google Contacts synchronization
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
 * Find contact by family ID stored in notes
 */
function findContactByFamilyId(familyId) {
    const contacts = People.People.searchContacts({
        query: familyId,
        readMask: 'names,emailAddresses,phoneNumbers,addresses,biographies'
    });

    if (contacts.results && contacts.results.length > 0) {
        for (const result of contacts.results) {
            const contact = result.person;
            if (contact.biographies) {
                for (const bio of contact.biographies) {
                    if (bio.value && bio.value.includes(familyId)) {
                        return contact;
                    }
                }
            }
        }
    }

    return null;
}

/**
 * Create new contact
 */
function createContact(familyData) {
    const { id, nom, prenom, email, telephone, phoneBis, adresse } = familyData;

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
        contactResource.phoneNumbers = [{
            value: telephone,
            type: 'mobile'
        }];

        if (phoneBis) {
            contactResource.phoneNumbers.push({
                value: phoneBis,
                type: 'home'
            });
        }
    }

    if (email && isValidEmail(email)) {
        contactResource.emailAddresses = [{
            value: email,
            type: 'home'
        }];
    }

    if (adresse) {
        contactResource.addresses = [{
            formattedValue: adresse,
            type: 'home'
        }];
    }

    People.People.createContact(contactResource);
}

/**
 * Update existing contact
 */
function updateContact(contact, familyData) {
    const { nom, prenom, email, telephone, phoneBis, adresse } = familyData;

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

    if (telephone) {
        updateResource.phoneNumbers = [{
            value: telephone,
            type: 'mobile'
        }];

        if (phoneBis) {
            updateResource.phoneNumbers.push({
                value: phoneBis,
                type: 'home'
            });
        }
    }

    if (email && isValidEmail(email)) {
        updateResource.emailAddresses = [{
            value: email,
            type: 'home'
        }];
    }

    if (adresse) {
        updateResource.addresses = [{
            formattedValue: adresse,
            type: 'home'
        }];
    }

    People.People.updateContact(updateResource, {
        resourceName: contact.resourceName,
        updatePersonFields: 'names,emailAddresses,phoneNumbers,addresses'
    });
}