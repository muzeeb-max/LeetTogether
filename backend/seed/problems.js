import dotenv from 'dotenv';
import { sequelize } from '../src/models/index.js';
import Problem from '../src/models/Problem.js';

dotenv.config();

const problems = [
  {
    title: 'Two Sum',
    difficulty: 'easy',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return *indices of the two numbers such that they add up to \`target\`*.

You may assume that each input would have ***exactly* one solution**, and you may not use the *same* element twice.

You can return the answer in any order.`,
    examples: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        output: '[0,1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].'
      },
      {
        input: 'nums = [3,2,4], target = 6',
        output: '[1,2]'
      }
    ],
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.'
    ],
    starterCode: [
      {
        language: 'javascript',
        code: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
    // Write your code here
    
}`
      },
      {
        language: 'python',
        code: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        # Write your code here
        pass`
      },
      {
        language: 'cpp',
        code: `#include <vector>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Write your code here
        
    }
};`
      },
      {
        language: 'java',
        code: `import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your code here
        return new int[0];
    }
}`
      }
    ],
    testCases: [
      {
        input: '[2,7,11,15]\n9',
        expectedOutput: '[0,1]',
        isPrivate: false
      },
      {
        input: '[3,2,4]\n6',
        expectedOutput: '[1,2]',
        isPrivate: false
      },
      {
        input: '[3,3]\n6',
        expectedOutput: '[0,1]',
        isPrivate: true
      }
    ]
  },
  {
    title: 'Palindrome Number',
    difficulty: 'easy',
    description: `Given an integer \`x\`, return \`true\` *if \`x\` is a palindrome, and \`false\` otherwise*.

An integer is a **palindrome** when it reads the same backward as forward. For example, \`121\` is palindrome while \`123\` is not.`,
    examples: [
      {
        input: 'x = 121',
        output: 'true',
        explanation: '121 reads as 121 from left to right and from right to left.'
      },
      {
        input: 'x = -121',
        output: 'false',
        explanation: 'From left to right, it reads -121. From right to left, it becomes 121-. Therefore it is not a palindrome.'
      }
    ],
    constraints: [
      '-2^31 <= x <= 2^31 - 1'
    ],
    starterCode: [
      {
        language: 'javascript',
        code: `/**
 * @param {number} x
 * @return {boolean}
 */
function isPalindrome(x) {
    // Write your code here
    
}`
      },
      {
        language: 'python',
        code: `class Solution:
    def isPalindrome(self, x: int) -> bool:
        # Write your code here
        pass`
      },
      {
        language: 'cpp',
        code: `class Solution {
public:
    bool isPalindrome(int x) {
        // Write your code here
        
    }
};`
      },
      {
        language: 'java',
        code: `class Solution {
    public boolean isPalindrome(int x) {
        // Write your code here
        return false;
    }
}`
      }
    ],
    testCases: [
      {
        input: '121',
        expectedOutput: 'true',
        isPrivate: false
      },
      {
        input: '-121',
        expectedOutput: 'false',
        isPrivate: false
      },
      {
        input: '10',
        expectedOutput: 'false',
        isPrivate: true
      }
    ]
  },
  {
    title: 'Valid Parentheses',
    difficulty: 'medium',
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    examples: [
      {
        input: 's = "()"',
        output: 'true'
      },
      {
        input: 's = "()[]{}"',
        output: 'true'
      },
      {
        input: 's = "(]"',
        output: 'false'
      }
    ],
    constraints: [
      '1 <= s.length <= 10^4',
      's consists of parentheses only "()[]{}"'
    ],
    starterCode: [
      {
        language: 'javascript',
        code: `/**
 * @param {string} s
 * @return {boolean}
 */
function isValid(s) {
    // Write your code here
    
}`
      },
      {
        language: 'python',
        code: `class Solution:
    def isValid(self, s: str) -> bool:
        # Write your code here
        pass`
      },
      {
        language: 'cpp',
        code: `#include <string>
using namespace std;

class Solution {
public:
    bool isValid(string s) {
        // Write your code here
        
    }
};`
      },
      {
        language: 'java',
        code: `class Solution {
    public boolean isValid(String s) {
        // Write your code here
        return false;
    }
}`
      }
    ],
    testCases: [
      {
        input: '"()"',
        expectedOutput: 'true',
        isPrivate: false
      },
      {
        input: '"()[]{}"',
        expectedOutput: 'true',
        isPrivate: false
      },
      {
        input: '"(]"',
        expectedOutput: 'false',
        isPrivate: true
      }
    ]
  }
];

const seedDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL database connected for seeding.');

    // Clear existing problems
    await Problem.destroy({ where: {} });
    console.log('Existing problems deleted.');

    // Insert new seeds one by one to handle JSON properly
    for (const problem of problems) {
      await Problem.create(problem);
      console.log(`Seeded: ${problem.title}`);
    }
    console.log('Problems successfully seeded.');

    await sequelize.close();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDB();
