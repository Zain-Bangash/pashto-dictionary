import { body, param, ValidationChain } from 'express-validator';
import { formsValidators } from './variantForms';
import { PROPOSAL_MAX } from './suggestions';

const LOCKED = ['pashto', 'definition', 'region', 'concept', 'conceptId', 'status', 'submissionNote', 'submittedBy'];

export const idParam = param('id').isMongoId().withMessage('Invalid id');

export const proposalValidators: ValidationChain[] = [
  ...LOCKED.map((f) => body(f).not().exists().withMessage(`${f} cannot be changed by a suggestion`)),
  body('phonetic').optional({ values: 'null' }).isString().withMessage('phonetic must be text')
    .isLength({ max: PROPOSAL_MAX.phonetic }).withMessage(`phonetic must be ${PROPOSAL_MAX.phonetic} characters or fewer`),
  body('example').optional({ values: 'null' }).isString().withMessage('example must be text')
    .isLength({ max: PROPOSAL_MAX.example }).withMessage(`example must be ${PROPOSAL_MAX.example} characters or fewer`),
  body('extra').optional().isObject().withMessage('extra must be an object'),
  ...formsValidators,
];

export const noteValidator = body('note').isString().withMessage('note is required').trim()
  .notEmpty().withMessage('note is required').isLength({ max: 500 }).withMessage('note must be 500 characters or fewer');

export const suggestionStatusValidators: ValidationChain[] = [
  idParam,
  body('status').isIn(['approved', 'rejected', 'published']).withMessage('status must be approved, rejected, or published'),
  body('moderatorNote').optional().isString().trim().isLength({ max: 500 }).withMessage('moderatorNote must be 500 characters or fewer'),
];
