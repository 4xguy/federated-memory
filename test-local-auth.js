const http = require('http');

const LOCAL_URL = 'http://localhost:3002';

async function testLocalAuth() {
  console.log('🔍 Testing Local Authentication Endpoints...');
  
  const tests = [
    {
      name: 'Health Check',
      path: '/api/health',
      method: 'GET'
    },
    {
      name: 'Login Endpoint',
      path: '/api/auth/login',
      method: 'POST',
      data: {
        email: 'test@example.com',
        password: 'testpassword123'
      }
    },
    {
      name: 'Register Endpoint',
      path: '/api/auth/register-email',
      method: 'POST',
      data: {
        email: 'newuser@example.com',
        password: 'newpassword123',
        name: 'Test User'
      }
    },
    {
      name: 'Emergency Login',
      path: '/api/auth/emergency-login',
      method: 'POST',
      data: {
        email: 'emergency@example.com'
      }
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\n📡 Testing ${test.name}...`);
      
      const options = {
        hostname: 'localhost',
        port: 3002,
        path: test.path,
        method: test.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      const response = await new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              data: data
            });
          });
        });

        req.on('error', reject);
        
        if (test.data) {
          req.write(JSON.stringify(test.data));
        }
        
        req.end();
      });

      console.log(`✅ ${test.name}: ${response.statusCode}`);
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        try {
          const json = JSON.parse(response.data);
          console.log(`   Success: ${JSON.stringify(json).substring(0, 150)}...`);
        } catch (e) {
          console.log(`   Response: ${response.data.substring(0, 100)}...`);
        }
      } else {
        try {
          const json = JSON.parse(response.data);
          console.log(`   Error: ${JSON.stringify(json)}`);
        } catch (e) {
          console.log(`   Error: ${response.data}`);
        }
      }

    } catch (error) {
      console.log(`❌ ${test.name} failed: ${error.message}`);
    }
  }
}

testLocalAuth(); 