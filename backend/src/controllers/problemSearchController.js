import { searchLeetCodeProblems, getLeetCodeProblemDetails } from '../services/leetcodeService.js';

// @desc    Search problems from LeetCode
// @route   GET /api/problems/search?q=query
// @access  Public
export const searchProblems = async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 2) {
    return res.json([]);
  }

  try {
    const problems = await searchLeetCodeProblems(q);
    return res.json(problems);
  } catch (error) {
    console.error('searchProblems error:', error.message);
    return res.status(500).json({ message: 'Failed to search problems' });
  }
};

// @desc    Get complete problem details from LeetCode by titleSlug
// @route   GET /api/problems/leetcode/:titleSlug
// @access  Public
export const getLeetCodeProblem = async (req, res) => {
  const { titleSlug } = req.params;

  if (!titleSlug) {
    return res.status(400).json({ message: 'titleSlug is required' });
  }

  try {
    const problem = await getLeetCodeProblemDetails(titleSlug);
    return res.json(problem);
  } catch (error) {
    console.error('getLeetCodeProblem error:', error.message);
    return res.status(404).json({ message: 'Problem not found on LeetCode' });
  }
};
