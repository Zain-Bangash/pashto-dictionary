import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'];
const REGIONS = ['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'];

export default function Submit() {
  const navigate = useNavigate();

  const [pashto, setPashto] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [region, setRegion] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [definition, setDefinition] = useState('');
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    const errs = {};
    if (!pashto.trim()) errs.pashto = 'Pashto word is required';
    if (!definition.trim()) errs.definition = 'Definition is required';
    if (!partOfSpeech) errs.partOfSpeech = 'Part of speech is required';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setApiError('');
    setLoading(true);
    try {
      const payload = {
        pashto,
        partOfSpeech,
        definitions: [{ text: definition }],
        ...(phonetic && { phonetic }),
        ...(region && { region }),
      };
      await api.post('/api/entries', payload);
      navigate('/my-submissions');
    } catch (err) {
      const message = err?.response?.data?.error?.message ?? 'Submission failed';
      setApiError(message);
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-black/40 border border-white/[0.08] rounded-[12px] px-3.5 py-2.5 text-warm text-sm font-ui outline-none focus:border-mint/50 transition-all";
  const labelClass = "block text-xs font-ui font-medium text-muted mb-1.5 uppercase tracking-wider";

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-lg mx-auto px-5 py-10">
        <h1 className="text-2xl font-display text-warm mb-8">Submit a New Word</h1>

        <div className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-8 space-y-5">
          {apiError && <p className="text-red-400 text-sm font-ui">{apiError}</p>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="pashto" className={labelClass}>Pashto Word</label>
              <input
                id="pashto"
                type="text"
                dir="rtl"
                value={pashto}
                onChange={(e) => setPashto(e.target.value)}
                className={`${inputClass} font-pashto text-lg`}
                placeholder="پښتو…"
              />
              {/* Live Nastaliq preview */}
              {pashto && (
                <div
                  dir="rtl"
                  className="mt-2 text-gold font-pashto text-3xl"
                  style={{ lineHeight: 1.7, textShadow: '0 0 12px rgba(232,197,71,0.5)' }}
                >
                  {pashto}
                </div>
              )}
              {errors.pashto && <p className="text-red-400 text-xs font-ui mt-1">{errors.pashto}</p>}
            </div>

            <div>
              <label htmlFor="phonetic" className={labelClass}>Phonetic (optional)</label>
              <input
                id="phonetic"
                type="text"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="region" className={labelClass}>Region (optional)</label>
              <select
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className={`${inputClass} appearance-none`}
              >
                <option value="" className="bg-charcoal">Select…</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r} className="bg-charcoal">{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="partOfSpeech" className={labelClass}>Part of Speech</label>
              <select
                id="partOfSpeech"
                value={partOfSpeech}
                onChange={(e) => setPartOfSpeech(e.target.value)}
                className={`${inputClass} appearance-none`}
              >
                <option value="" className="bg-charcoal">Select…</option>
                {PARTS_OF_SPEECH.map((pos) => (
                  <option key={pos} value={pos} className="bg-charcoal">{pos}</option>
                ))}
              </select>
              {errors.partOfSpeech && <p className="text-red-400 text-xs font-ui mt-1">{errors.partOfSpeech}</p>}
            </div>

            <div>
              <label htmlFor="definition" className={labelClass}>Definition</label>
              <input
                id="definition"
                type="text"
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                className={inputClass}
                placeholder="English meaning…"
              />
              {errors.definition && <p className="text-red-400 text-xs font-ui mt-1">{errors.definition}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-mint text-charcoal py-2.5 rounded-[12px] text-sm font-ui font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ boxShadow: '0 4px 20px rgba(0,245,180,0.3)' }}
            >
              {loading ? 'Submitting…' : 'Submit Word'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
