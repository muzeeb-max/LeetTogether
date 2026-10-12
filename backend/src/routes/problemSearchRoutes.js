import express from 'express';
import { searchProblems, getLeetCodeProblem } from '../controllers/problemSearchController.js';

const router = express.Router();

// Search problems from LeetCode
router.get('/search', searchProblems);

// Get complete problem details from LeetCode by titleSlug
router.get('/leetcode/:titleSlug', getLeetCodeProblem);

export default router;
