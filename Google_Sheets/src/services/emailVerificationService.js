/**
 * @file src/services/emailVerificationService.js
 */

function getEmailTranslations() {
    return {
        'Français': {
            greeting: 'Bonjour', intro: 'Nous espérons que vous allez bien. Dans le cadre de notre suivi, nous souhaitons vérifier que vos informations sont toujours à jour.',
            currentInfo: 'Vos informations actuelles :', name: 'Nom complet', phone: 'Téléphone', address: 'Adresse',
            postalCode: 'Code postal', city: 'Ville', adults: 'Nombre d\'adultes', children: 'Nombre d\'enfants',
            question: 'Vos informations sont-elles toujours correctes ?', buttonUpToDate: '✅ Tout est à jour',
            buttonChanged: '📝 Mes informations ont changé', footer: 'Si vous avez des questions, n\'hésitez pas à nous contacter.',
            thanks: 'Merci pour votre collaboration !', team: 'L\'équipe de Gestion des Familles'
        },
        'Arabe': {
            greeting: 'مرحبا', intro: 'نأمل أن تكون بخير. كجزء من متابعتنا، نود التحقق من أن معلوماتك لا تزال محدثة.',
            currentInfo: 'معلوماتك الحالية:', name: 'الاسم الكامل', phone: 'الهاتف', address: 'العنوان',
            postalCode: 'الرمز البريدي', city: 'المدينة', adults: 'عدد البالغين', children: 'عدد الأطفال',
            question: 'هل معلوماتك لا تزال صحيحة؟', buttonUpToDate: '✅ كل شيء محدث',
            buttonChanged: '📝 تغيرت معلوماتي', footer: 'إذا كان لديك أي أسئلة، لا تتردد في الاتصال بنا.',
            thanks: 'شكرا لتعاونكم!', team: 'فريق إدارة العائلات'
        },
        'Anglais': {
            greeting: 'Hello', intro: 'We hope you are doing well. As part of our follow-up, we would like to verify that your information is still up to date.',
            currentInfo: 'Your current information:', name: 'Full name', phone: 'Phone', address: 'Address',
            postalCode: 'Postal code', city: 'City', adults: 'Number of adults', children: 'Number of children',
            question: 'Is your information still correct?', buttonUpToDate: '✅ Everything is up to date',
            buttonChanged: '📝 My information has changed', footer: 'If you have any questions, please do not hesitate to contact us.',
            thanks: 'Thank you for your cooperation!', team: 'The Family Management Team'
        }
    };
}

function generateVerificationEmailHtml(familyData, language, confirmUrl, updateUrl) {
    const t = getEmailTranslations()[language] || getEmailTranslations()['Français'];
    const isRTL = language === 'Arabe';
    let street = '', postalCode = '', city = '';

    if (familyData.idQuartier) {
        try {
            const hierarchy = getLocationHierarchyFromQuartier(familyData.idQuartier);
            if (!hierarchy.error && hierarchy.ville) {
                city = hierarchy.ville.nom || '';
                postalCode = hierarchy.ville.codePostal || '';
                if (familyData.adresse) street = parseAddressComponents(familyData.adresse).street || '';
            } else {
                const addressParts = parseAddressComponents(familyData.adresse);
                street = addressParts.street; postalCode = addressParts.postalCode; city = addressParts.city;
            }
        } catch (e) {
            logError('Erreur récupération adresse depuis API GEO', e);
            const addressParts = parseAddressComponents(familyData.adresse);
            street = addressParts.street; postalCode = addressParts.postalCode; city = addressParts.city;
        }
    } else {
        const addressParts = parseAddressComponents(familyData.adresse);
        street = addressParts.street; postalCode = addressParts.postalCode; city = addressParts.city;
    }

    const template = HtmlService.createTemplateFromFile('views/email/verificationEmail');
    template.dirClass = isRTL ? 'rtl' : '';
    template.subject = CONFIG.EMAIL_VERIFICATION.SUBJECT[language];
    template.greeting = t.greeting;
    template.firstName = familyData.prenom || '';
    template.lastName = familyData.nom || '';
    template.intro = t.intro;
    template.currentInfoTitle = t.currentInfo;
    template.labelName = t.name; template.labelPhone = t.phone; template.labelAddress = t.address;
    template.labelPostalCode = t.postalCode; template.labelCity = t.city;
    template.labelAdults = t.adults; template.labelChildren = t.children;
    template.phone = familyData.telephone || '';
    template.address = street; template.postalCode = postalCode; template.city = city;
    template.numAdults = familyData.nombreAdulte || 0;
    template.numChildren = familyData.nombreEnfant || 0;
    template.question = t.question;
    template.buttonUpToDate = t.buttonUpToDate; template.buttonChanged = t.buttonChanged;
    template.confirmUrl = confirmUrl; template.updateUrl = updateUrl;
    template.footerMessage = t.footer; template.thanks = t.thanks; template.team = t.team;
    return template.evaluate().getContent();
}

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
        if (!apiKey) { logError('FAMILLE_API_KEY non configurée'); return { success: false, reason: 'error', error: 'Clé API non configurée' }; }

        const confirmUrl = `${config.webAppUrl}?action=confirmFamilyInfo&id=${familyData.id}&token=${apiKey}`;
        const langCode = getLanguageCode(language);
        const formUrls = { 'fr': config.formUrlFr, 'ar': config.formUrlAr, 'en': config.formUrlEn };
        const updateUrl = formUrls[langCode] || formUrls['fr'];

        const htmlBody = generateVerificationEmailHtml(familyData, language, confirmUrl, updateUrl);
        MailApp.sendEmail({ to: familyData.email, subject: CONFIG.EMAIL_VERIFICATION.SUBJECT[language], htmlBody, name: CONFIG.EMAIL_VERIFICATION.FROM_NAME });

        appendSheetComment(familyData.id, CONFIG.AUDIT_SOURCES.VERIFICATION_EMAIL, `📧 Email de vérification envoyé à ${familyData.email}`);
        logInfo(`Email de vérification envoyé à famille ${familyData.id}`);
        return { success: true };
    } catch (error) {
        logError(`Échec envoi email famille ${familyData.id}`, error);
        return { success: false, reason: 'error', error: error.toString() };
    }
}

function sendVerificationEmailsToAll() {
    try {
        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (!sheet) return { success: false, error: 'Feuille introuvable' };

        const data = sheet.getDataRange().getValues();
        const results = { total: 0, sent: 0, skipped: 0, failed: 0, reasons: { no_email: 0, not_validated: 0, error: 0 } };

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row[OUTPUT_COLUMNS.ETAT_DOSSIER] !== CONFIG.STATUS.VALIDATED || !row[OUTPUT_COLUMNS.EMAIL]) continue;
            results.total++;

            const familyData = {
                id: row[OUTPUT_COLUMNS.ID], nom: row[OUTPUT_COLUMNS.NOM], prenom: row[OUTPUT_COLUMNS.PRENOM],
                email: row[OUTPUT_COLUMNS.EMAIL], telephone: row[OUTPUT_COLUMNS.TELEPHONE],
                adresse: row[OUTPUT_COLUMNS.ADRESSE], idQuartier: row[OUTPUT_COLUMNS.ID_QUARTIER],
                nombreAdulte: row[OUTPUT_COLUMNS.NOMBRE_ADULTE], nombreEnfant: row[OUTPUT_COLUMNS.NOMBRE_ENFANT],
                langue: row[OUTPUT_COLUMNS.LANGUE] || CONFIG.LANGUAGES.FR,
                etatDossier: row[OUTPUT_COLUMNS.ETAT_DOSSIER]
            };

            const result = sendVerificationEmail(familyData);
            if (result.success) { results.sent++; }
            else if (result.reason === 'no_email' || result.reason === 'not_validated') { results.skipped++; results.reasons[result.reason]++; }
            else { results.failed++; results.reasons.error++; }

            Utilities.sleep(100);
        }

        logInfo('Emails de vérification envoyés', results);
        notifyAdmin('📧 Envoi emails de vérification terminé',
            `Total: ${results.total}\nEnvoyés: ${results.sent}\nIgnorés: ${results.skipped}\nÉchecs: ${results.failed}`);
        return { success: true, results };
    } catch (error) {
        logError('Échec envoi emails de vérification', error);
        return { success: false, error: error.toString() };
    }
}

function hasAlreadyConfirmed(familyId) {
    try {
        const auditSheet = getOrCreateAuditSheet();
        const data = auditSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
            if (String(data[i][AUDIT_COLUMNS.FAMILLE_ID]) == familyId &&
                data[i][AUDIT_COLUMNS.SOURCE] === CONFIG.AUDIT_SOURCES.VERIFICATION_EMAIL &&
                String(data[i][AUDIT_COLUMNS.MESSAGE]).includes('confirmé')) {
                return true;
            }
        }
        return false;
    } catch (error) {
        logError('Erreur vérification statut confirmation', error);
        return false;
    }
}

function confirmFamilyInfo(familyId) {
    try {
        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (!sheet) return { success: false, error: 'Feuille introuvable' };

        if (hasAlreadyConfirmed(familyId)) {
            return { success: false, error: 'already_confirmed', message: 'Ces informations ont déjà été confirmées' };
        }

        const data = sheet.getDataRange().getValues();
        let familyData = null;

        for (let i = 1; i < data.length; i++) {
            if (data[i][OUTPUT_COLUMNS.ID] == familyId) {
                familyData = {
                    nom: data[i][OUTPUT_COLUMNS.NOM],
                    prenom: data[i][OUTPUT_COLUMNS.PRENOM],
                    langue: data[i][OUTPUT_COLUMNS.LANGUE] || CONFIG.LANGUAGES.FR
                };
                break;
            }
        }

        if (!familyData) return { success: false, error: 'Famille introuvable' };

        const timestamp = new Date().toLocaleString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        appendSheetComment(familyId, CONFIG.AUDIT_SOURCES.VERIFICATION_EMAIL, `✅ Informations confirmées à jour par email le ${timestamp}`);
        logInfo(`Famille ${familyId} a confirmé ses informations par email`);

        return { success: true, message: 'Informations confirmées avec succès', familyId, familyData, timestamp };
    } catch (error) {
        logError('Échec confirmation informations famille', error);
        return { success: false, error: error.toString() };
    }
}
