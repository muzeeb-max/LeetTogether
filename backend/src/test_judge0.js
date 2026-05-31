import axios from 'axios';

const toBase64 = (str) => Buffer.from(str || '').toString('base64');
const fromBase64 = (b64) => Buffer.from(b64 || '', 'base64').toString('utf-8');

const test = async () => {
  const apiUrl = 'https://ce.judge0.com';
  console.log('Sending test request to:', apiUrl);
  
  try {
    const response = await axios.post(`${apiUrl}/submissions?base64_encoded=true&wait=true`, {
      source_code: toBase64('console.log("Hello, World!");'),
      language_id: 93, // JavaScript
      stdin: ''
    }, {
      headers: { 'content-type': 'application/json' }
    });
    console.log('Wait response:', response.data);
  } catch (err) {
    console.log('Wait request failed, trying fallback polling...');
    console.log('Error message:', err.message);
    console.log('Error status:', err.response?.status);
    console.log('Error data:', err.response?.data);
    
    try {
      const submitRes = await axios.post(`${apiUrl}/submissions?base64_encoded=true`, {
        source_code: toBase64('console.log("Hello, World!");'),
        language_id: 93,
        stdin: ''
      }, {
        headers: { 'content-type': 'application/json' }
      });
      console.log('Submit response:', submitRes.data);
      const token = submitRes.data.token;
      
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        console.log(`Polling attempt ${i+1}...`);
        const statusRes = await axios.get(`${apiUrl}/submissions/${token}?base64_encoded=true`, {
          headers: { 'content-type': 'application/json' }
        });
        console.log(`Status description: ${statusRes.data.status?.description} (ID: ${statusRes.data.status?.id})`);
        if (statusRes.data.status.id > 2) {
          console.log('Result:', {
            stdout: statusRes.data.stdout ? fromBase64(statusRes.data.stdout) : '',
            stderr: statusRes.data.stderr ? fromBase64(statusRes.data.stderr) : '',
            compile_output: statusRes.data.compile_output ? fromBase64(statusRes.data.compile_output) : '',
          });
          return;
        }
      }
    } catch (e2) {
      console.log('Fallback failed as well:', e2.message);
      if (e2.response) {
        console.log('Fallback error response:', e2.response.data);
      }
    }
  }
};

test();
