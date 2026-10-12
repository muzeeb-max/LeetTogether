import { searchProblems, getProblemByTitleSlug } from '../services/leetcodeService.js';

/**
 * Search problems from LeetCode
 * @route   GET /api/problems/search?q=query
 * @access  Public
 */
export const searchLeetCodeProblems = async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 2) {
    return res.json([]);
  }

  try {
    const results = await searchProblems(q);
    return res.json(results);
  } catch (error) {
    console.error('searchLeetCodeProblems error:', error.message);
    return res.status(500).json({ 
      message: 'Failed to search problems',
      error: error.message 
    });
  }
};

/**
 * Get a specific problem from LeetCode by titleSlug
 * @route   GET /api/problems/leetcode/:titleSlug
 * @access  Public
 */
export const getLeetCodeProblem = async (req, res) => {
  const { titleSlug } = req.params;

  if (!titleSlug) {
    return res.status(400).json({ message: 'Title slug is required' });
  }

  try {
    const problem = await getProblemByTitleSlug(titleSlug);
    return res.json(problem);
  } catch (error) {
    console.error('getLeetCodeProblem error:', error.message);
    return res.status(404).json({ 
      message: 'Problem not found on LeetCode',
      error: error.message 
    });
  }
};
