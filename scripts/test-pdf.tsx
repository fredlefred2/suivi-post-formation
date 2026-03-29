import { renderToFile } from '@react-pdf/renderer'
import { GroupReportDocument } from '../lib/pdf/react-pdf-report'
import type { GroupReportData } from '../lib/pdf/group-report'
import type { AIReportAnalysis } from '../lib/pdf/ai-analysis'

const testData: GroupReportData = {
  groupName: 'Groupe h3O - Vente',
  trainerName: 'Frédéric Lacabanne',
  generatedAt: new Date().toISOString(),
  participantCount: 5,
  totalAxes: 15,
  totalActions: 47,
  avgActionsPerWeek: 2.3,
  avgActionsPerAxe: 3.1,
  activeLearnersCount: 4,     // 4 sur 5 ont au moins 1 action (Sophie faible mais active)
  groupRegularityPct: 75,     // moyenne de (50+100+75+50+100)/5 = 75%
  // Climat : Laurent=(1×5+3×3)/4=3.5, Enora=5, Christophe=(3×5+1×3)/4=4.5, Sophie=(2×3+1×1)/3=2.3, Thomas=5
  // Moyenne = (3.5+5+4.5+2.3+5)/5 = 4.1
  groupClimatScore: 4.1,
  weatherHistory: [
    { week: 10, year: 2026, weather: 'sunny' },   // 3 sunny / 0 cloudy (3 check-ins S10)
    { week: 11, year: 2026, weather: 'sunny' },    // 2 sunny, 1 cloudy → avg ~1.7 → sunny
    { week: 12, year: 2026, weather: 'sunny' },    // 3 sunny, 2 cloudy → avg ~1.8 → sunny
    { week: 13, year: 2026, weather: 'cloudy' },   // 2 sunny, 2 cloudy, 1 stormy → avg ~2.6 → cloudy
  ],
  // Somme exacte des weatherSummary individuels :
  // Laurent(1,3,0) + Enora(4,0,0) + Christophe(3,1,0) + Sophie(0,2,1) + Thomas(4,0,0) = (12,6,1)
  weatherSummary: { sunny: 12, cloudy: 6, stormy: 1 },
  learners: [
    {
      id: '1',
      firstName: 'Laurent',
      lastName: 'Ouvrard',
      createdAt: '2026-03-01T10:00:00Z',
      axes: ['Améliorer ma découverte', 'Structurer mon argu en CABP', 'Préparer mes négos'],
      axeActionCounts: [0, 9, 2],
      axeActions: [
        [],
        [
          'Action - Avancé les bénéfices chiffrés avec les stats sell-out',
          'Outil - Fiche DESC pour négociation',
          'Outil - Grille argumentation LE GAULOIS',
          'Recul - Le client a réagi positivement aux chiffres',
        ],
        [
          'Outil - Tableau concession/contrepartie pour un client Leclerc',
          'Recul - Moins réactif car mieux préparé, le RDV a été plus fluide',
        ],
      ],
      totalActions: 11,
      weeksSinceJoin: 4,
      avgActionsPerWeek: 2.75,
      regularityPct: 50,
      weatherHistory: [
        { week: 10, year: 2026, weather: 'sunny' },
        { week: 11, year: 2026, weather: 'cloudy' },
        { week: 12, year: 2026, weather: 'cloudy' },
        { week: 13, year: 2026, weather: 'cloudy' },
      ],
      weatherSummary: { sunny: 1, cloudy: 3, stormy: 0 },
      whatWorked: ['Une réaction positive du chef de rayon', 'Un échange plus fluide en négociation'],
      difficulties: ['Retombé dans mes habitudes sur la découverte', 'Sorti de ma zone de confort sur les objections'],
    },
    {
      id: '2',
      firstName: 'Enora',
      lastName: 'Lescout',
      createdAt: '2026-03-01T10:00:00Z',
      axes: ['Moins parler et mieux écouter', 'Structurer mes RDV', 'Traiter les objections'],
      axeActionCounts: [6, 3, 1],
      axeActions: [
        [
          'Action - Écouter activement pendant un entretien complet',
          'Action - Posé 3 questions ouvertes avant de proposer',
          'Recul - Laissé le client finir ses phrases sans interrompre',
          'Action - Reformulation avant de passer à l\'argumentation',
          'Action - Prise de notes pendant le RDV pour rester concentrée',
          'Action - Tenu un silence de 5 secondes après une question',
        ],
        [
          'Action - Cadrage avec objectif annoncé dès le début du RDV',
          'Action - Déroulé du RDV préparé la veille en amont',
          'Outil - Fiche de préparation RDV réutilisable',
        ],
        [
          'Action - Accepté puis creusé une objection prix chez Intermarché',
        ],
      ],
      totalActions: 10,
      weeksSinceJoin: 4,
      avgActionsPerWeek: 2.5,
      regularityPct: 100,
      weatherHistory: [
        { week: 10, year: 2026, weather: 'sunny' },
        { week: 11, year: 2026, weather: 'sunny' },
        { week: 12, year: 2026, weather: 'sunny' },
        { week: 13, year: 2026, weather: 'sunny' },
      ],
      weatherSummary: { sunny: 4, cloudy: 0, stormy: 0 },
      whatWorked: ['Un échange plus fluide avec les chefs de rayon', 'Objectif de visite atteint 3 fois cette semaine'],
      difficulties: [],
    },
    {
      id: '3',
      firstName: 'Christophe',
      lastName: 'Martin',
      createdAt: '2026-03-01T10:00:00Z',
      axes: ['Mieux argumenter', 'Écoute active', 'Négociation'],
      axeActionCounts: [4, 2, 5],
      axeActions: [
        [
          'Action - Argument CABP préparé spécifiquement pour Leclerc',
          'Action - Bénéfice chiffré avec données sell-out vs PERE DODU',
          'Recul - Le client a dit oui plus rapidement que d\'habitude',
          'Outil - Tableau comparatif LE GAULOIS vs PERE DODU',
        ],
        [
          'Action - Question ouverte sur les insatisfactions du rayon',
          'Recul - Découvert un besoin caché sur la rotation produit',
        ],
        [
          'Action - Contrepartie demandée systématiquement sur chaque concession',
          'Action - Seuil de retrait défini par écrit avant le RDV',
          'Outil - Grille concessions/contreparties pour Carrefour',
          'Recul - Tenu ma position face à une demande de remise agressive',
          'Action - Closing avec proposition ferme et délai',
        ],
      ],
      totalActions: 11,
      weeksSinceJoin: 4,
      avgActionsPerWeek: 2.75,
      regularityPct: 75,
      weatherHistory: [
        { week: 10, year: 2026, weather: 'sunny' },
        { week: 11, year: 2026, weather: 'sunny' },
        { week: 12, year: 2026, weather: 'sunny' },
        { week: 13, year: 2026, weather: 'cloudy' },
      ],
      weatherSummary: { sunny: 3, cloudy: 1, stormy: 0 },
      whatWorked: ['Objectif de CA atteint sur un compte clé', 'Une réaction positive du directeur de magasin'],
      difficulties: ['Pas assez de temps pour préparer tous les RDV'],
    },
    {
      id: '4',
      firstName: 'Sophie',
      lastName: 'Dubois',
      createdAt: '2026-03-01T10:00:00Z',
      axes: ['Découverte client', 'Argumentation', 'Closing'],
      axeActionCounts: [3, 2, 0],
      axeActions: [
        [
          'Action - Questions ouvertes en début de RDV chez Super U',
          'Action - Exploration des motivations du chef de rayon',
          'Recul - Le client s\'est confié plus facilement que prévu',
        ],
        [
          'Action - Argument structuré avec preuve IRI chiffrée',
          'Outil - Fiche argument REGALAL vs Isla Délice',
        ],
        [],
      ],
      totalActions: 5,
      weeksSinceJoin: 4,
      avgActionsPerWeek: 1.25,
      regularityPct: 50,
      weatherHistory: [
        { week: 11, year: 2026, weather: 'cloudy' },
        { week: 12, year: 2026, weather: 'cloudy' },
        { week: 13, year: 2026, weather: 'stormy' },
      ],
      weatherSummary: { sunny: 0, cloudy: 2, stormy: 1 },
      whatWorked: ['Pris confiance sur la découverte client'],
      difficulties: ['Sorti de ma zone de confort sur l\'argumentation', 'Retombée dans mes habitudes sur le closing'],
    },
    {
      id: '5',
      firstName: 'Thomas',
      lastName: 'Renault',
      createdAt: '2026-03-01T10:00:00Z',
      axes: ['Préparation RDV', 'Découverte', 'Négociation prix'],
      axeActionCounts: [5, 3, 2],
      axeActions: [
        [
          'Action - Check-list de préparation complète avant chaque visite',
          'Action - Objectif SMART défini avant chaque RDV',
          'Outil - Template de préparation RDV réutilisable',
          'Recul - Beaucoup moins de stress quand le RDV est préparé',
          'Action - Brief en amont avec le manager sur les enjeux du compte',
        ],
        [
          'Action - Question sur les projets du rayon ultra-frais',
          'Action - Reformulation synthèse avant de passer à l\'argumentation',
          'Recul - Le client a corrigé ma compréhension, j\'avais fait une mauvaise hypothèse',
        ],
        [
          'Action - Défense de la valeur sans céder de remise chez Hyper U',
          'Recul - Le client a accepté le prix sans négocier davantage',
        ],
      ],
      totalActions: 10,
      weeksSinceJoin: 4,
      avgActionsPerWeek: 2.5,
      regularityPct: 100,
      weatherHistory: [
        { week: 10, year: 2026, weather: 'sunny' },
        { week: 11, year: 2026, weather: 'sunny' },
        { week: 12, year: 2026, weather: 'sunny' },
        { week: 13, year: 2026, weather: 'sunny' },
      ],
      weatherSummary: { sunny: 4, cloudy: 0, stormy: 0 },
      whatWorked: ['Objectif de visite atteint chaque semaine', 'Un échange très fluide avec un nouveau client'],
      difficulties: [],
    },
  ],
}

const mockAIAnalysis: AIReportAnalysis = {
  groupSummary: "Le groupe h3O - Vente montre une dynamique globalement positive avec 47 actions realisees en 4 semaines. Quatre participants sur cinq sont actifs et impliques. Enora et Thomas se distinguent par une regularite exemplaire et une mise en pratique concrete des apprentissages. Christophe progresse bien sur la negociation. Sophie reste en retrait avec un rythme plus lent et un climat en baisse, ce qui merite votre attention. La tendance generale est encourageante, avec un climat moyen de 4.1/5.",
  learnerAnalyses: [
    {
      learnerId: '1',
      practice: "Laurent a commence a utiliser des donnees chiffrees (sell-out) pour appuyer ses argumentations en rendez-vous. Ses echanges sont plus fluides en negociation grace a une meilleure preparation. Il prepare desormais systematiquement un tableau de concessions avant chaque rendez-vous important.",
      toImprove: "La phase de decouverte client reste un point faible : aucune action concretisee sur cet axe. Il a tendance a retomber dans ses habitudes quand il n'est pas prepare.",
      managerActions: [
        "Debriefez un rendez-vous par semaine avec lui en insistant sur les 3 premieres minutes (phase de decouverte)",
        "Valorisez les resultats concrets obtenus grace a sa preparation (effet Leclerc)",
        "Proposez-lui de preparer ensemble un rendez-vous decouverte pour un nouveau client"
      ],
    },
    {
      learnerId: '2',
      practice: "Enora a transforme sa facon de mener les entretiens : elle laisse le client s'exprimer, pose des questions ouvertes et reformule avant d'argumenter. Elle prepare ses rendez-vous la veille avec une fiche dediee. Elle a reussi a traiter une objection prix chez un client difficile.",
      toImprove: "Le traitement des objections reste un axe a renforcer avec une seule action concretisee. L'enjeu est de systematiser cette competence sur tous les profils clients.",
      managerActions: [
        "Felicitez-la pour sa progression remarquable en ecoute active",
        "Accompagnez-la sur un rendez-vous ou les objections sont previsibles pour un coaching en situation",
        "Encouragez-la a partager ses bonnes pratiques avec ses collegues"
      ],
    },
    {
      learnerId: '3',
      practice: "Christophe est performant en negociation : il definit ses seuils a l'avance, demande systematiquement des contreparties et tient ses positions face aux demandes de remise. Il utilise des donnees comparatives pour argumenter. Il a commence a poser des questions ouvertes en rendez-vous.",
      toImprove: "Le manque de temps de preparation est son principal frein. Sa regularite a baisse la derniere semaine, ce qui peut indiquer un essoufflement.",
      managerActions: [
        "Amenagez 30 minutes de preparation dans son agenda avant les rendez-vous strategiques",
        "Faites un point rapide sur ses objectifs de negociation en debut de semaine",
        "Valorisez sa capacite a tenir ses positions face aux demandes de remise"
      ],
    },
    {
      learnerId: '4',
      practice: "Sophie a commence a poser des questions ouvertes en debut de rendez-vous et a explorer les motivations de ses interlocuteurs. Elle a construit un argument structure avec des preuves chiffrees. Le client s'est confie plus facilement que prevu lors de ses phases de decouverte.",
      toImprove: "Le rythme est faible (5 actions en 4 semaines) et le closing n'a pas ete travaille du tout. Le climat se degrade (derniere semaine difficile), ce qui traduit un possible decouragement.",
      managerActions: [
        "Prenez un moment en tete-a-tete pour comprendre ce qui la freine et la remotiver",
        "Fixez avec elle un objectif simple et atteignable pour la semaine prochaine (ex: 1 action closing)",
        "Partagez un retour positif sur sa progression en decouverte client pour maintenir sa confiance"
      ],
    },
    {
      learnerId: '5',
      practice: "Thomas est tres methodique : il prepare chaque visite avec une check-list, definit un objectif SMART et briefe son manager en amont. Ses rendez-vous sont bien structures. Il a reussi a defendre ses prix sans ceder de remise chez un client important.",
      toImprove: "La negociation prix est encore peu travaillee (2 actions). L'enjeu est de renforcer cette competence pour les clients les plus exigeants.",
      managerActions: [
        "Maintenez les briefs avant les rendez-vous strategiques, c'est tres efficace pour lui",
        "Challengez-le sur des scenarios de negociation plus complexes pour le faire progresser",
        "Valorisez son approche methodique aupres de l'equipe comme exemple a suivre"
      ],
    },
  ],
  alerts: [
    { learnerId: '4', learnerName: 'Sophie Dubois', level: 'red', message: "Rythme faible et climat en baisse. Un echange en tete-a-tete est recommande pour identifier les freins." },
    { learnerId: '1', learnerName: 'Laurent Ouvrard', level: 'yellow', message: "Axe decouverte non travaille et regularite a 50%. A surveiller pour eviter un decrochage." },
    { learnerId: '3', learnerName: 'Christophe Martin', level: 'yellow', message: "Bonne dynamique mais baisse la derniere semaine. Verifier la charge de travail." },
    { learnerId: '2', learnerName: 'Enora Lescout', level: 'green', message: "Excellente dynamique, reguliere et impliquee. A valoriser." },
    { learnerId: '5', learnerName: 'Thomas Renault', level: 'green', message: "Tres methodique et regulier. Progression solide a maintenir." },
  ],
  managerRecommendations: [
    "Organisez un point individuel avec Sophie cette semaine pour comprendre ses difficultes et la remotiver. Son climat en baisse necessite une attention rapide.",
    "Valorisez publiquement les progressions d'Enora et Thomas lors de votre prochaine reunion d'equipe. La reconnaissance des efforts soutient l'engagement de toute l'equipe.",
    "Proposez a Laurent un accompagnement cible sur la decouverte client : preparez ensemble un rendez-vous et debriefez apres. C'est son axe le plus en retard.",
    "Amenagez du temps de preparation pour Christophe avant ses rendez-vous strategiques. Sa performance en negociation est un atout, il faut la preserver."
  ],
}

async function main() {
  const outputPath = '/Users/lacabannefrederic/Downloads/rapport-test-react-pdf.pdf'
  await renderToFile(
    GroupReportDocument({ data: testData, aiAnalysis: mockAIAnalysis }),
    outputPath,
  )
  console.log(`PDF généré : ${outputPath}`)
}

main().catch(console.error)
