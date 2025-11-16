/**
 * @file src/services/driveService.js (UPDATED)
 * @description Handle Drive operations with updated document types
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
 * Organize uploaded documents for a family (UPDATED with aides_etat)
 */
function organizeDocuments(familyId, identityDocs, aidesEtatDocs, resourceDocs) {
    const folder = getOrCreateFamilyFolder(familyId);
    const organized = {
        identity: [],
        aidesEtat: [], // RENAMED from 'caf'
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

    // UPDATED: Renamed from CAF to aides_etat
    if (aidesEtatDocs && aidesEtatDocs.length > 0) {
        aidesEtatDocs.forEach((fileId, index) => {
            try {
                const newName = `aides_etat_${index + 1}`;
                const movedFile = moveAndRenameFile(fileId, folder, newName);
                if (movedFile) {
                    organized.aidesEtat.push(movedFile.getId());
                }
            } catch (e) {
                logError(`Failed to organize aides etat doc: ${fileId}`, e);
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
 * Validate uploaded documents exist (UPDATED with aides_etat)
 */
function validateDocuments(identityDocUrls, aidesEtatDocUrls, resourceDocUrls) {
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

    // UPDATED: Changed from cafIds to aidesEtatIds
    const aidesEtatIds = extractFileIds(aidesEtatDocUrls);
    aidesEtatIds.forEach(id => {
        if (!fileExists(id)) {
            errors.push(`Document aides d'état introuvable: ${id}`);
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
        aidesEtatIds: aidesEtatIds, // RENAMED from cafIds
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