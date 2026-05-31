import dotenv from 'dotenv';
dotenv.config();

import { sequelize, Problem } from '../src/models/index.js';

const problems = [
  {
    title: 'Two Sum',
    slug: 'two-sum',
    difficulty: 'easy',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return *indices of the two numbers such that they add up to \`target\`*.

You may assume that each input would have ***exactly* one solution**, and you may not use the *same* element twice.

You can return the answer in any order.`,
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]' }
    ],
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.'
    ],
    starterCode: [
      { language: 'javascript', code: `/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nfunction twoSum(nums, target) {\n    // Write your code here\n    \n}` },
      { language: 'python', code: `class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        # Write your code here\n        pass` },
      { language: 'cpp', code: `#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your code here\n        \n    }\n};` },
      { language: 'java', code: `import java.util.*;\n\nclass Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your code here\n        return new int[0];\n    }\n}` }
    ],
    testCases: [
      { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', isPrivate: false },
      { input: '[3,2,4]\n6', expectedOutput: '[1,2]', isPrivate: false },
      { input: '[3,3]\n6', expectedOutput: '[0,1]', isPrivate: true }
    ]
  },
  {
    title: 'Palindrome Number',
    slug: 'palindrome-number',
    difficulty: 'easy',
    description: `Given an integer \`x\`, return \`true\` *if \`x\` is a palindrome, and \`false\` otherwise*.

An integer is a **palindrome** when it reads the same backward as forward. For example, \`121\` is palindrome while \`123\` is not.`,
    examples: [
      { input: 'x = 121', output: 'true', explanation: '121 reads as 121 from left to right and from right to left.' },
      { input: 'x = -121', output: 'false', explanation: 'From left to right, it reads -121. From right to left, it becomes 121-. Therefore it is not a palindrome.' }
    ],
    constraints: ['-2^31 <= x <= 2^31 - 1'],
    starterCode: [
      { language: 'javascript', code: `/**\n * @param {number} x\n * @return {boolean}\n */\nfunction isPalindrome(x) {\n    // Write your code here\n    \n}` },
      { language: 'python', code: `class Solution:\n    def isPalindrome(self, x: int) -> bool:\n        # Write your code here\n        pass` },
      { language: 'cpp', code: `class Solution {\npublic:\n    bool isPalindrome(int x) {\n        // Write your code here\n        \n    }\n};` },
      { language: 'java', code: `class Solution {\n    public boolean isPalindrome(int x) {\n        // Write your code here\n        return false;\n    }\n}` }
    ],
    testCases: [
      { input: '121', expectedOutput: 'true', isPrivate: false },
      { input: '-121', expectedOutput: 'false', isPrivate: false },
      { input: '10', expectedOutput: 'false', isPrivate: true }
    ]
  },
  {
    title: 'Valid Parentheses',
    slug: 'valid-parentheses',
    difficulty: 'medium',
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    examples: [
      { input: 's = "()"', output: 'true' },
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' }
    ],
    constraints: ['1 <= s.length <= 10^4', 's consists of parentheses only "()[]{}"'],
    starterCode: [
      { language: 'javascript', code: `/**\n * @param {string} s\n * @return {boolean}\n */\nfunction isValid(s) {\n    // Write your code here\n    \n}` },
      { language: 'python', code: `class Solution:\n    def isValid(self, s: str) -> bool:\n        # Write your code here\n        pass` },
      { language: 'cpp', code: `#include <string>\nusing namespace std;\n\nclass Solution {\npublic:\n    bool isValid(string s) {\n        // Write your code here\n        \n    }\n};` },
      { language: 'java', code: `class Solution {\n    public boolean isValid(String s) {\n        // Write your code here\n        return false;\n    }\n}` }
    ],
    testCases: [
      { input: '"()"', expectedOutput: 'true', isPrivate: false },
      { input: '"()[]{}"', expectedOutput: 'true', isPrivate: false },
      { input: '"(]"', expectedOutput: 'false', isPrivate: true }
    ]
  }
];

const seedDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to MySQL for seeding...');

    // Sync tables (create if not exists)
    await sequelize.sync({ alter: true });
    console.log('Tables synchronized.');

    // Wipe existing problems
    await Problem.destroy({ where: {}, truncate: true });
    console.log('Existing problems cleared.');

    // Bulk insert
    await Problem.bulkCreate(problems);
    console.log(`Successfully seeded ${problems.length} problems into MySQL.`);

    await sequelize.close();
    console.log('Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error.message);
    process.exit(1);
  }
};

seedDB();
