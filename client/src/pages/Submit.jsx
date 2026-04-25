import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const PARTS_OF_SPEECH = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'];

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

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Submit a New Entry</h1>

      {apiError && <p className="text-red-600 mb-4">{apiError}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="pashto" className="block text-sm font-medium">Pashto Word</label>
          <input
            id="pashto"
            type="text"
            value={pashto}
            onChange={(e) => setPashto(e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
          {errors.pashto && <p className="text-red-600 text-sm">{errors.pashto}</p>}
        </div>

        <div>
          <label htmlFor="phonetic" className="block text-sm font-medium">Phonetic</label>
          <input
            id="phonetic"
            type="text"
            value={phonetic}
            onChange={(e) => setPhonetic(e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="region" className="block text-sm font-medium">Region</label>
          <input
            id="region"
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="partOfSpeech" className="block text-sm font-medium">Part of Speech</label>
          <select
            id="partOfSpeech"
            value={partOfSpeech}
            onChange={(e) => setPartOfSpeech(e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2"
          >
            <option value="">Select...</option>
            {PARTS_OF_SPEECH.map((pos) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
          {errors.partOfSpeech && <p className="text-red-600 text-sm">{errors.partOfSpeech}</p>}
        </div>

        <div>
          <label htmlFor="definition" className="block text-sm font-medium">Definition</label>
          <input
            id="definition"
            type="text"
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
          {errors.definition && <p className="text-red-600 text-sm">{errors.definition}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
