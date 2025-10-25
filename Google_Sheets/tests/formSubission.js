function test_onFormSubmit() {

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.FORM_FR);
    const range = sheet.getRange(2, 1, 1, sheet.getLastColumn()); // simulate a single row


    const mockEvent = {
        authMode: "FULL",
        namedValues: {
            "Travaillez-vous actuellement, vous ou votre conjoint(e) ? ": ["Temp plein"],
            "Prénom de la personne à contacter ": ["Djallel"],
            "Justificatif d’identité ou de résidence ": [
                "https://drive.google.com/open?id=1Hg30bA0tNVG5J2p3RbePI2vYCDZefHEq"
            ],
            "Par qui êtes-vous hébergé(e) ? ": [""],
            "Timestamp": ["25/10/2025 16:01:36"],
            "Ville": ["St Herblain"],
            "Adresse": ["33 rue de la chicotiere"],
            "Nom de famille ": ["BOUAKKAZ"],
            "Dans quel secteur travaillez-vous ? ": ["Livraison"],
            "Combien d'enfants vivent actuellement dans votre foyer ? ": ["0"],
            "Autre numéro où nous pourrons vous joindre (optionnel)": [""],
            "Code postale": ["44800"],
            "Attestation de la CAF (paiement et/ou quotient familial) ": [
                "https://drive.google.com/open?id=1Rb_PXslCNLjmS2kshY6pmPfGMCetFeEz"
            ],
            "Veuillez soumettre tous justificatif de ressources": [""],
            "Décrivez brièvement votre situation actuelle ": [
                "sfrgdbthy sxdfhdvbncmv aersythdxjckv"
            ],
            "Numéro de téléphone de la personne à contacter": ["0123456789"],
            "Attestation de la CAF (paiement et/ou quotient familial) - (optionnel)": [""],
            "Type de pièce d'identité ": ["Nationalite"],
            "Email address": ["bouakaz.djallel@gmail.com"],
            "Combien de jours par semaine travaillez-vous ? ": [""],
            "Protection des données personnelles": [
                "J'accepte les termes et conditions concernant la collecte et le traitement de mes données personnelles."
            ],
            "Êtes-vous actuellement hébergé(e) par une personne ou une organisation ? ": ["Non"],
            "Combien d'adultes vivent actuellement dans votre foyer ? ": ["1"],
            "Percevez-vous actuellement des aides d'autres organismes ? ": ["Association"]
        },
        range: range,
        values: range.getValues()[0],
    };

    // Call your actual trigger function with the mock event
    onFormSubmit(mockEvent);
}
