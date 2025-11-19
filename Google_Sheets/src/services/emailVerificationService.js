/**
 * @file src/services/emailVerificationService.js (UPDATED)
 * @description Email verification with phone/address, uses static HTML for mobile compatibility
 */

/**
 * Get email translations
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
 * Generate HTML email using static template with string replacement
 */
function generateVerificationEmailHtml(familyData, language, confirmUrl, updateUrl) {
    const t = getEmailTranslations()[language] || getEmailTranslations()['Français'];
    const isRTL = language === 'Arabe';

    // Parse address into components
    const addressParts = familyData.adresse ? familyData.adresse.split(',').map(p => p.trim()) : ['', '', ''];
    const street = addressParts[0] || '';
    const postalCode = addressParts[1] ? addressParts[1].match(/\d{5}/)?.[0] || '' : '';
    const city = addressParts[2] || addressParts[1]?.replace(/\d{5}/, '').trim() || '';

    // Load template
    const template = HtmlService.createHtmlOutputFromFile('views/email/verificationEmailTemplate').getContent();

    // Replace all placeholders
    let html = template
        .replace(/{{DIR_CLASS}}/g, isRTL ? 'rtl' : '')
        .replace(/{{SUBJECT}}/g, CONFIG.EMAIL_VERIFICATION.SUBJECT[language])
        .replace(/{{GREETING}}/g, t.greeting)
        .replace(/{{FIRST_NAME}}/g, familyData.prenom || '')
        .replace(/{{LAST_NAME}}/g, familyData.nom || '')
        .replace(/{{INTRO}}/g, t.intro)
        .replace(/{{CURRENT_INFO}}/g, t.currentInfo)
        .replace(/{{LABEL_NAME}}/g, t.name)
        .replace(/{{LABEL_PHONE}}/g, t.phone)
        .replace(/{{LABEL_ADDRESS}}/g, t.address)
        .replace(/{{LABEL_POSTAL_CODE}}/g, t.postalCode)
        .replace(/{{LABEL_CITY}}/g, t.city)
        .replace(/{{LABEL_ADULTS}}/g, t.adults)
        .replace(/{{LABEL_CHILDREN}}/g, t.children)
        .replace(/{{PHONE}}/g, familyData.telephone || '')
        .replace(/{{ADDRESS}}/g, street)
        .replace(/{{POSTAL_CODE}}/g, postalCode)
        .replace(/{{CITY}}/g, city)
        .replace(/{{NUM_ADULTS}}/g, familyData.nombreAdulte || 0)
        .replace(/{{NUM_CHILDREN}}/g, familyData.nombreEnfant || 0)
        .replace(/{{QUESTION}}/g, t.question)
        .replace(/{{BUTTON_UP_TO_DATE}}/g, t.buttonUpToDate)
        .replace(/{{BUTTON_CHANGED}}/g, t.buttonChanged)
        .replace(/{{CONFIRM_URL}}/g, confirmUrl)
        .replace(/{{UPDATE_URL}}/g, updateUrl)
        .replace(/{{FOOTER}}/g, t.footer)
        .replace(/{{THANKS}}/g, t.thanks)
        .replace(/{{TEAM}}/g, t.team);

    return html;
}

/**
 * Send verification email to a single family
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

        // Use API key directly as token
        const apiKey = config.familleApiKey;
        if (!apiKey) {
            logError('FAMILLE_API_KEY not configured');
            return { success: false, reason: 'error', error: 'API key not configured' };
        }

        const confirmUrl = `${config.webAppUrl}?action=confirmFamilyInfo&id=${familyData.id}&token=${apiKey}`;

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
 * Send verification emails to all validated families
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
                telephone: row[OUTPUT_COLUMNS.TELEPHONE],
                adresse: row[OUTPUT_COLUMNS.ADRESSE],
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
 * Handle confirmation from email
 */
function confirmFamilyInfo(familyId) {
    try {
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