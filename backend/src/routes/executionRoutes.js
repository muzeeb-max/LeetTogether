import express from 'express';
import { runCode, submitCode } from '../controllers/executionController.js';
import { protect } from '../middleware/auth.js';
import { executionLimiter } from '../config/security.js';

const router = express.Router();

router.use(protect); // All code executions are protected

router.post('/run', executionLimiter, runCode);
router.post('/submit', executionLimiter, submitCode);

export default router;
