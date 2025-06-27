// Fichier : netlify/functions/send-simulation.js
// Version finale corrigée et structurée pour gérer tous les thèmes

const { Resend } = require('resend');

// --- Templates pour chaque type de simulation ---

// Corps de l'email commun
const commonFooter = `
    <p style="margin-top: 25px;">Pour discuter de ces résultats et mettre en place la stratégie la plus adaptée, n'hésitez pas à nous contacter.</p>
    <br>
    <p>Cordialement,</p>
    <p><strong>L'équipe Aeternia Patrimoine</strong></p>
`;

// Structure principale de tous les templates
const emailTemplates = {
    'Démembrement': {
        subject: "Votre simulation d'investissement en démembrement",
        getBody: (data) => {
            const { objectifs, resultats } = data;
            return `
                <h3 style="color: #333;">Vos paramètres :</h3>
                <ul style="list-style-type: none; padding-left: 0; border-left: 3px solid #00FFD2; padding-left: 15px;">
                    <li><strong>Durée du démembrement :</strong> ${objectifs.dureeDemenbrement}</li>
                    <li><strong>Capital initial investi (en nue-propriété) :</strong> ${objectifs.capitalInitial}</li>
                    <li><strong>Capital final récupéré (en pleine propriété) :</strong> ${objectifs.capitalFinal}</li>
                </ul>
                <h3 style="color: #333;">Résultats de votre projet :</h3>
                <div style="background-color: #f7f7f7; border-radius: 8px; padding: 20px; text-align: center;">
                    <p style="margin: 0; font-size: 16px;">Grâce à une décote de <strong>${resultats.decote}</strong>, la plus-value mécanique à terme est de :</p>
                    <p style="font-size: 24px; font-weight: bold; color: #00877a; margin: 10px 0;">${resultats.plusValue}</p>
                    <p style="font-size: 14px; color: #555; margin: 0;">Ce gain est réalisé sans fiscalité supplémentaire au moment de la récupération de la pleine propriété.</p>
                </div>
                ${commonFooter}
            `;
        }
    },
    'Retraite': { subject: "Votre simulation de retraite complémentaire", objectiveLabel: "Revenu mensuel souhaité à la retraite" },
    'Études enfant': { subject: "Votre simulation pour les études de votre enfant", objectiveLabel: "Revenu mensuel pour ses études" },
    'Année sabbatique': { subject: "Votre simulation pour votre année sabbatique", objectiveLabel: "Budget mensuel nécessaire" },
    'Aider un proche': { subject: "Votre simulation pour aider un proche", objectiveLabel: "Aide mensuelle à verser" },
    'Revenu Passif': { subject: "Votre simulation d'indépendance financière", objectiveLabel: "Revenu passif mensuel souhaité" },
    'default': { subject: `Votre simulation d'épargne Aeternia Patrimoine`, objectiveLabel: "Revenu mensuel souhaité" },
};

// --- Fonction principale Netlify ---

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const body = JSON.parse(event.body);
    
    const { email, data, theme = 'default' } = body;

    if (!data || !data.objectifs || !data.resultats) {
        throw new Error("Données de simulation manquantes ou invalides.");
    }
    
    const templateConfig = emailTemplates[theme] || emailTemplates['default'];
    let emailBodyHtml = '';

    // Utilisation d'une fonction dédiée pour le cas spécial du démembrement
    if (theme === 'Démembrement' && templateConfig.getBody) {
        emailBodyHtml = templateConfig.getBody(data);
    } else {
        // Template générique pour tous les autres simulateurs
        const { objectifs, resultats } = data;
        emailBodyHtml = `
            <h3 style="color: #333;">Vos paramètres :</h3>
            <ul style="list-style-type: none; padding-left: 0; border-left: 3px solid #00FFD2; padding-left: 15px;">
                <li><strong>${templateConfig.objectiveLabel} :</strong> ${objectifs.revenuRecherche}</li>
                <li><strong>Durée de l'épargne :</strong> ${objectifs.dureePlacement}</li>
                <li><strong>Votre apport initial :</strong> ${objectifs.versementInitial}</li>
            </ul>
            <h3 style="color: #333;">Résultats de votre projet :</h3>
            <div style="background-color: #f7f7f7; border-radius: 8px; padding: 20px; text-align: center;">
                <p style="margin: 0; font-size: 16px;">Pour atteindre votre objectif, votre effort d'épargne mensuel suggéré est de :</p>
                <p style="font-size: 24px; font-weight: bold; color: #00877a; margin: 10px 0;">${resultats.versementMensuelRequis} / mois</p>
                <p style="font-size: 14px; color: #555; margin: 0;">Cet effort vous permettrait de viser un capital final de <strong>${resultats.capitalVise}</strong>.</p>
            </div>
            ${commonFooter}
        `;
    }

    await resend.emails.send({
      from: 'Aeternia Patrimoine <contact@aeterniapatrimoine.fr>', 
      to: [email],
      bcc: ['contact@aeterniapatrimoine.fr'],
      subject: templateConfig.subject,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #333;">Bonjour,</h2>
          <p>Merci d'avoir utilisé notre simulateur. Voici le résumé de votre projet :</p>
          ${emailBodyHtml}
          <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
          <p style="font-size: 10px; color: #777; text-align: center; margin-top: 20px;">
            Les informations et résultats fournis par ce simulateur sont donnés à titre indicatif et non contractuel. Ils sont basés sur les hypothèses de calcul et les paramètres que vous avez renseignés et ne constituent pas un conseil en investissement.
          </p>
        </div>
      `,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email envoyé avec succès !' }),
    };

  } catch (error) {
    console.error("Erreur dans la fonction Netlify :", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Une erreur est survenue lors de l'envoi de l'email." }),
    };
  }
};