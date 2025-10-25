/**
 * @file src/services/driveService.js
 * @description Handle Drive operations for family documents
 */

/**
 * Get or create family folder
 */
function getOrCreateFamilyFolder(familyId) {
    const config = getScriptConfig();
    const cache = CacheService.getScriptCache();
    const cacheKey = `folder_${familyId}`;

    const cachedFolderId = cache.get(cacheKey);
    if (cachedFolderId && fileExists(cachedFolderId)) {
        return DriveApp.getFolderById(cachedFolderId);
    }

    try {
        const gestionFolder = DriveApp.getFolderById(config.gestionFamillesFolderId);
        const famillesFolder = getOrCreateFolder(gestionFolder, 'familles');
        const familyFolder = getOrCreateFolder(famillesFolder, familyId);

        cache.put(cacheKey, familyFolder.getId(), CONFIG.CACHE.VERY_LONG);

        return familyFolder;
    } catch (e) {
        logError(`Failed to create family folder: ${familyId}`, e);
        throw e;
    }
}

/**
 * Organize uploaded documents for a family
 */
function organizeDocuments(familyId, identityDocs, cafDocs, resourceDocs) {
    const folder = getOrCreateFamilyFolder(familyId);
    const organized = {
        identity: [],
        caf: [],
        resource: []
    };

    if (identityDocs && identityDocs.length > 0) {
        identityDocs.forEach((fileId, index) => {
            try {
                const newName = `identity_${index + 1}`;
                const movedFile = moveAndRenameFile(fileId, folder, newName);
                if (movedFile) {
                    organized.identity.push(movedFile.getId());
                }
            } catch (e) {
                logError(`Failed to organize identity doc: ${fileId}`, e);
            }
        });
    }

    if (cafDocs && cafDocs.length > 0) {
        cafDocs.forEach((fileId, index) => {
            try {
                const newName = `CAF_${index + 1}`;
                const movedFile = moveAndRenameFile(fileId, folder, newName);
                if (movedFile) {
                    organized.caf.push(movedFile.getId());
                }
            } catch (e) {
                logError(`Failed to organize CAF doc: ${fileId}`, e);
            }
        });
    }

    if (resourceDocs && resourceDocs.length > 0) {
        resourceDocs.forEach((fileId, index) => {
            try {
                const newName = `resource_${index + 1}`;
                const movedFile = moveAndRenameFile(fileId, folder, newName);
                if (movedFile) {
                    organized.resource.push(movedFile.getId());
                }
            } catch (e) {
                logError(`Failed to organize resource doc: ${fileId}`, e);
            }
        });
    }

    return organized;
}

/**
 * Move and rename a file
 */
function moveAndRenameFile(fileId, targetFolder, newName) {
    try {
        const file = DriveApp.getFileById(fileId);
        const extension = file.getName().split('.').pop();
        const fullName = `${newName}.${extension}`;

        const parents = file.getParents();
        while (parents.hasNext()) {
            const parent = parents.next();
            parent.removeFile(file);
        }

        targetFolder.addFile(file);
        file.setName(fullName);

        return file;
    } catch (e) {
        logError(`Failed to move/rename file: ${fileId}`, e);
        return null;
    }
}

/**
 * Validate uploaded documents exist
 */
function validateDocuments(identityDocUrls, cafDocUrls, resourceDocUrls) {
    const errors = [];

    const identityIds = extractFileIds(identityDocUrls);
    if (identityIds.length === 0) {
        errors.push('Aucun justificatif d\'identité fourni');
    } else {
        identityIds.forEach(id => {
            if (!fileExists(id)) {
                errors.push(`Document d'identité introuvable: ${id}`);
            }
        });
    }

    const cafIds = extractFileIds(cafDocUrls);
    cafIds.forEach(id => {
        if (!fileExists(id)) {
            errors.push(`Document CAF introuvable: ${id}`);
        }
    });

    const resourceIds = extractFileIds(resourceDocUrls);
    resourceIds.forEach(id => {
        if (!fileExists(id)) {
            errors.push(`Document de ressources introuvable: ${id}`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors: errors,
        identityIds: identityIds,
        cafIds: cafIds,
        resourceIds: resourceIds
    };
}

/**
 * Format document IDs as Drive URLs for sheet storage
 */
function formatDocumentLinks(fileIds) {
    if (!fileIds || fileIds.length === 0) return '';

    return fileIds.map(id => `https://drive.google.com/file/d/${id}/view`).join(', ');
}