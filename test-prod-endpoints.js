const https = require('https');

// Test production endpoints
const PRODUCTION_URL = 'https://federated-memory-production.up.railway.app';

async function testProductionEndpoints() {
  console.log('🔍 Testing Production Endpoints...');
  
  const endpoints = [
    { path: '/api/health', name: 'Health Check' },
    { path: '/health', name: 'Root Health' },
    { path: '/', name: 'Root Endpoint' },
    { path: '/api/auth/login', name: 'Login Endpoint', method: 'POST' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n📡 Testing ${endpoint.name}...`);
      
      const options = {
        hostname: 'federated-memory-production.up.railway.app',
        port: 443,
        path: endpoint.path,
        method: endpoint.method || 'GET',
        headers: {
          'User-Agent': 'Federated-Memory-Test/1.0',
          'Accept': 'application/json'
        }
      };

      if (endpoint.method === 'POST') {
        options.headers['Content-Type'] = 'application/json';
      }

      const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
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
        
        if (endpoint.method === 'POST') {
          req.write(JSON.stringify({
            email: 'test@example.com',
            password: 'testpassword'
          }));
        }
        
        req.end();
      });

      console.log(`✅ ${endpoint.name}: ${response.statusCode}`);
      if (response.statusCode === 200) {
        try {
          const json = JSON.parse(response.data);
          console.log(`   Response: ${JSON.stringify(json).substring(0, 100)}...`);
        } catch (e) {
          console.log(`   Response: ${response.data.substring(0, 100)}...`);
        }
      } else {
        console.log(`   Error: ${response.data.substring(0, 200)}`);
      }

    } catch (error) {
      console.log(`❌ ${endpoint.name} failed: ${error.message}`);
    }
  }
}

testProductionEndpoints(); 