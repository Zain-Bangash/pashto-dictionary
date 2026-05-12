import { Router } from 'express';
import { verifyToken } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { getUsers } from '../controllers/userController';

const router = Router();

router.use(verifyToken);

router.get('/', requireRole('admin'), getUsers);

export = router;
