import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { getSubmissionSummary } from '../controllers/submissionController';

const router = Router();

router.get('/summary', verifyToken, getSubmissionSummary);

export = router;
