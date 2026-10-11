import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { createConcept, createVariant, checkCrossConceptPashto, uploadAudio } from '../services/api';
import useFieldDefinitions from './useFieldDefinitions';
import useClipCapture from './useClipCapture';
import { missingRequired } from '../context/fieldsValue';
import { formKindFor, formsPayload } from '../utils/forms';
import { headwordMaxSeconds } from '../utils/audio';

const EMPTY = { pashto: '', phonetic: '', region: '', definition: '', example: '', submissionNote: '' };
const messageOf = (err, fallback) => err?.response?.data?.error?.message ?? fallback;

// State and submit sequence of the Submit page: concept → variant → optional headword recording
export default function useSubmitForm() {
  const { forType } = useFieldDefinitions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [glossQuery, setGlossQuery] = useState('');
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newPos, setNewPos] = useState('');
  const [domains, setDomains] = useState([]);
  const [conceptExtra, setConceptExtra] = useState({});
  const [values, setValues] = useState(EMPTY);
  const [variantExtra, setVariantExtra] = useState({});
  const [forms, setForms] = useState([]);
  const [crossConceptWarnings, setCrossConceptWarnings] = useState([]);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedVariantId, setSavedVariantId] = useState(null);
  const [audioError, setAudioError] = useState('');

  const capture = useClipCapture(headwordMaxSeconds(values.pashto));
  const setField = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  // Forms of the other kind stay in state but are hidden and not sent if the part of speech changes
  const formKind = formKindFor(creatingNew ? newPos : selectedConcept?.partOfSpeech);
  const activeForms = forms.filter((f) => f.kind === formKind);
  const setActiveForms = (next) => setForms([...forms.filter((f) => f.kind !== formKind), ...next]);

  useEffect(() => {
    const conceptId = searchParams.get('conceptId');
    const pashto = searchParams.get('pashto');
    const phonetic = searchParams.get('phonetic');
    const region = searchParams.get('region');
    // From a concept page (conceptId + pashto) or from Wanted Words (conceptId + region)
    if (conceptId && (pashto || region)) {
      api.get(`/api/concepts/${conceptId}`)
        .then((res) => {
          setSelectedConcept(res.data.data);
          setGlossQuery(res.data.data.englishGloss);
          setValues((v) => ({ ...v, ...(pashto && { pashto }), ...(phonetic && { phonetic }), ...(region && { region }) }));
          setStep(2);
        })
        .catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function changeGloss(value) {
    setGlossQuery(value);
    setSelectedConcept(null);
    setCreatingNew(false);
  }

  function selectConcept(concept) {
    setSelectedConcept(concept);
    setGlossQuery(concept.englishGloss);
    setCreatingNew(false);
    setCrossConceptWarnings([]);
    setStep(2);
  }

  function createNew() {
    setCreatingNew(true);
    setSelectedConcept(null);
    setStep(2);
  }

  function backToStep1() {
    setStep(1);
    setErrors({});
  }

  async function checkPashto() {
    if (!values.pashto.trim() || !selectedConcept?._id) {
      setCrossConceptWarnings([]);
      return;
    }
    try {
      const res = await checkCrossConceptPashto(values.pashto, selectedConcept._id);
      setCrossConceptWarnings(res.data.data.conflicts);
    } catch {
      setCrossConceptWarnings([]);
    }
  }

  function validate() {
    const errs = {};
    if (!values.pashto.trim()) errs.pashto = 'Pashto word is required';
    if (!values.region) errs.region = 'Region is required';
    if (!values.definition.trim()) errs.definition = 'Definition is required';
    if (activeForms.some((f) => !f.pashto.trim())) errs.forms = 'Each form needs its Pashto text';
    if (creatingNew && !newPos) errs.partOfSpeech = 'Part of speech is required';
    const conceptMissing = creatingNew ? missingRequired(forType('concept'), conceptExtra) : {};
    const variantMissing = missingRequired(forType('variant'), variantExtra);
    if (Object.keys(conceptMissing).length) errs.conceptExtra = conceptMissing;
    if (Object.keys(variantMissing).length) errs.variantExtra = variantMissing;
    return errs;
  }

  // The word is already saved when this runs, so a failure keeps the user here to retry or skip
  async function sendClip(variantId) {
    try {
      await uploadAudio(variantId, 'headword', capture.clip);
      navigate('/my-submissions');
    } catch (err) {
      setSavedVariantId(variantId);
      setAudioError(messageOf(err, 'Upload failed. Please try again.'));
    }
  }

  async function submit(e) {
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
      let conceptId = selectedConcept?._id;
      if (creatingNew) {
        const res = await createConcept({
          englishGloss: glossQuery, partOfSpeech: newPos, extra: conceptExtra,
          ...(domains.length > 0 && { semanticDomains: domains }),
        });
        conceptId = res.data.data._id;
      }
      const res = await createVariant({
        conceptId, ...values, extra: variantExtra,
        ...(activeForms.length > 0 && { forms: formsPayload(activeForms) }),
      });
      if (capture.clip) await sendClip(res.data.data._id);
      else navigate('/my-submissions');
    } catch (err) {
      setApiError(messageOf(err, 'Submission failed'));
    } finally {
      setLoading(false);
    }
  }

  async function retryClip() {
    setLoading(true);
    setAudioError('');
    await sendClip(savedVariantId);
    setLoading(false);
  }

  return {
    step, glossQuery, changeGloss, selectConcept, createNew, backToStep1,
    selectedConcept, creatingNew,
    newPos, setNewPos, domains, setDomains, conceptExtra, setConceptExtra,
    values, setField, variantExtra, setVariantExtra,
    formKind, activeForms, setActiveForms,
    crossConceptWarnings, checkPashto,
    capture, errors, apiError, loading, submit,
    savedVariantId, audioError, retryClip, skipClip: () => navigate('/my-submissions'),
  };
}
