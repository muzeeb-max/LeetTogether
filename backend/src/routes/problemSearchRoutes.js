import express from 'express';
import { searchLeetCodeProblems, getLeetCodeProblem } from '../controllers/problemSearchController.js';

const router = express.Router();

// Search LeetCode problems
router.get('/search', searchLeetCodeProblems);

// Get specific LeetCode problem by titleSlug
router.get('/leetcode/:titleSlug', getLeetCodeProblem);

export default router;
