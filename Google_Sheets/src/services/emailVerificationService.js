/**
 * @file src/services/emailVerificationService.js (UPDATED)
 * @description Email verification service with separated HTML template files
 */

/**
 * Get email translations (UPDATED with full language names as keys)
 */
function getEmailTranslations() {
    return {
        'Français': {
            greeting: 'Bonjour',
            intro: 'Nous espérons que vous allez bien. Dans le cadre de notre suivi, nous souhaitons vérifier que vos informations sont toujours à jour.',
            currentInfo: 'Vos informations actuelles :',
            name: 'Nom complet',
            address: 'Adresse',
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
            address: 'العنوان',
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
            address: 'Address',
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
 * Generate HTML email using template file
 */
function generateVerificationEmailHtml(familyData, language, confirmUrl, updateUrl) {
    const t = getEmailTranslations()[language] || getEmailTranslations()['Français'];
    const isRTL = language === 'Arabe';
    const langCode = getLanguageCode(language);

    // Create template from HTML file
    const template = HtmlService.createTemplateFromFile('views/email/verificationEmail');

    // Set template variables
    template.langCode = langCode;
    template.isRTL = isRTL;
    template.subject = CONFIG.EMAIL_VERIFICATION.SUBJECT[language];
    template.greeting = t.greeting;
    template.intro = t.intro;
    template.currentInfo = t.currentInfo;
    template.labels = {
        name: t.name,
        address: t.address,
        adults: t.adults,
        children: t.children
    };
    template.familyData = familyData;
    template.question = t.question;
    template.buttonUpToDate = t.buttonUpToDate;
    template.buttonChanged = t.buttonChanged;
    template.confirmUrl = confirmUrl;
    template.updateUrl = updateUrl;
    template.footer = t.footer;
    template.thanks = t.thanks;
    template.team = t.team;

    // Evaluate and return HTML
    return template.evaluate().getContent();
}

/**
 * Send verification email to a single family (UPDATED)
 */
function sendVerificationEmail(familyData) {
    try {
        const config = getScriptConfig();

        if (!familyData.email || !isValidEmail(familyData.email)) {
            logWarning(`No valid email for family ${familyData.id}`);
            return { success: false, reason: 'no_email' };
        }

        if (familyData.etatDossier !== CONFIG.STATUS.VALIDATED) {
            logWarning(`Family ${familyData.id} not validated`);
            return { success: false, reason: 'not_validated' };
        }

        const language = familyData.langue || CONFIG.LANGUAGES.FR;

        // Build confirmation URL (API endpoint) - UPDATED: Use API_KEY
        const apiKey = getProperty('API_KEY');
        const confirmUrl = `${config.webAppUrl}?action=confirmFamilyInfo&id=${familyData.id}&token=${generateSecureToken(familyData.id, apiKey)}`;

        // Build update URL (Google Form)
        const langCode = getLanguageCode(language);
        const formUrls = {
            'fr': config.formUrlFr,
            'ar': config.formUrlAr,
            'en': config.formUrlEn
        };
        const updateUrl = formUrls[langCode] || formUrls['fr'];

        // Generate HTML email from template
        const htmlBody = generateVerificationEmailHtml(familyData, language, confirmUrl, updateUrl);

        // Send email
        MailApp.sendEmail({
            to: familyData.email,
            subject: CONFIG.EMAIL_VERIFICATION.SUBJECT[language],
            htmlBody: htmlBody,
            name: CONFIG.EMAIL_VERIFICATION.FROM_NAME
        });

        logInfo(`✅ Verification email sent to family ${familyData.id} (${familyData.email})`);

        return { success: true };

    } catch (error) {
        logError(`Failed to send email to family ${familyData.id}`, error);
        return { success: false, reason: 'error', error: error.toString() };
    }
}

/**
 * Send verification emails to all validated families with emails
 */
function sendVerificationEmailsToAll() {
    try {
        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (!sheet) {
            return { success: false, error: 'Sheet not found' };
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
                adresse: row[OUTPUT_COLUMNS.ADRESSE],
                nombreAdulte: row[OUTPUT_COLUMNS.NOMBRE_ADULTE],
                nombreEnfant: row[OUTPUT_COLUMNS.NOMBRE_ENFANT],
                langue: row[OUTPUT_COLUMNS.LANGUE] || CONFIG.LANGUAGES.FR,
                etatDossier: row[OUTPUT_COLUMNS.ETAT_DOSSIER]
            };

            const result = sendVerificationEmail(familyData);

            if (result.success) {
                results.sent++;

                // Update comment in sheet
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

            // Respect Gmail quota
            Utilities.sleep(100);
        }

        logInfo('✅ Verification emails sent', results);

        notifyAdmin(
            '📧 Envoi d\'emails de vérification terminé',
            `Total: ${results.total}\nEnvoyés: ${results.sent}\nIgnorés: ${results.skipped}\nÉchecs: ${results.failed}\n\nDétails:\n- Sans email: ${results.reasons.no_email}\n- Non validé: ${results.reasons.not_validated}\n- Erreurs: ${results.reasons.error}`
        );

        return {
            success: true,
            results: results
        };

    } catch (error) {
        logError('Failed to send verification emails', error);
        return { success: false, error: error.toString() };
    }
}

/**
 * Generate secure token for email confirmation (UPDATED: use API_KEY)
 */
function generateSecureToken(familyId, apiKey) {
    const timestamp = new Date().getTime();
    const secret = apiKey || 'default_secret';
    const data = `${familyId}:${timestamp}:${secret}`;

    return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data));
}

/**
 * Handle confirmation from email (called by API endpoint)
 */
function confirmFamilyInfo(familyId, token) {
    try {
        // Validate token (basic validation)
        if (!token || token.length < 10) {
            return { success: false, error: 'Invalid token' };
        }

        const sheet = getSheetByName(CONFIG.SHEETS.FAMILLE);
        if (!sheet) {
            return { success: false, error: 'Sheet not found' };
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
            return { success: false, error: 'Family not found' };
        }

        // Update comment
        const existingComment = data[targetRow - 1][OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER] || '';
        const newComment = addComment(
            existingComment,
            formatComment('✅', 'Informations confirmées à jour par email')
        );

        sheet.getRange(targetRow, OUTPUT_COLUMNS.COMMENTAIRE_DOSSIER + 1).setValue(newComment);

        logInfo(`✅ Family ${familyId} confirmed information via email`);

        return {
            success: true,
            message: 'Information confirmed successfully',
            familyId: familyId,
            familyData: familyData
        };

    } catch (error) {
        logError('Failed to confirm family info', error);
        return { success: false, error: error.toString() };
    }
}

/**
 * Generate confirmation page using template file
 */
function generateConfirmationPage(language, familyName) {
    const messages = {
        'Français': {
            title: 'Merci pour votre confirmation !',
            message: 'Vos informations ont été confirmées avec succès.',
            closing: 'Vous pouvez fermer cette fenêtre.'
        },
        'Arabe': {
            title: 'شكرا لتأكيدك!',
            message: 'تم تأكيد معلوماتك بنجاح.',
            closing: 'يمكنك إغلاق هذه النافذة.'
        },
        'Anglais': {
            title: 'Thank you for your confirmation!',
            message: 'Your information has been confirmed successfully.',
            closing: 'You can close this window.'
        }
    };

    const t = messages[language] || messages['Français'];
    const isRTL = language === 'Arabe';
    const langCode = getLanguageCode(language);

    // Create template from HTML file
    const template = HtmlService.createTemplateFromFile('views/email/confirmationPage');

    // Set template variables
    template.langCode = langCode;
    template.isRTL = isRTL;
    template.title = t.title;
    template.message = t.message;
    template.closing = t.closing;
    template.familyName = familyName || '';

    // Evaluate and return HTML
    return template.evaluate().getContent();
}