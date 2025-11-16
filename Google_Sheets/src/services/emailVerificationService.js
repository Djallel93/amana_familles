/**
 * @file src/services/emailVerificationService.js
 * @description Email verification service for family data updates
 */

/**
 * Get email translations
 */
function getEmailTranslations() {
    return {
        fr: {
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
        ar: {
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
        en: {
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
 * Generate HTML email template
 */
function generateVerificationEmailHtml(familyData, language, confirmUrl, updateUrl) {
    const t = getEmailTranslations()[language] || getEmailTranslations().fr;

    return `
<!DOCTYPE html>
<html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: ${language === 'ar' ? "'Cairo', 'Arial', sans-serif" : "'Segoe UI', 'Roboto', Arial, sans-serif"};
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            line-height: 1.6;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
            font-weight: 700;
        }
        .header .icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        .content {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 24px;
            color: #333;
            margin-bottom: 20px;
            font-weight: 600;
        }
        .intro {
            font-size: 16px;
            color: #555;
            margin-bottom: 30px;
            line-height: 1.8;
        }
        .info-box {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            border-left: 4px solid #667eea;
            padding: 25px;
            border-radius: 12px;
            margin: 30px 0;
        }
        ${language === 'ar' ? '.info-box { border-left: none; border-right: 4px solid #667eea; }' : ''}
        .info-title {
            font-size: 18px;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 15px;
        }
        .info-row {
            display: flex;
            padding: 12px 0;
            border-bottom: 1px solid rgba(102, 126, 234, 0.1);
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .info-label {
            font-weight: 600;
            color: #555;
            min-width: 150px;
            ${language === 'ar' ? 'text-align: right;' : 'text-align: left;'}
        }
        .info-value {
            color: #333;
            font-weight: 500;
        }
        .question {
            text-align: center;
            font-size: 20px;
            font-weight: 600;
            color: #333;
            margin: 35px 0 25px 0;
        }
        .button-container {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin: 30px 0;
            flex-wrap: wrap;
        }
        .button {
            display: inline-block;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            text-align: center;
            min-width: 200px;
        }
        .button-confirm {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            color: white;
        }
        .button-confirm:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(17, 153, 142, 0.4);
        }
        .button-update {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
        }
        .button-update:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(245, 87, 108, 0.4);
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
            line-height: 1.8;
        }
        .footer-message {
            margin-bottom: 15px;
        }
        .footer-thanks {
            font-weight: 600;
            color: #667eea;
            margin-top: 15px;
            font-size: 16px;
        }
        .team-signature {
            margin-top: 10px;
            font-style: italic;
            color: #888;
        }
        @media only screen and (max-width: 600px) {
            .email-container {
                border-radius: 0;
            }
            .header {
                padding: 30px 20px;
            }
            .content {
                padding: 30px 20px;
            }
            .button-container {
                flex-direction: column;
                align-items: stretch;
            }
            .button {
                width: 100%;
            }
            .info-row {
                flex-direction: column;
                gap: 5px;
            }
            .info-label {
                min-width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="icon">📋</div>
            <h1>${CONFIG.EMAIL_VERIFICATION.SUBJECT[language]}</h1>
        </div>
        
        <div class="content">
            <div class="greeting">${t.greeting} ${familyData.prenom} ${familyData.nom},</div>
            
            <div class="intro">${t.intro}</div>
            
            <div class="info-box">
                <div class="info-title">${t.currentInfo}</div>
                
                <div class="info-row">
                    <div class="info-label">${t.name}:</div>
                    <div class="info-value">${familyData.prenom} ${familyData.nom}</div>
                </div>
                
                <div class="info-row">
                    <div class="info-label">${t.address}:</div>
                    <div class="info-value">${familyData.adresse}</div>
                </div>
                
                <div class="info-row">
                    <div class="info-label">${t.adults}:</div>
                    <div class="info-value">${familyData.nombreAdulte}</div>
                </div>
                
                <div class="info-row">
                    <div class="info-label">${t.children}:</div>
                    <div class="info-value">${familyData.nombreEnfant}</div>
                </div>
            </div>
            
            <div class="question">${t.question}</div>
            
            <div class="button-container">
                <a href="${confirmUrl}" class="button button-confirm">${t.buttonUpToDate}</a>
                <a href="${updateUrl}" class="button button-update">${t.buttonChanged}</a>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-message">${t.footer}</div>
            <div class="footer-thanks">${t.thanks}</div>
            <div class="team-signature">— ${t.team}</div>
        </div>
    </div>
</body>
</html>
    `.trim();
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

        // Build confirmation URL (API endpoint)
        const confirmUrl = `${config.webAppUrl}?action=confirmFamilyInfo&id=${familyData.id}&token=${generateSecureToken(familyData.id)}`;

        // Build update URL (Google Form)
        const formUrls = {
            fr: config.formUrlFr,
            ar: config.formUrlAr,
            en: config.formUrlEn
        };
        const updateUrl = formUrls[language] || formUrls.fr;

        // Generate HTML email
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

            // Respect Gmail quota: 100 emails per day for free accounts
            Utilities.sleep(100); // Small delay between emails
        }

        logInfo('✅ Verification emails sent', results);

        // Notify admin
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
 * Generate secure token for email confirmation
 */
function generateSecureToken(familyId) {
    const timestamp = new Date().getTime();
    const secret = PropertiesService.getScriptProperties().getProperty('EMAIL_TOKEN_SECRET') || 'default_secret';
    const data = `${familyId}:${timestamp}:${secret}`;

    // Simple hash (for production, use a proper HMAC)
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
 * Generate confirmation page HTML
 */
function generateConfirmationPage(language, familyName) {
    const messages = {
        fr: {
            title: 'Merci pour votre confirmation !',
            message: 'Vos informations ont été confirmées avec succès.',
            closing: 'Vous pouvez fermer cette fenêtre.'
        },
        ar: {
            title: 'شكرا لتأكيدك!',
            message: 'تم تأكيد معلوماتك بنجاح.',
            closing: 'يمكنك إغلاق هذه النافذة.'
        },
        en: {
            title: 'Thank you for your confirmation!',
            message: 'Your information has been confirmed successfully.',
            closing: 'You can close this window.'
        }
    };

    const t = messages[language] || messages.fr;

    return `
<!DOCTYPE html>
<html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t.title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: ${language === 'ar' ? "'Cairo', 'Arial', sans-serif" : "'Segoe UI', 'Roboto', Arial, sans-serif"};
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            padding: 60px 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center;
            max-width: 500px;
            animation: fadeIn 0.5s ease;
        }
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .icon {
            font-size: 80px;
            margin-bottom: 30px;
            animation: bounce 1s ease;
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
        }
        h1 {
            color: #333;
            font-size: 32px;
            margin-bottom: 20px;
            font-weight: 700;
        }
        p {
            color: #666;
            font-size: 18px;
            line-height: 1.6;
            margin-bottom: 15px;
        }
        .family-name {
            color: #667eea;
            font-weight: 600;
        }
        .closing {
            margin-top: 30px;
            font-size: 16px;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✅</div>
        <h1>${t.title}</h1>
        <p>${t.message}</p>
        ${familyName ? `<p class="family-name">${familyName}</p>` : ''}
        <p class="closing">${t.closing}</p>
    </div>
</body>
</html>
    `.trim();
}