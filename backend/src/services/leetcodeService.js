import axios from 'axios';

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

/**
 * Search for problems on LeetCode using GraphQL
 * @param {string} query - Search query string
 * @returns {Promise<Array>} - Array of matching problems
 */
export const searchProblems = async (query) => {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const graphqlQuery = `
    query problemsetQuestionList($categorySlug: String, $filters: QuestionListFilterInput) {
      problemsetQuestionList: questionList(
        categorySlug: $categorySlug
        filters: $filters
      ) {
        questions: data {
          title
          titleSlug
          difficulty
          acRate
          freqBar
          topicTags {
            name
            slug
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      LEETCODE_GRAPHQL_URL,
      {
        query: graphqlQuery,
        variables: {
          categorySlug: '',
          filters: {
            searchKeywords: query.trim()
          }
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const questions = response.data?.data?.problemsetQuestionList?.questions || [];
    
    // Transform to our format
    return questions.map(q => ({
      title: q.title,
      titleSlug: q.titleSlug,
      difficulty: q.difficulty?.toLowerCase() || 'medium',
      acRate: q.acRate,
      topicTags: q.topicTags?.map(t => t.name) || []
    }));
  } catch (error) {
    console.error('LeetCode search error:', error.message);
    throw new Error('Failed to search LeetCode problems');
  }
};

/**
 * Get complete problem details from LeetCode by titleSlug
 * @param {string} titleSlug - The problem's title slug
 * @returns {Promise<Object>} - Complete problem details
 */
export const getProblemByTitleSlug = async (titleSlug) => {
  if (!titleSlug) {
    throw new Error('Title slug is required');
  }

  const graphqlQuery = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title
        titleSlug
        difficulty
        content
        exampleTestcaseList
        exampleTestcases
        metaData
        codeSnippets {
          lang
          langSlug
          code
        }
        topicTags {
          name
          slug
        }
        hints
      }
    }
  `;

  try {
    const response = await axios.post(
      LEETCODE_GRAPHQL_URL,
      {
        query: graphqlQuery,
        variables: {
          titleSlug
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const question = response.data?.data?.question;
    
    if (!question) {
      throw new Error('Problem not found on LeetCode');
    }

    // Parse HTML content to extract description, examples, constraints
    const parsedContent = parseLeetCodeContent(question.content || '');
    
    // Parse code snippets to get starter code
    const starterCode = question.codeSnippets?.map(snippet => ({
      language: mapLanguageSlug(snippet.langSlug),
      code: snippet.code
    })) || [];

    // Parse examples from exampleTestcaseList or exampleTestcases
    const examples = parseExamples(question.exampleTestcaseList || question.exampleTestcases || '');

    // Parse constraints from metadata or content
    const constraints = parseConstraints(question.metaData || parsedContent.constraints);

    return {
      title: question.title,
      titleSlug: question.titleSlug,
      difficulty: question.difficulty?.toLowerCase() || 'medium',
      description: parsedContent.description,
      examples: examples,
      constraints: constraints,
      starterCode: starterCode,
      topicTags: question.topicTags?.map(t => t.name) || [],
      hints: question.hints || []
    };
  } catch (error) {
    console.error('LeetCode problem fetch error:', error.message);
    throw new Error('Failed to fetch problem from LeetCode');
  }
};

/**
 * Parse LeetCode HTML content to extract description, examples, constraints
 */
const parseLeetCodeContent = (htmlContent) => {
  let description = htmlContent;
  let examples = [];
  let constraints = [];

  // Remove HTML tags for cleaner description
  description = htmlContent
    .replace(/<[^>]*>/g, match => {
      // Keep line breaks
      if (match === '<br>' || match === '<br/>' || match === '</p>') {
        return '\n';
      }
      if (match === '<p>' || match === '<div>') {
        return '';
      }
      return '';
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#10;/g, '\n')
    .replace(/\\n/g, '\n')
    .trim();

  // Try to extract examples from HTML
  const exampleMatches = htmlContent.match(/<strong>Example \d+:<\/strong>[\s\S]*?(?=<strong>Example \d+:|$)/gi);
  if (exampleMatches) {
    examples = exampleMatches.map(ex => {
      const text = ex
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .trim();
      
      // Try to parse input/output
      const inputMatch = text.match(/Input:\s*([^\n]+)/i);
      const outputMatch = text.match(/Output:\s*([^\n]+)/i);
      const explanationMatch = text.match(/Explanation:\s*([\s\S]+)/i);
      
      return {
        input: inputMatch ? inputMatch[1].trim() : '',
        output: outputMatch ? outputMatch[1].trim() : '',
        explanation: explanationMatch ? explanationMatch[1].trim() : ''
      };
    });
  }

  // Try to extract constraints
  const constraintMatches = htmlContent.match(/<strong>Constraints:<\/strong>[\s\S]*?(?=<strong>|$)/i);
  if (constraintMatches) {
    const constraintText = constraintMatches[0]
      .replace(/<[^>]*>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.toLowerCase().includes('constraint'));
    
    constraints = constraintText;
  }

  return { description, examples, constraints };
};

/**
 * Parse examples from LeetCode testcase format
 */
const parseExamples = (testcaseString) => {
  if (!testcaseString) return [];

  try {
    // If it's a string, try to parse as JSON
    if (typeof testcaseString === 'string') {
      const parsed = JSON.parse(testcaseString);
      if (Array.isArray(parsed)) {
        return parsed.map(tc => ({
          input: tc.input || '',
          output: tc.output || '',
          explanation: ''
        }));
      }
    }
  } catch (e) {
    // If parsing fails, return empty array
  }

  return [];
};

/**
 * Parse constraints from metadata
 */
const parseConstraints = (metadata) => {
  if (!metadata) return [];

  try {
    if (typeof metadata === 'string') {
      const parsed = JSON.parse(metadata);
      if (parsed.constraints) {
        return parsed.constraints;
      }
    }
  } catch (e) {
    // If parsing fails, return empty array
  }

  return [];
};

/**
 * Map LeetCode language slug to our language format
 */
const mapLanguageSlug = (langSlug) => {
  const mapping = {
    'javascript': 'javascript',
    'python': 'python',
    'python3': 'python',
    'cpp': 'cpp',
    'c++': 'cpp',
    'java': 'java',
    'go': 'go',
    'rust': 'rust',
    'typescript': 'typescript'
  };
  
  return mapping[langSlug?.toLowerCase()] || langSlug || 'javascript';
};
