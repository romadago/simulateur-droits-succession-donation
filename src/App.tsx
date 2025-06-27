import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

// --- Static Data & Configuration ---

interface AbattementInfo {
  abattement: number;
  barème: { tranche: number; taux: number }[];
  note?: string;
}

const FISCAL_DATA: Record<string, AbattementInfo> = {
  'enfant': {
    abattement: 100000,
    barème: [
      { tranche: 8072, taux: 0.05 }, { tranche: 12109, taux: 0.10 },
      { tranche: 15932, taux: 0.15 }, { tranche: 552324, taux: 0.20 },
      { tranche: 902838, taux: 0.30 }, { tranche: 1805677, taux: 0.40 },
      { tranche: Infinity, taux: 0.45 }
    ]
  },
  'conjoint': { // S'applique uniquement aux DONATIONS. La succession est exonérée.
    abattement: 80724,
    barème: [ // Même barème que pour les enfants
      { tranche: 8072, taux: 0.05 }, { tranche: 12109, taux: 0.10 },
      { tranche: 15932, taux: 0.15 }, { tranche: 552324, taux: 0.20 },
      { tranche: 902838, taux: 0.30 }, { tranche: 1805677, taux: 0.40 },
      { tranche: Infinity, taux: 0.45 }
    ],
    note: "Pour une succession, le conjoint ou partenaire de PACS est totalement exonéré."
  },
  'frere-soeur': {
    abattement: 15932,
    barème: [ { tranche: 24430, taux: 0.35 }, { tranche: Infinity, taux: 0.45 } ]
  },
  'neveu-niece': {
    abattement: 7967,
    barème: [ { tranche: Infinity, taux: 0.55 } ]
  },
  'autre': {
    abattement: 1594,
    barème: [ { tranche: Infinity, taux: 0.60 } ]
  }
};

const COLORS = ['#00FFD2', '#ef4444']; // Turquoise pour le net, Rouge pour les droits

// --- Helper Components ---

interface InputSliderProps {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}

const InputSlider: React.FC<InputSliderProps> = ({ label, unit, value, onChange, ...props }) => (
  <div>
    <label className="text-gray-300 text-sm font-medium mb-2 block">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="font-bold text-[#00FFD2]">{value.toLocaleString('fr-FR')} {unit}</span>
      </div>
    </label>
    <input
      type="range" {...props} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
    />
  </div>
);

// --- Main App Component ---

const App: React.FC = () => {
  // --- State Management ---
  const [typeTransmission, setTypeTransmission] = useState<'succession' | 'donation'>('succession');
  const [lienParente, setLienParente] = useState<string>('enfant');
  const [montantTransmis, setMontantTransmis] = useState<number>(300000);
  const [donationsAnterieures, setDonationsAnterieures] = useState<number>(0);
  
  const [results, setResults] = useState({ droitsAPayer: 0, montantNet: 0, abattementApplique: 0, baseTaxable: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');

  // --- Calculation Engine ---
  useEffect(() => {
    // Cas spécial : exonération totale pour conjoint/PACS en cas de SUCCESSION
    if (typeTransmission === 'succession' && lienParente === 'conjoint') {
      setResults({ droitsAPayer: 0, montantNet: montantTransmis, abattementApplique: montantTransmis, baseTaxable: 0 });
      setChartData([{ name: 'Montant Net Reçu', value: montantTransmis }]);
      return;
    }

    const fiscalInfo = FISCAL_DATA[lienParente];
    if (!fiscalInfo) return;

    // 1. Calcul de l'abattement applicable
    const abattementDeBase = fiscalInfo.abattement;
    const abattementReel = Math.max(0, abattementDeBase - donationsAnterieures);
    
    // 2. Calcul de la base taxable
    const baseTaxable = Math.max(0, montantTransmis - abattementReel);

    // 3. Calcul des droits de succession/donation
    let droits = 0;
    let montantRestantATaxer = baseTaxable;
    let derniereTranche = 0;

    for (const palier of fiscalInfo.barème) {
      if (montantRestantATaxer <= 0) break;
      const montantDansLaTranche = Math.min(montantRestantATaxer, palier.tranche - derniereTranche);
      droits += montantDansLaTranche * palier.taux;
      montantRestantATaxer -= montantDansLaTranche;
      derniereTranche = palier.tranche;
    }

    const montantNetRecu = montantTransmis - droits;
    setResults({
        droitsAPayer: droits,
        montantNet: montantNetRecu,
        abattementApplique: abattementReel,
        baseTaxable: baseTaxable
    });
    
    setChartData([
        { name: 'Montant Net Reçu', value: montantNetRecu },
        { name: 'Droits à payer', value: droits }
    ]);

  }, [typeTransmission, lienParente, montantTransmis, donationsAnterieures]);
  
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        setEmailMessage('Veuillez saisir une adresse e-mail valide.');
        return;
    }

    setIsSending(true);
    setEmailMessage('');

    const simulationData = {
        objectifs: {
            typeTransmission: typeTransmission === 'succession' ? 'Succession' : 'Donation',
            lienParente,
            montantTransmis: `${montantTransmis.toLocaleString('fr-FR')} €`,
            donationsAnterieures: `${donationsAnterieures.toLocaleString('fr-FR')} €`,
        },
        resultats: {
            droitsAPayer: `${results.droitsAPayer.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}`,
            montantNet: `${results.montantNet.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}`,
            abattementApplique: `${results.abattementApplique.toLocaleString('fr-FR')} €`,
        }
    };

    try {
        const response = await fetch('/.netlify/functions/send-simulation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, data: simulationData, theme: 'Succession' }),
        });

        if (!response.ok) { throw new Error("Erreur lors de l'envoi."); }

        setEmailMessage(`Votre simulation a bien été envoyée à ${email}.`);
        setEmail('');

    } catch (error) {
        console.error('Failed to send simulation:', error);
        setEmailMessage("Une erreur est survenue. Veuillez réessayer.");
    } finally {
        setIsSending(false);
        setTimeout(() => setEmailMessage(''), 5000);
    }
  };

  const isConjointSuccession = typeTransmission === 'succession' && lienParente === 'conjoint';

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-700 p-4 sm:p-8 font-sans flex items-center justify-center min-h-screen">
      <div className="bg-slate-800/50 backdrop-blur-sm ring-1 ring-white/10 p-6 sm:p-10 rounded-2xl shadow-2xl w-full max-w-5xl mx-auto">
        
        <div className="text-center mb-10">
            <img src="/generique-turquoise.svg" alt="Logo Aeternia Patrimoine" className="w-16 h-16 mx-auto mb-4" />
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">
                Simulateur de Droits de Succession et Donation
            </h1>
            <p className="text-slate-300 mt-2">Estimez les frais de transmission de votre patrimoine.</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
            {/* Left Column: Controls */}
            <div className="lg:col-span-2 bg-slate-700/50 p-6 rounded-lg shadow-inner ring-1 ring-white/10">
                <h2 className="text-2xl font-semibold text-[#00FFD2] mb-6">Votre Situation</h2>
                
                <div className="space-y-6">
                    <div>
                        <label className="text-gray-300 text-sm font-medium mb-2 block">Type de transmission</label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-900/50 p-1 rounded-lg">
                            <button onClick={() => setTypeTransmission('succession')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${typeTransmission === 'succession' ? 'bg-[#00FFD2] text-slate-900' : 'text-slate-300'}`}>Succession</button>
                            <button onClick={() => setTypeTransmission('donation')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${typeTransmission === 'donation' ? 'bg-[#00FFD2] text-slate-900' : 'text-slate-300'}`}>Donation</button>
                        </div>
                    </div>
                    <div>
                         <label htmlFor="lienParente" className="text-gray-300 text-sm font-medium mb-2 block">Lien de parenté avec le bénéficiaire</label>
                         <select id="lienParente" value={lienParente} onChange={(e) => setLienParente(e.target.value)} className="w-full bg-slate-800 text-white p-3 rounded-lg border border-slate-600 focus:ring-2 focus:ring-[#00FFD2] focus:outline-none">
                            <option value="enfant">Enfant (ligne directe)</option>
                            <option value="conjoint">Conjoint / Partenaire de PACS</option>
                            <option value="frere-soeur">Frère / Sœur</option>
                            <option value="neveu-niece">Neveu / Nièce</option>
                            <option value="autre">Autre (tiers)</option>
                         </select>
                    </div>

                    <InputSlider
                        label="Montant à transmettre" unit="€"
                        value={montantTransmis} onChange={setMontantTransmis}
                        min={10000} max={2000000} step={10000}
                    />
                    <InputSlider
                        label="Donations antérieures (- de 15 ans)" unit="€"
                        value={donationsAnterieures} onChange={setDonationsAnterieures}
                        min={0} max={200000} step={1000}
                    />
                </div>
            </div>
            
            {/* Right Column: Result */}
            <div className="lg:col-span-3 bg-slate-700/50 p-6 rounded-lg shadow-inner ring-1 ring-white/10 flex flex-col justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-[#00FFD2] mb-4 text-center">Estimation des droits à payer</h2>
                    
                    {isConjointSuccession ? (
                         <div className="bg-green-100 text-green-900 p-6 rounded-lg text-center shadow">
                            <p className="text-xl font-bold">Exonération Totale</p>
                            <p className="mt-2">En tant que conjoint ou partenaire de PACS, vous êtes totalement exonéré(e) de droits de succession.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="w-full md:w-1/2 flex flex-col gap-4">
                                <div className="bg-slate-800/70 p-4 rounded-lg">
                                    <p className="text-sm text-slate-400">Montant net reçu</p>
                                    <p className="text-xl font-bold" style={{ color: '#00FFD2' }}>{results.montantNet.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</p>
                                </div>
                                <div className="bg-red-200/20 p-4 rounded-lg">
                                    <p className="text-sm text-red-300">Droits à payer</p>
                                    <p className="text-2xl font-extrabold text-red-400">{results.droitsAPayer.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'})}</p>
                                </div>
                            </div>
                            <div className="w-full md:w-1/2 h-48">
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                                            {chartData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => value.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0})} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- CTAs Section --- */}
                <div className="mt-8 pt-6 border-t border-slate-600">
                     <h3 className="text-lg font-semibold text-gray-100 mb-3 text-center">Optimisez votre transmission</h3>
                     <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-2 mb-4">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Votre adresse e-mail"
                            className="flex-grow bg-slate-800 text-white placeholder-slate-400 border border-slate-600 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#00FFD2]"
                            required
                            disabled={isSending}
                        />
                        <button type="submit" className="bg-slate-600 text-white font-bold py-3 px-5 rounded-lg hover:bg-slate-500 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSending}>
                            {isSending ? 'Envoi...' : 'Recevoir la simulation'}
                        </button>
                    </form>
                    {emailMessage && <p className="text-sm text-center text-emerald-400 mb-4">{emailMessage}</p>}

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
                        <a href="https://www.aeterniapatrimoine.fr/solutions/" target="_blank" rel="noopener noreferrer" className="bg-[#00FFD2] text-slate-900 font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-white transition-colors duration-300 w-full sm:w-auto">
                            Découvrir nos solutions
                        </a>
                        <a href="https://www.aeterniapatrimoine.fr/contact/" target="_blank" rel="noopener noreferrer" className="bg-transparent border-2 border-[#00FFD2] text-[#00FFD2] font-bold py-3 px-8 rounded-lg hover:bg-[#00FFD2] hover:text-slate-900 transition-colors duration-300 w-full sm:w-auto">
                            Prendre rendez-vous
                        </a>
                    </div>
                </div>
            </div>
        </div>
        
        {/* Disclaimer Section */}
        <div className="text-center mt-10">
             <div className="text-xs text-slate-400 p-4 bg-slate-900/50 rounded-lg max-w-3xl mx-auto">
                <h3 className="font-semibold text-slate-300 mb-2">Avertissement</h3>
                <p>Ce simulateur fournit une estimation basée sur les barèmes fiscaux en vigueur et ne prend pas en compte toutes les spécificités individuelles (abattements spéciaux, passif successoral, etc.). Les résultats sont donnés à titre indicatif et non contractuel. Pour une analyse personnalisée, consultez un de nos conseillers.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
