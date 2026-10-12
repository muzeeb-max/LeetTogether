import express from 'express';
import { getProblems, getProblem, createProblem } from '../controllers/problemController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getProblems); // Public access
router.get('/:idOrSlug', getProblem); // Public access
router.post('/', protect, createProblem); // Custom problem additions

export default router;
