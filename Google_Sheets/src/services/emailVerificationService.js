/**
 * @file src/services/emailVerificationService.js (REFACTORÉ v2.0)
 * @description Vérification email avec GEO API et génération template HTML
 * CHANGEMENT: Utilise template HTML externe au lieu de replace() inline
 */

/**
 * Récupère les traductions email
 * @returns {Object} Traductions par langue
 */
function getEmailTranslations() {
    return {
        'Français': {
            greeting: 'Bonjour',
            intro: 'Nous espérons que vous allez bien. Dans le cadre de notre suivi, nous souhaitons vérifier que vos informations sont toujours à jour.',
            currentInfo: 'Vos informations actuelles :',
            name: 'Nom complet',
            phone: 'Téléphone',
            address: 'Adresse',
            postalCode: 'Code postal',
            city: 'Ville',
            adults: 'Nombre d\'adultes',
            children: 'Nombre d\'enfants',
            question: 'Vos informations sont-elles toujours correctes ?',
            buttonUpToDate: '✅ Tout est à jour',
            buttonChanged: '📝 Mes informations ont changé',
            footer: 'Si vous avez des questions, n\'hésitez pas à nous contacter.',
            thanks: 'Merci pour votre collaboration !',
            team: 'L\'équipe de Gestion des Familles'
        },
        'Arabe': {
            greeting: 'مرحبا',
            intro: 'نأمل أن تكون بخير. كجزء من متابعتنا، نود التحقق من أن معلوماتك لا تزال محدثة.',
            currentInfo: 'معلوماتك الحالية:',
            name: 'الاسم الكامل',
            phone: 'الهاتف',
            address: 'العنوان',
            postalCode: 'الرمز البريدي',
            city: 'المدينة',
            adults: 'عدد البالغين',
            children: 'عدد الأطفال',
            question: 'هل معلوماتك لا تزال صحيحة؟',
            buttonUpToDate: '✅ كل شيء محدث',
            buttonChanged: '📝 تغيرت معلوماتي',
            footer: 'إذا كان لديك أي أسئلة، لا تتردد في الاتصال بنا.',
            thanks: 'شكرا لتعاونكم!',
            team: 'فريق إدارة العائلات'
        },
        'Anglais': {
            greeting: 'Hello',
            intro: 'We hope you are doing well. As part of our follow-up, we would like to verify that your information is still up to date.',
            currentInfo: 'Your current information:',
            name: 'Full name',
            phone: 'Phone',
            address: 'Address',
            postalCode: 'Postal code',
            city: 'City',
            adults: 'Number of adults',
            children: 'Number of children',
            question: 'Is your information still correct?',
            buttonUpToDate: '✅ Everything is up to date',
            buttonChanged: '📝 My information has changed',
            footer: 'If you have any questions, please do not hesitate to contact us.',
            thanks: 'Thank you for your cooperation!',
            team: 'The Family Management Team'
        }
    };
}

/**
 * Génère l'email HTML depuis template avec informations adresse depuis GEO API
 * @param {Object} familyData - Données famille
 * @param {string} language - Langue
 * @param {string} confirmUrl - URL confirmation
 * @param {string} updateUrl - URL mise à jour
 * @returns {string} HTML de l'email
 */
function generateVerificationEmailHtml(familyData, language, confirmUrl, updateUrl) {
    const t = getEmailTranslations()[language] || getEmailTranslations()['Français'];
    const isRTL = language === 'Arabe';

    let street = '';
    let postalCode = '';
    let city = '';

    if (familyData.idQuartier) {
        try {
            const hierarchy = getLocationHierarchyFromQuartier(familyData.idQuartier);

            if (!hierarchy.error && hierarchy.ville) {
                city = hierarchy.ville.nom || '';
                postalCode = hierarchy.ville.codePostal || '';

                if (familyData.adresse) {
                    const addressParts = parseAddressComponents(familyData.adresse);
                    street = addressParts.street || '';
                }
            } else {
                logWarning('API GEO échouée, fallback parsing adresse', hierarchy.error);
                const addressParts = parseAddressComponents(familyData.adresse);
                street = addressParts.street;
                postalCode = addressParts.postalCode;
                city = addressParts.city;
            }
        } catch (e) {
            logError('Erreur récupération adresse depuis API GEO', e);
            const addressParts = parseAddressComponents(familyData.adresse);
            street = addressParts.street;
            postalCode = addressParts.postalCode;
            city = addressParts.city;
        }
    } else {
        const addressParts = parseAddressComponents(familyData.adresse);
        street = addressParts.street;
        postalCode = addressParts.postalCode;
        city = addressParts.city;
    }

    const template = HtmlService.createTemplateFromFile('views/email/verificationEmail');

    template.dirClass = isRTL ? 'rtl' : '';
    template.subject = CONFIG.EMAIL_VERIFICATION.SUBJECT[language];
    template.greeting = t.greeting;
    template.firstName = familyData.prenom || '';
    template.lastName = familyData.nom || '';
    template.intro = t.intro;
    template.currentInfoTitle = t.currentInfo;
    template.labelName = t.name;
    template.labelPhone = t.phone;
    template.labelAddress = t.address;
    template.labelPostalCode = t.postalCode;
    template.labelCity = t.city;
    template.labelAdults = t.adults;
    template.labelChildren = t.children;
    template.phone = familyData.telephone || '';
    template.address = street;
    template.postalCode = postalCode;
    template.city = city;
    template.numAdults = familyData.nombreAdulte || 0;
    template.numChildren = familyData.nombreEnfant || 0;
    template.question = t.question;
    template.buttonUpToDate = t.buttonUpToDate;
    template.buttonChanged = t.buttonChanged;
    template.confirmUrl = confirmUrl;
    template.updateUrl = updateUrl;
    template.footerMessage = t.footer;
    template.thanks = t.thanks;
    template.team = t.team;

    return template.evaluate().getContent();
}

/**
 * Envoie un email de vérification à une famille
 * @param {Object} familyData - Données famille
 * @returns {Object} {success: boolean, reason?: string, error?: string}
 */
function sendVerificationEmail(familyData) {
    try {
        const config = getScriptConfig();

        if (!familyData.email || !isValidEmail(familyData.email)) {
            logWarning(`Pas d'email valide pour famille ${familyData.id}`);
            return { success: false, reason: 'no_email' };
        }

        if (familyData.etatDossier !== CONFIG.STATUS.VALIDATED) {
            logWarning(`Famille ${familyData.id} non validée`);
            return { success: false, reason: 'not_validated' };
        }

        const language = familyData.langue || CONFIG.LANGUAGES.FR;

        const apiKey = config.familleApiKey;
        if (!apiKey) {
            logError('FAMILLE_API_KEY non configurée');
            return { success: false, reason: 'error', error: 'Clé API non configurée' };
        }

        const confirmUrl = `${config.webAppUrl}?action=confirmFamilyInfo&id=${familyData.id}&token=${apiKey}`;

        const langCode = getLanguageCode(language);
        const formUrls = {
            'fr': config.formUrlFr,
            'ar': config.formUrlAr,
            'en': config.formUrlEn
        };
        const updateUrl = formUrls[langCode] || formUrls['fr'];

        const htmlBody = generateVerificationEmailHtml(familyData, language, confirmUrl, updateUrl);

        MailApp.sendEmail({
            to: familyData.email,
            subject: CONFIG.EMAIL_VERIFICATION.SUBJECT[language],
            htmlBody: htmlBody,
            name: CONFIG.EMAIL_VERIFICATION.FROM_NAME
        });

        logInfo(`✅ Email vérification envoyé à famille ${familyData.id} (${familyData.email})`);

        return { success: true };

    } catch (error) {
        logError(`Échec envoi email à famille ${familyData.id}`, error);
        return { success: false, reason: 'error', error: error.toString() };
    }
}

/**
 * Envoie des emails de vérification à toutes les familles validées
 * @returns {Object} Résultats de l'envoi
 */
function sendVerificationEmailsToAll() {
    try {
        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (!sheet) {
            return { success: false, error: 'Feuille introuvable' };
        }

        const data = sheet.getDataRange().getValues();
        const results = {
            total: 0,
            sent: 0,
            skipped: 0,
            failed: 0,
            reasons: {
                no_email: 0,
                not_validated: 0,
                error: 0
            }
        };

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] !== CONFIG.STATUS.VALIDATED) {
                continue;
            }

            if (!row[OUTPUT_COLUMNS.EMAIL]) {
                continue;
            }

            results.total++;

            const familyData = {
                id: row[OUTPUT_COLUMNS.ID],
                nom: row[OUTPUT_COLUMNS.NOM],
                prenom: row[OUTPUT_COLUMNS.PRENOM],
                email: row[OUTPUT_COLUMNS.EMAIL],
                telephone: row[OUTPUT_COLUMNS.TELEPHONE],
                adresse: row[OUTPUT_COLUMNS.ADRESSE],
                idQuartier: row[OUTPUT_COLUMNS.ID_QUARTIER],
                nombreAdulte: row[OUTPUT_COLUMNS.NOMBRE_ADULTE],
                nombreEnfant: row[OUTPUT_COLUMNS.NOMBRE_ENFANT],
                langue: row[OUTPUT_COLUMNS.LANGUE] || CONFIG.LANGUAGES.FR,
                etatDossier: row[OUTPUT_COLUMNS.ETAT_DOSSIER]
            };

            const result = sendVerificationEmail(familyData);

            if (result.success) {
                results.sent++;

                const existingComment = row[OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';
                const newComment = addComment(
                    existingComment,
                    formatComment('📧', 'Email de vérification envoyé')
                );
                sheet.getRange(i + 1, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);

            } else {
                if (result.reason === 'no_email' || result.reason === 'not_validated') {
                    results.skipped++;
                    results.reasons[result.reason]++;
                } else {
                    results.failed++;
                    results.reasons.error++;
                }
            }

            Utilities.sleep(100);
        }

        logInfo('✅ Emails de vérification envoyés', results);

        notifyAdmin(
            '📧 Envoi emails de vérification terminé',
            `Total: ${results.total}\nEnvoyés: ${results.sent}\nIgnorés: ${results.skipped}\nÉchecs: ${results.failed}\n\nDétails:\n- Sans email: ${results.reasons.no_email}\n- Non validé: ${results.reasons.not_validated}\n- Erreurs: ${results.reasons.error}`
        );

        return {
            success: true,
            results: results
        };

    } catch (error) {
        logError('Échec envoi emails de vérification', error);
        return { success: false, error: error.toString() };
    }
}

/**
 * Vérifie si la famille a déjà confirmé
 * @param {string} familyId - ID famille
 * @returns {boolean} Déjà confirmé
 */
function hasAlreadyConfirmed(familyId) {
    try {
        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (!sheet) {
            return false;
        }

        const data = sheet.getDataRange().getValues();

        for (let i = 1; i < data.length; i++) {
            if (data[i][OUTPUT_COLUMNS.ID] == familyId) {
                const comment = data[i][OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';
                return comment.includes('✅ Informations confirmées à jour par email le');
            }
        }

        return false;
    } catch (error) {
        logError('Erreur vérification statut confirmation', error);
        return false;
    }
}

/**
 * Gère la confirmation depuis l'email
 * @param {string} familyId - ID famille
 * @returns {Object} Résultat de la confirmation
 */
function confirmFamilyInfo(familyId) {
    try {
        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (!sheet) {
            return { success: false, error: 'Feuille introuvable' };
        }

        if (hasAlreadyConfirmed(familyId)) {
            return {
                success: false,
                error: 'already_confirmed',
                message: 'Ces informations ont déjà été confirmées'
            };
        }

        const data = sheet.getDataRange().getValues();
        let targetRow = -1;
        let familyData = null;

        for (let i = 1; i < data.length; i++) {
            if (data[i][OUTPUT_COLUMNS.ID] == familyId) {
                targetRow = i + 1;
                familyData = {
                    nom: data[i][OUTPUT_COLUMNS.NOM],
                    prenom: data[i][OUTPUT_COLUMNS.PRENOM],
                    langue: data[i][OUTPUT_COLUMNS.LANGUE] || CONFIG.LANGUAGES.FR
                };
                break;
            }
        }

        if (targetRow === -1) {
            return { success: false, error: 'Famille introuvable' };
        }

        const now = new Date();
        const timestamp = now.toLocaleString('fr-FR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        const existingComment = data[targetRow - 1][OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';
        const newComment = addComment(
            existingComment,
            formatComment('✅', `Informations confirmées à jour par email le ${timestamp}`)
        );

        sheet.getRange(targetRow, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);

        logInfo(`✅ Famille ${familyId} a confirmé ses informations par email à ${timestamp}`);

        return {
            success: true,
            message: 'Informations confirmées avec succès',
            familyId: familyId,
            familyData: familyData,
            timestamp: timestamp
        };

    } catch (error) {
        logError('Échec confirmation informations famille', error);
        return { success: false, error: error.toString() };
    }
}