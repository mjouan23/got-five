import { Router } from 'express';
import { sessionController } from '../controllers/sessionController.js';

const router = Router();

router.post('/sessions', sessionController.create);
router.get('/sessions/:sessionCode', sessionController.getPublic);
router.post('/sessions/:sessionCode/join', sessionController.join);
router.post('/sessions/:sessionCode/reconnect', sessionController.reconnect);
router.post('/sessions/:sessionCode/start', sessionController.start);
router.post('/sessions/:sessionCode/leave', sessionController.leave);
router.post('/sessions/:sessionCode/draw', sessionController.draw);

export default router;
