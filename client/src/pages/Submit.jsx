import useSubmitForm from '../hooks/useSubmitForm';
import AmbientBackground from '../components/AmbientBackground';
import StepIndicator from '../components/submit/StepIndicator';
import ConceptStep from '../components/submit/ConceptStep';
import ConceptSummary from '../components/submit/ConceptSummary';
import NewConceptFields from '../components/submit/NewConceptFields';
import PashtoWordInput from '../components/submit/PashtoWordInput';
import SubmitAudio from '../components/submit/SubmitAudio';
import VariantFields from '../components/submit/VariantFields';
import AudioRetryPanel from '../components/submit/AudioRetryPanel';
import { PRIMARY_CTA } from '../components/submit/submitStyles';
import { headwordMaxSeconds } from '../utils/audio';

export default function Submit() {
  const form = useSubmitForm();
  const { step, values, capture, errors, apiError, loading } = form;

  return (
    <div className="min-h-screen bg-charcoal">
      <AmbientBackground />
      <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="max-w-xl mx-auto flex flex-col gap-5">
          <header className="bento-enter">
            <p className="meta-label mb-2">Contribute</p>
            <h1 className="text-3xl font-display text-warm">Submit a New Word</h1>
          </header>

          <div className="bento-enter [animation-delay:0.08s]">
            <StepIndicator step={step} />
          </div>

          <div className="bento-enter [animation-delay:0.16s] bg-white/[0.035] backdrop-blur-[32px] border border-white/[0.08] rounded-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] p-5 sm:p-8 space-y-5">
            {apiError && (
              <p role="alert" className="rounded-[12px] border border-red-400/30 bg-red-400/[0.08] px-3 py-2 text-sm font-ui text-red-400">{apiError}</p>
            )}

            {step === 1 && (
              <ConceptStep
                glossQuery={form.glossQuery}
                onChange={form.changeGloss}
                onSelect={form.selectConcept}
                onCreateNew={form.createNew}
              />
            )}

            {step === 2 && form.savedVariantId && (
              <AudioRetryPanel
                capture={capture}
                maxSeconds={headwordMaxSeconds(values.pashto)}
                error={form.audioError}
                loading={loading}
                onRetry={form.retryClip}
                onSkip={form.skipClip}
              />
            )}

            {step === 2 && !form.savedVariantId && (
              <form onSubmit={form.submit} className="space-y-5">
                <ConceptSummary
                  gloss={form.selectedConcept ? form.selectedConcept.englishGloss : form.glossQuery}
                  partOfSpeech={form.selectedConcept?.partOfSpeech}
                  isNew={form.creatingNew}
                  onChange={form.backToStep1}
                />

                {form.creatingNew && <NewConceptFields form={form} />}

                <PashtoWordInput
                  value={values.pashto}
                  onChange={(v) => form.setField('pashto', v)}
                  onBlur={form.checkPashto}
                  warnings={form.crossConceptWarnings}
                  error={errors.pashto}
                />

                <SubmitAudio capture={capture} pashto={values.pashto} />

                <VariantFields form={form} />

                <button type="submit" disabled={loading} className={PRIMARY_CTA}>
                  {loading ? 'Submitting…' : 'Submit Word'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
