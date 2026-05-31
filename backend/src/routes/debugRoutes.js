import express from 'express';
import axios from 'axios';

const router = express.Router();

const toBase64 = (str) => Buffer.from(str || '').toString('base64');
const fromBase64 = (b64) => Buffer.from(b64 || '', 'base64').toString('utf-8');

// @desc    Debug Judge0 connectivity
// @route   GET /api/debug/judge0
// @access  Private (for debugging)
router.get('/judge0', async (req, res) => {
  const apiUrl = process.env.JUDGE0_API_URL || 'https://ce.judge0.com';
  const apiKey = process.env.JUDGE0_API_KEY;
  const isRapidAPI = process.env.JUDGE0_IS_RAPIDAPI === 'true';

  console.log(`[Debug] Testing Judge0 connectivity to: ${apiUrl}`);

  const headers = { 'content-type': 'application/json' };
  if (isRapidAPI && apiKey) {
    headers['X-RapidAPI-Key'] = apiKey;
    headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
  }

  const result = {
    timestamp: new Date().toISOString(),
    config: {
      apiUrl,
      isRapidAPI,
      hasApiKey: !!apiKey
    },
    connectivity: null,
    languages: null,
    error: null
  };

  try {
    const startTime = Date.now();

    // Test connectivity by fetching available languages
    const response = await axios.get(`${apiUrl}/languages`, {
      headers,
      timeout: 10000
    });

    const elapsed = Date.now() - startTime;

    result.connectivity = {
      status: 'success',
      responseTime: `${elapsed}ms`,
      httpStatus: response.status
    };

    result.languages = response.data.map(lang => ({
      id: lang.id,
      name: lang.name
    }));

    // Check if required language IDs are available
    const requiredLanguages = [
      { id: 93, name: 'JavaScript (Node.js)' },
      { id: 92, name: 'Python' },
      { id: 76, name: 'C++' },
      { id: 91, name: 'Java' }
    ];

    result.languageCheck = requiredLanguages.map(reqLang => {
      const found = response.data.find(l => l.id === reqLang.id);
      return {
        ...reqLang,
        available: !!found
      };
    });

    console.log(`[Debug] Judge0 connectivity test succeeded in ${elapsed}ms`);

  } catch (err) {
    result.connectivity = {
      status: 'failed',
      error: err.message
    };
    result.error = {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      code: err.code
    };

    console.error(`[Debug] Judge0 connectivity test failed:`, err.message);
    if (err.response) {
      console.error(`[Debug] Response status: ${err.response.status}`);
      console.error(`[Debug] Response data:`, JSON.stringify(err.response.data));
    }
  }

  res.json(result);
});

// @desc    Test Judge0 code execution with simple JavaScript
// @route   POST /api/debug/judge0-test
// @access  Private (for debugging)
router.post('/judge0-test', async (req, res) => {
  const apiUrl = process.env.JUDGE0_API_URL || 'https://ce.judge0.com';
  const apiKey = process.env.JUDGE0_API_KEY;
  const isRapidAPI = process.env.JUDGE0_IS_RAPIDAPI === 'true';

  const headers = { 'content-type': 'application/json' };
  if (isRapidAPI && apiKey) {
    headers['X-RapidAPI-Key'] = apiKey;
    headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
  }

  // Test with simple JavaScript code
  const testCode = 'console.log("HELLO_JUDGE0")';
  const testLanguageId = 93; // JavaScript (Node.js)
  const testStdin = '';

  const result = {
    timestamp: new Date().toISOString(),
    config: {
      apiUrl,
      isRapidAPI,
      hasApiKey: !!apiKey,
      testCode,
      languageId: testLanguageId
    },
    execution: null,
    error: null
  };

  try {
    const startTime = Date.now();

    console.log(`[Debug] Testing Judge0 execution with JavaScript...`);
    console.log(`[Debug] Submitting to: ${apiUrl}/submissions`);

    // Try synchronous execution first
    try {
      const response = await axios.post(
        `${apiUrl}/submissions?base64_encoded=true&wait=true`,
        {
          source_code: toBase64(testCode),
          language_id: testLanguageId,
          stdin: toBase64(testStdin)
        },
        { headers, timeout: 15000 }
      );

      const elapsed = Date.now() - startTime;

      result.execution = {
        method: 'synchronous',
        responseTime: `${elapsed}ms`,
        submission: {
          token: response.data.token,
          status: response.data.status
        },
        output: {
          stdout: response.data.stdout ? fromBase64(response.data.stdout) : null,
          stderr: response.data.stderr ? fromBase64(response.data.stderr) : null,
          compileOutput: response.data.compile_output ? fromBase64(response.data.compile_output) : null,
          time: response.data.time,
          memory: response.data.memory
        }
      };

      console.log(`[Debug] Synchronous execution succeeded in ${elapsed}ms`);
      console.log(`[Debug] Output:`, result.execution.output);

    } catch (syncError) {
      console.warn(`[Debug] Synchronous execution failed: ${syncError.message}`);
      console.warn(`[Debug] Trying async with polling...`);

      // Fallback to async with polling
      const submitRes = await axios.post(
        `${apiUrl}/submissions?base64_encoded=true`,
        {
          source_code: toBase64(testCode),
          language_id: testLanguageId,
          stdin: toBase64(testStdin)
        },
        { headers, timeout: 10000 }
      );

      const token = submitRes.data.token;
      console.log(`[Debug] Async submission token: ${token}`);

      let asyncResult = null;
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusRes = await axios.get(
          `${apiUrl}/submissions/${token}?base64_encoded=true`,
          { headers, timeout: 5000 }
        );

        console.log(`[Debug] Poll ${i + 1}: Status ID = ${statusRes.data.status.id}`);

        if (statusRes.data.status.id > 2) {
          asyncResult = statusRes.data;
          break;
        }
      }

      if (!asyncResult) {
        throw new Error('Execution timed out after polling');
      }

      const elapsed = Date.now() - startTime;

      result.execution = {
        method: 'async-polling',
        responseTime: `${elapsed}ms`,
        token,
        submission: {
          status: asyncResult.status
        },
        output: {
          stdout: asyncResult.stdout ? fromBase64(asyncResult.stdout) : null,
          stderr: asyncResult.stderr ? fromBase64(asyncResult.stderr) : null,
          compileOutput: asyncResult.compile_output ? fromBase64(asyncResult.compile_output) : null,
          time: asyncResult.time,
          memory: asyncResult.memory
        }
      };

      console.log(`[Debug] Async execution succeeded`);
      console.log(`[Debug] Output:`, result.execution.output);
    }

  } catch (err) {
    const elapsed = Date.now() - startTime;

    result.error = {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data ? JSON.stringify(err.response.data) : null,
      code: err.code,
      responseTime: `${elapsed}ms`
    };

    console.error(`[Debug] Judge0 execution test failed:`, err.message);
    if (err.response) {
      console.error(`[Debug] Response status: ${err.response.status}`);
      console.error(`[Debug] Response data:`, err.response.data);
    }
  }

  res.json(result);
});

// @desc    Get system information for debugging
// @route   GET /api/debug/system
// @access  Private (for debugging)
router.get('/system', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    judge0Config: {
      apiUrl: process.env.JUDGE0_API_URL,
      isRapidAPI: process.env.JUDGE0_IS_RAPIDAPI,
      hasApiKey: !!process.env.JUDGE0_API_KEY
    },
    languageIds: {
      javascript: 93,
      python: 92,
      cpp: 76,
      java: 91
    }
  });
});

export default router;