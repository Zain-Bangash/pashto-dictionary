import ExtraFieldsDisplay from '../fields/ExtraFieldsDisplay';
import FormsDisplay from '../forms/FormsDisplay';
import VariantClips from '../audio/VariantClips';
import AlsoMeans from './AlsoMeans';
import VariantExample from './VariantExample';

// What the selected region's word means and how it is used
export default function VariantBody({ variant }) {
  return (
    <div className="space-y-3">
      {variant.phonetic && <p className="font-display text-lg italic text-gold">{variant.phonetic}</p>}
      <p className="font-ui text-warm/85 text-sm sm:text-base leading-relaxed">{variant.definition}</p>
      <VariantExample variant={variant} />
      <AlsoMeans meanings={variant.alsoMeans} />
      <ExtraFieldsDisplay appliesTo="variant" values={variant.extra} />
      <FormsDisplay key={variant._id} forms={variant.forms} ownerSub={variant.submittedBy?.cognitoSub} />
      <VariantClips variant={variant} />
    </div>
  );
}
