const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/requireRole');
const { getUsers } = require('../controllers/userController');

const router = Router();

router.use(verifyToken);

router.get('/', requireRole('admin'), getUsers);

module.exports = router;
