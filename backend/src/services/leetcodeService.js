import axios from 'axios';

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

/**
 * Search problems on LeetCode using GraphQL
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Array of matching problems
 */
export const searchLeetCodeProblems = async (query) => {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const graphqlQuery = {
    query: `
      query problemsetQuestionList($categorySlug: String, $filters: QuestionListFilterInput, $limit: Int, $skip: Int) {
        problemsetQuestionList: questionList(
          categorySlug: $categorySlug
          filters: $filters
          limit: $limit
          skip: $skip
        ) {
          total: numTotal
          questions: data {
            acRate
            difficulty
            freqBar
            frontendQuestionId: questionFrontendId
            isFavor
            paidOnly: isPaidOnly
            status
            title
            titleSlug
            topicTags {
              name
              id
              slug
            }
            hasSolution
            hasVideoSolution
          }
        }
      }
    `,
    variables: {
      categorySlug: '',
      filters: {
        searchKeywords: query
      },
      limit: 10,
      skip: 0
    }
  };

  try {
    const response = await axios.post(LEETCODE_GRAPHQL_URL, graphqlQuery, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    const questions = response.data?.data?.problemsetQuestionList?.questions || [];
    
    return questions.map(q => ({
      title: q.title,
      titleSlug: q.titleSlug,
      difficulty: q.difficulty.toLowerCase(),
      questionId: q.frontendQuestionId
    }));
  } catch (error) {
    console.error('LeetCode search error:', error.message);
    // Return empty array instead of throwing to prevent UI crashes
    return [];
  }
};

/**
 * Fetch complete problem details from LeetCode by titleSlug
 * @param {string} titleSlug - LeetCode problem title slug
 * @returns {Promise<Object>} - Complete problem details
 */
export const getLeetCodeProblemDetails = async (titleSlug) => {
  const graphqlQuery = {
    query: `
      query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
          title
          titleSlug
          difficulty
          content
          exampleTestcases
          codeSnippets {
            lang
            langSlug
            code
          }
          hints
          topicTags {
            name
            slug
          }
          similarQuestions
        }
      }
    `,
    variables: {
      titleSlug
    }
  };

  try {
    const response = await axios.post(LEETCODE_GRAPHQL_URL, graphqlQuery, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000 // 15 second timeout
    });

    const question = response.data?.data?.question;
    
    if (!question) {
      throw new Error('Problem not found on LeetCode');
    }

    // Parse HTML content to extract examples and constraints
    const { examples, constraints } = parseLeetCodeContent(question.content);

    // Map code snippets to our language format
    const starterCode = mapCodeSnippets(question.codeSnippets);

    return {
      title: question.title,
      titleSlug: question.titleSlug,
      difficulty: question.difficulty.toLowerCase(),
      description: stripHtmlTags(question.content) || 'No description available',
      examples,
      constraints,
      starterCode,
      testCases: extractTestCases(question.exampleTestcases)
    };
  } catch (error) {
    console.error('LeetCode problem fetch error:', error.message);
    throw new Error('Failed to fetch problem details from LeetCode');
  }
};

/**
 * Parse LeetCode HTML content to extract examples and constraints
 */
const parseLeetCodeContent = (htmlContent) => {
  const examples = [];
  const constraints = [];

  if (!htmlContent) {
    return { examples, constraints };
  }

  // Extract examples using multiple patterns
  const examplePatterns = [
    /<strong>Example \d+:<\/strong>[\s\S]*?<pre>([\s\S]*?)<\/pre>/gi,
    /<strong>Example \d+:<\/strong>[\s\S]*?<p>Input:[\s\S]*?<code>([\s\S]*?)<\/code>[\s\S]*?<p>Output:[\s\S]*?<code>([\s\S]*?)<\/code>/gi,
    /<strong>Example \d+:<\/strong>([\s\S]*?)(?=<strong>Example|<strong>Constraints|$)/gi
  ];

  for (const pattern of examplePatterns) {
    const matches = htmlContent.matchAll(pattern);
    for (const match of matches) {
      let input = '';
      let output = '';
      let explanation = '';

      if (match[1]) {
        const text = match[1];
        const inputMatch = text.match(/Input[:\s]*([\s\S]*?)(?=Output|Explanation|$)/i);
        const outputMatch = text.match(/Output[:\s]*([\s\S]*?)(?=Explanation|$)/i);
        const explanationMatch = text.match(/Explanation[:\s]*([\s\S]*?)$/i);

        input = inputMatch ? stripHtmlTags(inputMatch[1]).trim() : stripHtmlTags(text).split('\n')[0] || '';
        output = outputMatch ? stripHtmlTags(outputMatch[1]).trim() : '';
        explanation = explanationMatch ? stripHtmlTags(explanationMatch[1]).trim() : '';
      }

      if (match[2]) {
        output = stripHtmlTags(match[2]).trim();
      }

      if (input || output) {
        examples.push({ input, output, explanation });
      }
    }
    if (examples.length > 0) break;
  }

  // If no examples found, try a simpler approach
  if (examples.length === 0) {
    const simpleExamples = htmlContent.match(/<p>[\s\S]*?<strong>Example[\s\S]*?<\/p>/gi);
    if (simpleExamples) {
      simpleExamples.forEach(ex => {
        const clean = stripHtmlTags(ex);
        examples.push({
          input: clean.substring(0, 200),
          output: '',
          explanation: ''
        });
      });
    }
  }

  // Extract constraints
  const constraintsPatterns = [
    /<strong>Constraints:<\/strong>[\s\S]*?<ul>([\s\S]*?)<\/ul>/gi,
    /<strong>Constraints:<\/strong>[\s\S]*?<p>([\s\S]*?)<\/p>/gi
  ];

  for (const pattern of constraintsPatterns) {
    const constraintsMatch = htmlContent.match(pattern);
    if (constraintsMatch) {
      const listItems = constraintsMatch[1]?.match(/<li>(.*?)<\/li>/gi) || [];
      listItems.forEach(item => {
        const constraint = stripHtmlTags(item).trim();
        if (constraint && constraint.length > 5) {
          constraints.push(constraint);
        }
      });
      if (constraints.length > 0) break;
    }
  }

  // If no constraints found, try to extract from text
  if (constraints.length === 0) {
    const constraintsText = htmlContent.match(/Constraints[:\s]*([\s\S]*?)(?=$|<h[0-9]|<strong)/i);
    if (constraintsText) {
      const lines = stripHtmlTags(constraintsText[1]).split('\n').filter(l => l.trim().length > 5);
      constraints.push(...lines.slice(0, 5));
    }
  }

  return { examples, constraints };
};

/**
 * Strip HTML tags from string
 */
const stripHtmlTags = (str) => {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
};

/**
 * Map LeetCode code snippets to our language format
 */
const mapCodeSnippets = (codeSnippets) => {
  const languageMap = {
    'javascript': 'javascript',
    'python3': 'python',
    'cpp': 'cpp',
    'java': 'java'
  };

  return codeSnippets
    .filter(snippet => languageMap[snippet.langSlug])
    .map(snippet => ({
      language: languageMap[snippet.langSlug],
      code: snippet.code
    }));
};

/**
 * Extract test cases from example testcases string
 */
const extractTestCases = (exampleTestcases) => {
  if (!exampleTestcases) return [];

  try {
    // LeetCode provides test cases as a string with different formats
    // We'll parse them into a simple format
    const lines = exampleTestcases.split('\n').filter(line => line.trim());
    
    return lines.slice(0, 3).map((line, idx) => ({
      input: line.trim(),
      expectedOutput: '', // LeetCode doesn't provide expected output in exampleTestcases
      isPrivate: idx > 0 // First one is public, rest are private
    }));
  } catch (error) {
    console.error('Error parsing test cases:', error);
    return [];
  }
};
