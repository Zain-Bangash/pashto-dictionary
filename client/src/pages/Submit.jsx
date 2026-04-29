import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { suggestConcepts, createConcept, createVariant } from '../services/api';

const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'];
const REGIONS = ['Kohat', 'Hangu', 'Tirah', 'Thal', 'Parachinar'];

const inputClass = 'w-full bg-black/40 border border-white/[0.08] rounded-[12px] px-3.5 py-2.5 text-warm text-sm font-ui outline-none focus:border-gold/50 transition-all';
const labelClass = 'block text-xs font-ui font-medium text-muted mb-1.5 uppercase tracking-wider';

function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function Submit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Step 1 — concept selection / creation
  const [step, setStep]                   = useState(1);
  const [glossQuery, setGlossQuery]       = useState('');
  const [suggestions, setSuggestions]     = useState([]);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [newGloss, setNewGloss]           = useState('');
  const [newPos, setNewPos]               = useState('');
  const [creatingNew, setCreatingNew]     = useState(false);

  // Step 2 — variant details
  const [pashto, setPashto]       = useState('');
  const [phonetic, setPhonetic]   = useState('');
  const [region, setRegion]       = useState('');
  const [definition, setDefinition] = useState('');
  const [example, setExample]     = useState('');

  const [errors, setErrors]     = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading]   = useState(false);

  const fetchSuggestions = useCallback(async (q) => {
    if (!q.trim()) { setSuggestions([]); return; }
    try {
      const res = await suggestConcepts(q);
      setSuggestions(res.data.data || []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const debouncedFetch = useDebounce(fetchSuggestions, 300);

  useEffect(() => {
    const conceptId   = searchParams.get('conceptId');
    const pashtoParam = searchParams.get('pashto');
    const phoneticParam = searchParams.get('phonetic');
    if (conceptId && pashtoParam) {
      api.get(`/api/concepts/${conceptId}`)
        .then((res) => {
          setSelectedConcept(res.data.data);
          setGlossQuery(res.data.data.englishGloss);
          setPashto(pashtoParam);
          if (phoneticParam) setPhonetic(phoneticParam);
          setStep(2);
        })
        .catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleGlossChange(e) {
    const val = e.target.value;
    setGlossQuery(val);
    setSelectedConcept(null);
    setCreatingNew(false);
    debouncedFetch(val);
  }

  function handleSelectConcept(concept) {
    setSelectedConcept(concept);
    setGlossQuery(concept.englishGloss);
    setSuggestions([]);
    setCreatingNew(false);
    setStep(2);
  }

  function handleCreateNew() {
    setCreatingNew(true);
    setNewGloss(glossQuery);
    setSelectedConcept(null);
    setSuggestions([]);
    setStep(2);
  }

  function validateStep2() {
    const errs = {};
    if (!pashto.trim()) errs.pashto = 'Pashto word is required';
    if (!region) errs.region = 'Region is required';
    if (!definition.trim()) errs.definition = 'Definition is required';
    if (creatingNew && !newPos) errs.partOfSpeech = 'Part of speech is required';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validateStep2();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setApiError('');
    setLoading(true);

    try {
      let conceptId = selectedConcept?._id;

      if (creatingNew) {
        const res = await createConcept({ englishGloss: newGloss, partOfSpeech: newPos });
        conceptId = res.data.data._id;
      }

      await createVariant({ conceptId, pashto, phonetic, region, definition, example });
      navigate('/my-submissions');
    } catch (err) {
      const message = err?.response?.data?.error?.message ?? 'Submission failed';
      setApiError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="max-w-lg mx-auto px-5 py-10">
        <h1 className="text-2xl font-display text-warm mb-8">Submit a New Word</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-ui font-bold ${step >= 1 ? 'bg-gold text-charcoal' : 'bg-white/10 text-muted'}`}>1</div>
          <div className="flex-1 h-px bg-white/10" />
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-ui font-bold ${step >= 2 ? 'bg-gold text-charcoal' : 'bg-white/10 text-muted'}`}>2</div>
        </div>

        <div className="bg-white/[0.035] backdrop-blur-[24px] border border-white/[0.08] rounded-[20px] p-8 space-y-5">
          {apiError && <p className="text-red-400 text-sm font-ui">{apiError}</p>}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="glossQuery" className={labelClass}>English Meaning</label>
                <input
                  id="glossQuery"
                  type="text"
                  value={glossQuery}
                  onChange={handleGlossChange}
                  className={inputClass}
                  placeholder="e.g. sun, water, house…"
                  autoComplete="off"
                />
                <p className="text-muted font-ui text-xs mt-1.5">Type to search for an existing concept or create a new one.</p>
              </div>

              {suggestions.length > 0 && (
                <ul className="bg-black/60 border border-white/[0.08] rounded-[12px] overflow-hidden divide-y divide-white/[0.05]">
                  {suggestions.map((c) => (
                    <li key={c._id}>
                      <button
                        type="button"
                        onClick={() => handleSelectConcept(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-white/[0.05] transition-colors"
                      >
                        <span className="text-warm text-sm font-ui">{c.englishGloss}</span>
                        <span className="ml-2 text-muted text-xs font-ui">{c.partOfSpeech}</span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      onClick={handleCreateNew}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/[0.05] transition-colors text-gold text-sm font-ui"
                    >
                      + Create new concept "{glossQuery}"
                    </button>
                  </li>
                </ul>
              )}

              {glossQuery && suggestions.length === 0 && (
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="w-full text-left px-4 py-2.5 bg-black/40 border border-white/[0.08] rounded-[12px] text-gold text-sm font-ui hover:bg-white/[0.04] transition-colors"
                >
                  + Create new concept "{glossQuery}"
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Concept summary */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-[12px] px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-ui text-muted uppercase tracking-wider mb-0.5">Concept</p>
                  <p className="text-warm text-sm font-ui">{selectedConcept ? selectedConcept.englishGloss : newGloss}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setStep(1); setErrors({}); }}
                  className="text-muted text-xs font-ui hover:text-warm transition-colors"
                >
                  Change
                </button>
              </div>

              {creatingNew && (
                <div>
                  <label htmlFor="partOfSpeech" className={labelClass}>Part of Speech</label>
                  <select
                    id="partOfSpeech"
                    value={newPos}
                    onChange={(e) => setNewPos(e.target.value)}
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="" className="bg-charcoal">Select…</option>
                    {PARTS_OF_SPEECH.map((pos) => (
                      <option key={pos} value={pos} className="bg-charcoal">{pos}</option>
                    ))}
                  </select>
                  {errors.partOfSpeech && <p className="text-red-400 text-xs font-ui mt-1">{errors.partOfSpeech}</p>}
                </div>
              )}

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
                {pashto && (
                  <div
                    dir="rtl"
                    className="mt-2 text-gold font-pashto text-3xl"
                    style={{ lineHeight: 1.7 }}
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
                <label htmlFor="region" className={labelClass}>Region</label>
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
                {errors.region && <p className="text-red-400 text-xs font-ui mt-1">{errors.region}</p>}
              </div>

              <div>
                <label htmlFor="definition" className={labelClass}>Definition</label>
                <input
                  id="definition"
                  type="text"
                  value={definition}
                  onChange={(e) => setDefinition(e.target.value)}
                  className={inputClass}
                  placeholder="Meaning in English…"
                />
                {errors.definition && <p className="text-red-400 text-xs font-ui mt-1">{errors.definition}</p>}
              </div>

              <div>
                <label htmlFor="example" className={labelClass}>Example sentence (optional)</label>
                <input
                  id="example"
                  type="text"
                  value={example}
                  onChange={(e) => setExample(e.target.value)}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-terracotta text-warm py-2.5 rounded-[12px] text-sm font-ui font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ boxShadow: '0 4px 20px rgba(196,119,90,0.35)' }}
              >
                {loading ? 'Submitting…' : 'Submit Word'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
