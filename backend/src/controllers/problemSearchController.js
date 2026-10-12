import { searchProblems, getProblemByTitleSlug } from '../services/leetcodeService.js';

/**
 * Search problems from LeetCode
 * @route   GET /api/problems/search?q=query
 * @access  Public
 */
export const searchLeetCodeProblems = async (req, res) => {
  const { q } = req.query;

  console.log('[Controller] Search request received. Query:', q);

  if (!q || q.trim().length < 2) {
    console.log('[Controller] Query too short, returning empty array');
    return res.json([]);
  }

  try {
    console.log('[Controller] Calling searchProblems service with:', q);
    const results = await searchProblems(q);
    console.log('[Controller] Search results:', results);
    console.log('[Controller] Number of results:', results.length);
    return res.json(results);
  } catch (error) {
    console.error('[Controller] searchLeetCodeProblems error:', error.message);
    console.error('[Controller] Full error:', error);
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
