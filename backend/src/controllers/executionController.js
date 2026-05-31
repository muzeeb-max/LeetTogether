import axios from 'axios';
import { Problem, User, Session } from '../models/index.js';

const toBase64 = (str) => Buffer.from(str || '').toString('base64');
const fromBase64 = (b64) => Buffer.from(b64 || '', 'base64').toString('utf-8');

const LANGUAGE_IDS = {
  javascript: 93,
  python: 92,
  cpp: 76,
  java: 91
};

// Driver code templates for bundling user code with test runners
const getDriverCode = (problemSlug, language, userCode) => {
  if (problemSlug === 'two-sum') {
    const drivers = {
      javascript: `\n${userCode}\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim().split('\\n');\nif (input.length >= 2) {\n  const nums = JSON.parse(input[0]);\n  const target = parseInt(input[1]);\n  const result = twoSum(nums, target);\n  console.log(JSON.stringify(result));\n}\n`,
      python: `\nimport sys, json\n${userCode}\ninput_data = sys.stdin.read().strip().split('\\n')\nif len(input_data) >= 2:\n    nums = json.loads(input_data[0])\n    target = int(input_data[1])\n    sol = Solution()\n    print(json.dumps(sol.twoSum(nums, target)))\n`,
      cpp: `\n#include <iostream>\n#include <vector>\n#include <string>\n#include <sstream>\n#include <algorithm>\nusing namespace std;\n${userCode}\nint main() {\n    string line1, line2;\n    if (getline(cin, line1) && getline(cin, line2)) {\n        line1.erase(remove(line1.begin(), line1.end(), '['), line1.end());\n        line1.erase(remove(line1.begin(), line1.end(), ']'), line1.end());\n        stringstream ss(line1);\n        vector<int> nums;\n        string temp;\n        while (getline(ss, temp, ',')) nums.push_back(stoi(temp));\n        int target = stoi(line2);\n        Solution sol;\n        vector<int> res = sol.twoSum(nums, target);\n        if (res.size() >= 2) cout << "[" << res[0] << "," << res[1] << "]" << endl;\n        else cout << "[]" << endl;\n    }\n    return 0;\n}\n`,
      java: `\nimport java.util.*;\nimport java.io.*;\n${userCode}\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        String line1 = br.readLine();\n        String line2 = br.readLine();\n        if (line1 != null && line2 != null) {\n            line1 = line1.replace("[", "").replace("]", "").trim();\n            String[] parts = line1.split(",");\n            int[] nums = new int[parts.length];\n            for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i].trim());\n            int target = Integer.parseInt(line2.trim());\n            Solution sol = new Solution();\n            int[] res = sol.twoSum(nums, target);\n            System.out.println("[" + res[0] + "," + res[1] + "]");\n        }\n    }\n}\n`
    };
    return drivers[language] || userCode;
  }

  if (problemSlug === 'palindrome-number') {
    const drivers = {
      javascript: `\n${userCode}\nconst fs = require('fs');\nconst x = parseInt(fs.readFileSync(0, 'utf-8').trim());\nconsole.log(isPalindrome(x).toString());\n`,
      python: `\nimport sys\n${userCode}\nx = int(sys.stdin.read().strip())\nsol = Solution()\nprint(str(sol.isPalindrome(x)).lower())\n`,
      cpp: `\n#include <iostream>\nusing namespace std;\n${userCode}\nint main() {\n    int x;\n    if (cin >> x) {\n        Solution sol;\n        cout << (sol.isPalindrome(x) ? "true" : "false") << endl;\n    }\n    return 0;\n}\n`,
      java: `\nimport java.util.*;\n${userCode}\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextInt()) {\n            int x = sc.nextInt();\n            Solution sol = new Solution();\n            System.out.println(sol.isPalindrome(x) ? "true" : "false");\n        }\n    }\n}\n`
    };
    return drivers[language] || userCode;
  }

  if (problemSlug === 'valid-parentheses') {
    const drivers = {
      javascript: `\n${userCode}\nconst fs = require('fs');\nlet s = fs.readFileSync(0, 'utf-8').trim();\nif (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);\nconsole.log(isValid(s).toString());\n`,
      python: `\nimport sys\n${userCode}\ns = sys.stdin.read().strip()\nif s.startswith('"') and s.endswith('"'):\n    s = s[1:-1]\nsol = Solution()\nprint(str(sol.isValid(s)).lower())\n`,
      cpp: `\n#include <iostream>\n#include <string>\nusing namespace std;\n${userCode}\nint main() {\n    string s;\n    if (cin >> s) {\n        if (s.front() == '"' && s.back() == '"') s = s.substr(1, s.length() - 2);\n        Solution sol;\n        cout << (sol.isValid(s) ? "true" : "false") << endl;\n    }\n    return 0;\n}\n`,
      java: `\nimport java.util.*;\n${userCode}\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNext()) {\n            String s = sc.next();\n            if (s.startsWith("\\"") && s.endsWith("\\"")) s = s.substring(1, s.length() - 1);\n            Solution sol = new Solution();\n            System.out.println(sol.isValid(s) ? "true" : "false");\n        }\n    }\n}\n`
    };
    return drivers[language] || userCode;
  }

  return userCode;
};

const executeInJudge0 = async (sourceCode, languageId, stdin) => {
  const apiUrl = process.env.JUDGE0_API_URL || 'https://ce.judge0.com';
  const apiKey = process.env.JUDGE0_API_KEY;
  const isRapidAPI = process.env.JUDGE0_IS_RAPIDAPI === 'true';

  console.log(`[Judge0] Using API URL: ${apiUrl}`);
  console.log(`[Judge0] Is RapidAPI: ${isRapidAPI}`);
  console.log(`[Judge0] Language ID: ${languageId}`);

  const headers = { 'content-type': 'application/json' };
  if (isRapidAPI && apiKey) {
    headers['X-RapidAPI-Key'] = apiKey;
    headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
  }

  const payload = {
    source_code: toBase64(sourceCode),
    language_id: languageId,
    stdin: toBase64(stdin)
  };

  console.log(`[Judge0] Request Payload:`, {
    ...payload,
    source_code: payload.source_code.substring(0, 50) + '...',
    stdin: payload.stdin
  });

  const startTime = Date.now();

  try {
    // Attempt standard synchronous run (with a 15-second timeout)
    console.log(`[Judge0] Attempting synchronous submission with wait=true...`);
    const response = await axios.post(`${apiUrl}/submissions?base64_encoded=true&wait=true`, {
      source_code: toBase64(sourceCode),
      language_id: languageId,
      stdin: toBase64(stdin)
    }, { headers, timeout: 15000 });

    const elapsed = Date.now() - startTime;
    console.log(`[Judge0] Synchronous submission succeeded in ${elapsed}ms`);
    console.log(`[Judge0] Response Status:`, response.data.status);
    console.log(`[Judge0] Response:`, {
      status: response.data.status,
      stdout: response.data.stdout ? fromBase64(response.data.stdout).substring(0, 100) : null,
      stderr: response.data.stderr ? fromBase64(response.data.stderr).substring(0, 100) : null,
      compile_output: response.data.compile_output ? fromBase64(response.data.compile_output).substring(0, 100) : null,
      time: response.data.time,
      memory: response.data.memory
    });

    return response.data;
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.warn(`[Judge0] Synchronous submission failed after ${elapsed}ms:`, err.message);
    console.warn(`[Judge0] Error Response Status:`, err.response?.status);
    console.warn(`[Judge0] Error Response Data:`, JSON.stringify(err.response?.data, null, 2));
    console.warn(`[Judge0] Attempting fallback async polling...`);

    try {
      // Async fallback with polling (with a 10-second submit timeout)
      const submitStartTime = Date.now();
      const submitRes = await axios.post(`${apiUrl}/submissions?base64_encoded=true`, {
        source_code: toBase64(sourceCode),
        language_id: languageId,
        stdin: toBase64(stdin)
      }, { headers, timeout: 10000 });

      const submitElapsed = Date.now() - submitStartTime;
      console.log(`[Judge0] Async submission succeeded in ${submitElapsed}ms`);

      const token = submitRes?.data?.token;
      if (!token) {
        throw new Error('Failed to retrieve submission token from Judge0.');
      }

      console.log(`[Judge0] Submission token: ${token}`);

      // Poll for results (up to 10 attempts, 2 seconds apart = 20 seconds max)
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const pollStartTime = Date.now();
        const statusRes = await axios.get(`${apiUrl}/submissions/${token}?base64_encoded=true`, { headers, timeout: 5000 });
        const pollElapsed = Date.now() - pollStartTime;

        console.log(`[Judge0] Poll attempt ${i + 1}/10 in ${pollElapsed}ms - Status ID: ${statusRes?.data?.status?.id}`);

        if (statusRes?.data?.status?.id > 2) {
          const totalElapsed = Date.now() - startTime;
          console.log(`[Judge0] Execution completed in ${totalElapsed}ms`);
          console.log(`[Judge0] Final Response:`, {
            status: statusRes.data.status,
            stdout: statusRes.data.stdout ? fromBase64(statusRes.data.stdout).substring(0, 100) : null,
            stderr: statusRes.data.stderr ? fromBase64(statusRes.data.stderr).substring(0, 100) : null,
            time: statusRes.data.time,
            memory: statusRes.data.memory
          });
          return statusRes.data;
        }
      }

      throw new Error('Code execution timed out after multiple polling attempts.');
    } catch (fallbackErr) {
      console.error(`[Judge0] Fallback execution failed:`, fallbackErr.message);
      console.error(`[Judge0] Fallback Error Response:`, JSON.stringify(fallbackErr.response?.data, null, 2));
      throw new Error(fallbackErr.message || 'Judge0 execution failed.');
    }
  }
};

// @desc    Run Code against public test case
// @route   POST /api/execution/run
// @access  Private
export const runCode = async (req, res) => {
  const { code, language, customInput, problemId } = req.body;

  try {
    if (!code || !language) return res.status(400).json({ message: 'Code and language are required' });

    const langId = LANGUAGE_IDS[language.toLowerCase()];
    if (!langId) return res.status(400).json({ message: `Unsupported language: ${language}` });

    let stdin = customInput || '';
    let finalCode = code;

    if (problemId) {
      const problem = await Problem.findByPk(problemId);
      if (problem) {
        finalCode = getDriverCode(problem.slug, language, code);
        if (!customInput && problem.testCases?.length > 0) {
          stdin = problem.testCases[0].input;
        }
      }
    }

    const result = await executeInJudge0(finalCode, langId, stdin);

    return res.json({
      status: result.status,
      stdout: result.stdout ? fromBase64(result.stdout) : '',
      stderr: result.stderr ? fromBase64(result.stderr) : '',
      compile_output: result.compile_output ? fromBase64(result.compile_output) : '',
      time: result.time,
      memory: result.memory
    });
  } catch (err) {
    console.log("===== JUDGE0 ERROR =====");
    console.log("STATUS:", err.response?.status);
    console.log("DATA:", JSON.stringify(err.response?.data, null, 2));
    console.log("========================");
    return res.status(500).json({ message: err.message || 'Execution failed' });
  }
};

// @desc    Submit solution and verify against all test cases
// @route   POST /api/execution/submit
// @access  Private
export const submitCode = async (req, res) => {
  const { code, language, problemId, roomName, timeSpentSeconds } = req.body;

  try {
    if (!code || !language || !problemId) {
      return res.status(400).json({ message: 'Code, language, and problemId are required' });
    }

    const problem = await Problem.findByPk(problemId);
    if (!problem) return res.status(404).json({ message: 'Problem not found' });

    const langId = LANGUAGE_IDS[language.toLowerCase()];
    if (!langId) return res.status(400).json({ message: `Unsupported language: ${language}` });

    const finalCode = getDriverCode(problem.slug, language, code);
    const testCases = problem.testCases;

    let allPassed = true;
    let failedTestCase = null;
    let lastResult = null;

    for (let idx = 0; idx < testCases.length; idx++) {
      const tc = testCases[idx];
      const result = await executeInJudge0(finalCode, langId, tc.input);

      const stdout = result.stdout ? fromBase64(result.stdout).trim() : '';
      const expected = tc.expectedOutput.trim();
      const isAccepted = result.status.id === 3;
      const outputMatches = stdout === expected || stdout.replace(/\s+/g, '') === expected.replace(/\s+/g, '');

      lastResult = {
        status: result.status,
        stdout,
        stderr: result.stderr ? fromBase64(result.stderr) : '',
        compile_output: result.compile_output ? fromBase64(result.compile_output) : '',
        time: result.time,
        memory: result.memory
      };

      if (!isAccepted || !outputMatches) {
        allPassed = false;
        failedTestCase = {
          testCaseNumber: idx + 1,
          input: tc.isPrivate ? '[Hidden Test Case]' : tc.input,
          expectedOutput: tc.isPrivate ? '[Hidden Test Case]' : tc.expectedOutput,
          actualOutput: stdout || 'No output',
          status: !isAccepted ? result.status.description : 'Wrong Answer'
        };
        break;
      }
    }

    if (allPassed) {
      const user = await User.findByPk(req.user.id);
      if (user) {
        const updates = { problemsSolved: user.problemsSolved + 1 };
        if (problem.difficulty === 'easy') updates.easySolved = user.easySolved + 1;
        else if (problem.difficulty === 'medium') updates.mediumSolved = user.mediumSolved + 1;
        else if (problem.difficulty === 'hard') updates.hardSolved = user.hardSolved + 1;
        if (timeSpentSeconds) updates.timeSpentCoding = user.timeSpentCoding + parseInt(timeSpentSeconds);
        await user.update(updates);
      }

      await Session.create({
        userId: req.user.id,
        roomName: roomName || 'Solo Workspace',
        problemSolvedId: problem.id,
        languageUsed: language.toLowerCase(),
        timeSpentSeconds: timeSpentSeconds || 0
      });
    }

    return res.json({ success: allPassed, failedTestCase, lastResult });
  } catch (error) {
    console.error('submitCode error:', error.message);
    return res.status(500).json({ message: 'Error submitting solution: ' + error.message });
  }
};
