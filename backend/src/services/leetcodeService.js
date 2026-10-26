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

  console.log('[LeetCode Service] Searching for:', query);

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

  const requestPayload = {
    query: graphqlQuery,
    variables: {
      categorySlug: '',
      filters: {
        searchKeywords: query.trim()
      }
    }
  };

  console.log('[LeetCode Service] Sending GraphQL request to:', LEETCODE_GRAPHQL_URL);
  console.log('[LeetCode Service] Request payload:', JSON.stringify(requestPayload, null, 2));

  try {
    const response = await axios.post(
      LEETCODE_GRAPHQL_URL,
      requestPayload,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('[LeetCode Service] Response status:', response.status);
    console.log('[LeetCode Service] Response data:', JSON.stringify(response.data, null, 2));

    const questions = response.data?.data?.problemsetQuestionList?.questions || [];
    console.log('[LeetCode Service] Extracted questions count:', questions.length);

    // Transform to our format
    const transformed = questions.map(q => ({
      title: q.title,
      titleSlug: q.titleSlug,
      difficulty: q.difficulty?.toLowerCase() || 'medium',
      acRate: q.acRate,
      topicTags: q.topicTags?.map(t => t.name) || []
    }));

    console.log('[LeetCode Service] Transformed results:', transformed);
    return transformed;
  } catch (error) {
    console.error('[LeetCode Service] LeetCode search error:', error.message);
    console.error('[LeetCode Service] Full error:', error);
    if (error.response) {
      console.error('[LeetCode Service] Error response status:', error.response.status);
      console.error('[LeetCode Service] Error response data:', error.response.data);
    }
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
const decodeHtmlEntities = (value = '') => String(value)
  .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
  .replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&apos;|&#39;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&amp;/gi, '&');

const parseLeetCodeContent = (htmlContent) => {
  let description = htmlContent;
  let examples = [];
  let constraints = [];

  // Remove HTML tags for cleaner description
  description = decodeHtmlEntities(htmlContent
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
    .replace(/&#10;/g, '\n')
    .replace(/\n/g, '\n')
    .replace(/\\n/g, '\n')
    .trim());

  // Try to extract examples from HTML
  const exampleMatches = htmlContent.match(/<strong>Example \d+:<\/strong>[\s\S]*?(?=<strong>Example \d+:|$)/gi);
  if (exampleMatches) {
    examples = exampleMatches.map(ex => {
      const text = ex
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<\/(?:p|div|li)>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
      const decodedText = decodeHtmlEntities(text);
      const inputMatch = decodedText.match(/Input:\s*([\s\S]*?)(?=\s*Output:|$)/i);
      const outputMatch = decodedText.match(/Output:\s*([\s\S]*?)(?=\s*Explanation:|$)/i);
      const explanationMatch = decodedText.match(/Explanation:\s*([\s\S]+)/i);

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
        return parsed.map((tc) => typeof tc === 'string'
          ? { input: tc, output: '', explanation: '' }
          : { input: tc.input || '', output: tc.output || '', explanation: '' });
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
    'csharp': 'csharp',
    'c-sharp': 'csharp',
    'go': 'go',
    'rust': 'rust',
    'typescript': 'typescript'
  };
  
  return mapping[langSlug?.toLowerCase()] || langSlug || 'javascript';
};
