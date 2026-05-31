import { Op } from 'sequelize';
import { Problem } from '../models/index.js';

// @desc    Get all problems with optional filters
// @route   GET /api/problems
// @access  Private
export const getProblems = async (req, res) => {
  const { difficulty, search } = req.query;

  try {
    const where = {};

    if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
      where.difficulty = difficulty;
    }

    if (search) {
      where.title = { [Op.like]: `%${search}%` };
    }

    const problems = await Problem.findAll({
      where,
      attributes: ['id', 'title', 'slug', 'difficulty', 'constraints'],
      order: [['createdAt', 'ASC']]
    });

    return res.json(problems);
  } catch (error) {
    console.error('getProblems error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get a single problem by ID or slug
// @route   GET /api/problems/:idOrSlug
// @access  Private
export const getProblem = async (req, res) => {
  const { idOrSlug } = req.params;

  try {
    let problem;
    if (!isNaN(idOrSlug)) {
      problem = await Problem.findByPk(idOrSlug);
    } else {
      problem = await Problem.findOne({ where: { slug: idOrSlug } });
    }

    if (!problem) return res.status(404).json({ message: 'Problem not found' });
    return res.json(problem);
  } catch (error) {
    console.error('getProblem error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a new custom problem
// @route   POST /api/problems
// @access  Private
export const createProblem = async (req, res) => {
  const { title, difficulty, description, examples, constraints, starterCode, testCases } = req.body;

  try {
    if (!title || !difficulty || !description || !starterCode || !testCases) {
      return res.status(400).json({ message: 'Title, difficulty, description, starterCode and testCases are required' });
    }

    const exists = await Problem.findOne({ where: { title } });
    if (exists) return res.status(400).json({ message: 'A problem with this title already exists' });

    const problem = await Problem.create({ title, difficulty, description, examples, constraints, starterCode, testCases });
    return res.status(201).json(problem);
  } catch (error) {
    console.error('createProblem error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};
