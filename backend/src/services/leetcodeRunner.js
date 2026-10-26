const splitTopLevel = (text, separators = ',\n') => {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if ('[{('.includes(char)) depth += 1;
    else if (']})'.includes(char)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && separators.includes(char)) {
      const part = text.slice(start, i).trim();
      if (part) parts.push(part);
      start = i + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
};

const parseValue = (text) => {
  const value = text.trim().replace(/;$/, '');
  try { return JSON.parse(value); } catch { /* LeetCode samples sometimes use single-quoted strings. */ }
  if (/^'.*'$/.test(value)) return value.slice(1, -1).replace(/\\'/g, "'");
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value === 'True') return true;
  if (value === 'False') return false;
  if (value === 'None') return null;
  throw new Error(`Could not read testcase value: ${value}`);
};

export const parseLeetCodeArguments = (input, argumentCount) => {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('Enter a testcase input first.');
  const chunks = splitTopLevel(raw);
  const values = chunks.map((chunk) => {
    const assignment = chunk.match(/^[\w$]+\s*=\s*([\s\S]+)$/);
    return parseValue(assignment ? assignment[1] : chunk);
  });
  if (values.length === argumentCount) return values;
  if (values.length === 1 && Array.isArray(values[0]) && values[0].length === argumentCount) return values[0];
  if (argumentCount === 1 && values.length === 1) return values;
  throw new Error(`This starter expects ${argumentCount} input value${argumentCount === 1 ? '' : 's'}; the testcase has ${values.length}.`);
};

const parseSignature = (code, language) => {
  if (language === 'python') {
    const match = code.match(/\bdef\s+(\w+)\s*\(([^)]*)\)/);
    if (!match) throw new Error('Could not find a Python function in the starter code.');
    const params = match[2].split(',').map((part) => part.trim()).filter(Boolean).filter((name) => name !== 'self' && name !== 'cls');
    return { name: match[1], params, hasSolutionClass: /\bclass\s+Solution\b/.test(code) };
  }
  if (language === 'javascript' || language === 'typescript') {
    const assigned = code.match(/\b(?:var|let|const)\s+(\w+)\s*=\s*function\s*\(([^)]*)\)/)
      || code.match(/\b(?:var|let|const)\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>/);
    if (assigned) return { name: assigned[1], params: assigned[2].split(',').map((part) => part.trim()).filter(Boolean), hasSolutionClass: false };
    const fn = code.match(/\bfunction\s+(\w+)\s*\(([^)]*)\)/);
    if (fn) return { name: fn[1], params: fn[2].split(',').map((part) => part.trim()).filter(Boolean), hasSolutionClass: false };
  }
  if (language === 'go') {
    const match = code.match(/\bfunc\s+(\w+)\s*\(([^)]*)\)/);
    if (!match) throw new Error('Could not find a Go function in the starter code.');
    const params = splitTopLevel(match[2]).map((part) => part.trim()).filter(Boolean);
    return { name: match[1], params, hasSolutionClass: false };
  }
  if (language === 'rust') {
    const match = code.match(/\bfn\s+(\w+)\s*\(([^)]*)\)/);
    if (!match) throw new Error('Could not find a Rust function in the starter code.');
    const params = splitTopLevel(match[2]).map((part) => part.trim()).filter(Boolean).filter((part) => !/^(?:&self|&mut self|self)$/.test(part));
    return { name: match[1], params, hasSolutionClass: /\bimpl\s+Solution\b/.test(code), hasSelf: /\bfn\s+\w+\s*\(\s*&(?:mut\s+)?self/.test(match[0]) };
  }
  const methodPattern = language === 'csharp'
    ? /(?:public|private|protected|internal)?\s*(?:static\s+)?([\w<>?,.\[\]]+)\s+(\w+)\s*\(([^)]*)\)/m
    : /(?:public|private|protected)?\s*(?:static\s+)?([\w<>?,.\[\]]+)\s+(\w+)\s*\(([^)]*)\)/m;
  const match = code.match(methodPattern);
  if (!match) throw new Error(`Could not find a ${language} method in the starter code.`);
  const params = splitTopLevel(match[3]).map((part) => part.trim()).filter(Boolean);
  return { returnType: match[1].trim(), name: match[2], params, hasSolutionClass: /\bclass\s+Solution\b/.test(code) };
};

const parameterTypeAndName = (parameter, language) => {
  if (language === 'python' || language === 'javascript' || language === 'typescript') return { type: '', name: parameter.split(':')[0].trim() };
  if (language === 'rust') {
    const [name, ...typeParts] = parameter.split(':');
    return { name: name.trim(), type: typeParts.join(':').trim() };
  }
  if (language === 'go') {
    const match = parameter.match(/^([\w]+)\s+(.+)$/);
    return match ? { name: match[1], type: match[2].trim() } : { name: parameter, type: '' };
  }
  if (language === 'cpp') {
    const match = parameter.match(/^(.+?)(?:\s*[*&]+)?\s+([\w]+)$/);
    return match ? { name: match[2], type: match[1].trim().replace(/[&*]+$/, '').trim() } : { name: parameter, type: '' };
  }
  const match = parameter.match(/^(.+?)\s+([\w]+)$/);
  return match ? { type: match[1].trim(), name: match[2] } : { type: '', name: parameter };
};

const pyLiteral = (value) => {
  if (value === null) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (Array.isArray(value)) return `[${value.map(pyLiteral).join(', ')}]`;
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
};

const javaLiteral = (type, value) => {
  const clean = type.replace(/\s+/g, '');
  if (clean.endsWith('[]')) {
    if (!Array.isArray(value)) throw new Error(`Expected an array for ${type}.`);
    const itemType = clean.slice(0, -2);
    return `new ${itemType}[]{${value.map((item) => javaLiteral(itemType, item)).join(', ')}}`;
  }
  if (/^(?:List|ArrayList)</.test(clean)) {
    if (!Array.isArray(value)) throw new Error(`Expected a list for ${type}.`);
    const itemType = clean.match(/<(.+)>/)?.[1] || 'Object';
    return `new java.util.ArrayList<>(java.util.Arrays.asList(${value.map((item) => javaLiteral(itemType, item)).join(', ')}))`;
  }
  if (clean === 'String') return JSON.stringify(String(value ?? ''));
  if (clean === 'char') return `'${String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (clean === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' || /^-?\d+(?:\.\d+)?$/.test(String(value))) return String(value);
  throw new Error(`The Java testcase runner does not support parameter type ${type} yet.`);
};

const csharpLiteral = (type, value) => {
  const clean = type.replace(/\s+/g, '');
  if (clean.endsWith('[]')) {
    if (!Array.isArray(value)) throw new Error(`Expected an array for ${type}.`);
    const itemType = clean.slice(0, -2);
    return `new ${itemType}[] { ${value.map((item) => csharpLiteral(itemType, item)).join(', ')} }`;
  }
  if (clean === 'string') return JSON.stringify(String(value ?? ''));
  if (clean === 'bool') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  throw new Error(`The C# testcase runner does not support parameter type ${type} yet.`);
};

const cppLiteral = (type, value) => {
  const clean = type.replace(/\s+/g, '').replace(/const/g, '');
  if (/^(?:vector|std::vector)</.test(clean)) {
    if (!Array.isArray(value)) throw new Error(`Expected an array for ${type}.`);
    const itemType = clean.match(/<(.+)>/)?.[1] || 'int';
    return `std::vector<${itemType}>{${value.map((item) => cppLiteral(itemType, item)).join(', ')}}`;
  }
  if (clean === 'string' || clean === 'std::string') return JSON.stringify(String(value ?? ''));
  if (clean === 'bool') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  throw new Error(`The C++ testcase runner does not support parameter type ${type} yet.`);
};

const goLiteral = (type, value) => {
  const clean = type.replace(/\s+/g, '');
  if (clean.startsWith('[]')) {
    if (!Array.isArray(value)) throw new Error(`Expected an array for ${type}.`);
    const itemType = clean.slice(2);
    return `[]${itemType}{${value.map((item) => goLiteral(itemType, item)).join(', ')}}`;
  }
  if (clean === 'string') return JSON.stringify(String(value ?? ''));
  if (clean === 'bool') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  throw new Error(`The Go testcase runner does not support parameter type ${type} yet.`);
};

const rustLiteral = (type, value) => {
  const clean = type.replace(/\s+/g, '');
  if (clean.startsWith('Vec<')) {
    if (!Array.isArray(value)) throw new Error(`Expected an array for ${type}.`);
    const inner = clean.slice(4, -1);
    return `vec![${value.map((item) => rustLiteral(inner, item)).join(', ')}]`;
  }
  if (clean === 'String') return `String::from(${JSON.stringify(String(value ?? ''))})`;
  if (clean === 'bool') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  throw new Error(`The Rust testcase runner does not support parameter type ${type} yet.`);
};

const cppTypeForVariable = (type) => type.replace(/\s*&/g, '').replace(/^const\s+/, '').trim();

export const buildLeetCodeRunner = ({ code, language, input }) => {
  const normalizedLanguage = String(language || '').toLowerCase();
  const signature = parseSignature(code, normalizedLanguage);
  const args = parseLeetCodeArguments(input, signature.params.length);
  let sourceCode;
  let stdin = '';

  if (normalizedLanguage === 'javascript' || normalizedLanguage === 'typescript') {
    const values = JSON.stringify(args);
    const receiver = signature.hasSolutionClass ? `new Solution().${signature.name}` : signature.name;
    sourceCode = `${code}\nconst __args = JSON.parse(require('fs').readFileSync(0, 'utf8'));\nconst __result = ${receiver}(...__args);\nconsole.log(JSON.stringify(__result));\n`;
    stdin = values;
  } else if (normalizedLanguage === 'python') {
    const receiver = signature.hasSolutionClass ? `Solution().${signature.name}` : signature.name;
    sourceCode = `${code}\nimport json as __json, sys as __sys\n__args = __json.loads(__sys.stdin.read())\n__result = ${receiver}(*__args)\nprint(__json.dumps(__result))\n`;
    stdin = JSON.stringify(args);
  } else if (normalizedLanguage === 'java') {
    const params = signature.params.map((parameter) => parameterTypeAndName(parameter, normalizedLanguage));
    const values = params.map((parameter, index) => javaLiteral(parameter.type, args[index]));
    const call = `new Solution().${signature.name}(${values.join(', ')})`;
    sourceCode = `import java.util.*;\n${code}\nclass Main {\n public static void main(String[] args) {\n  Object result = ${call};\n  System.out.println(format(result));\n }\n static String format(Object value) {\n  if (value == null) return "null";\n  if (!value.getClass().isArray()) return value instanceof String ? "\\\"" + value + "\\\"" : value.toString();\n  int length = java.lang.reflect.Array.getLength(value);\n  List<String> items = new ArrayList<>();\n  for (int i=0; i<length; i++) items.add(format(java.lang.reflect.Array.get(value, i)));\n  return "[" + String.join(",", items) + "]";\n }\n}\n`;
  } else if (normalizedLanguage === 'csharp') {
    const params = signature.params.map((parameter) => parameterTypeAndName(parameter, normalizedLanguage));
    const values = params.map((parameter, index) => csharpLiteral(parameter.type, args[index]));
    const call = `new Solution().${signature.name}(${values.join(', ')})`;
    sourceCode = `using System;\nusing System.Text.Json;\n${code}\npublic class Program { public static void Main() { var result = ${call}; Console.WriteLine(JsonSerializer.Serialize(result)); } }\n`;
  } else if (normalizedLanguage === 'cpp') {
    const params = signature.params.map((parameter) => parameterTypeAndName(parameter, normalizedLanguage));
    const declarations = params.map((parameter, index) => `${cppTypeForVariable(parameter.type)} __arg${index} = ${cppLiteral(parameter.type, args[index])};`).join('\n');
    const call = `Solution __solution; auto __result = __solution.${signature.name}(${params.map((_, index) => `__arg${index}`).join(', ')});`;
    sourceCode = `#include <bits/stdc++.h>\nusing namespace std;\n${code}\ntemplate<class T> void __print(const vector<T>& v) { cout << "["; for (size_t i=0; i<v.size(); ++i) { if (i) cout << ","; __print(v[i]); } cout << "]"; }\nvoid __print(const string& s) { cout << "\\\"" << s << "\\\""; }\nvoid __print(bool b) { cout << (b ? "true" : "false"); }\ntemplate<class T> void __print(T v) { cout << v; }\nint main() { ${declarations} ${call} __print(__result); return 0; }\n`;
  } else if (normalizedLanguage === 'go') {
    const params = signature.params.map((parameter) => parameterTypeAndName(parameter, normalizedLanguage));
    const values = params.map((parameter, index) => goLiteral(parameter.type, args[index]));
    sourceCode = `package main\nimport ("encoding/json"; "fmt")\n${code}\nfunc main() { result := ${signature.name}(${values.join(', ')}); output, _ := json.Marshal(result); fmt.Println(string(output)) }\n`;
  } else if (normalizedLanguage === 'rust') {
    const params = signature.params.map((parameter) => parameterTypeAndName(parameter, normalizedLanguage));
    const values = params.map((parameter, index) => rustLiteral(parameter.type, args[index]));
    const receiver = signature.hasSolutionClass ? `Solution::${signature.name}` : signature.name;
    sourceCode = `${code}\nfn main() { let result = ${receiver}(${values.join(', ')}); println!("{:?}", result); }\n`;
  } else {
    throw new Error(`LeetCode example runs are not available for ${language}.`);
  }

  return { sourceCode, stdin, arguments: args };
};

export const normalizeRunnerOutput = (value) => String(value ?? '').trim().replace(/\s+/g, '');
