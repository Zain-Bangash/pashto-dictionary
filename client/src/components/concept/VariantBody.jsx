import ExtraFieldsDisplay from '../fields/ExtraFieldsDisplay';
import FormsDisplay from '../forms/FormsDisplay';
import VariantClips from '../audio/VariantClips';
import AlsoMeans from './AlsoMeans';

// What the selected region's word means and how it is used
export default function VariantBody({ variant }) {
  return (
    <div className="space-y-3">
      {variant.phonetic && <p className="font-display text-lg italic text-gold">{variant.phonetic}</p>}
      <p className="font-ui text-warm/85 text-sm sm:text-base leading-relaxed">{variant.definition}</p>
      {variant.example && (
        <p dir="rtl" className="font-pashto text-warm/60 text-lg border-r-2 border-gold/30 pr-3">{variant.example}</p>
      )}
      <AlsoMeans meanings={variant.alsoMeans} />
      <ExtraFieldsDisplay appliesTo="variant" values={variant.extra} />
      <FormsDisplay key={variant._id} forms={variant.forms} ownerSub={variant.submittedBy?.cognitoSub} />
      <VariantClips variant={variant} />
    </div>
  );
}
