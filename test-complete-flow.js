const https = require('https');

async function testCompleteFlow() {
  console.log('🧪 Testing Complete Registration/Login Flow\n');

  // Test 1: Check if register.html is accessible
  console.log('1️⃣ Testing register.html accessibility...');
  const registerCheck = await checkPage('/register.html');
  console.log(`   ✅ register.html: ${registerCheck.status} ${registerCheck.statusText}`);

  // Test 2: Check if dashboard.html is accessible
  console.log('\n2️⃣ Testing dashboard.html accessibility...');
  const dashboardCheck = await checkPage('/dashboard.html');
  console.log(`   ✅ dashboard.html: ${dashboardCheck.status} ${dashboardCheck.statusText}`);

  // Test 3: Check if register.js is accessible
  console.log('\n3️⃣ Testing register.js accessibility...');
  const jsCheck = await checkPage('/register.js');
  console.log(`   ✅ register.js: ${jsCheck.status} ${jsCheck.statusText}`);

  // Test 4: Test login flow
  console.log('\n4️⃣ Testing login endpoint...');
  const loginData = JSON.stringify({
    email: 'keithrivas@gmail.com',
    password: '70%qe6izpQ&e17Fg1IHQ'
  });

  const loginResult = await makeRequest('/api/auth/login', 'POST', loginData);
  if (loginResult.success) {
    console.log('   ✅ Login successful!');
    console.log('   Token:', loginResult.data.token);
    console.log('   User ID:', loginResult.data.userId);
    console.log('   Email:', loginResult.data.user.email);
    
    console.log('\n5️⃣ Expected flow:');
    console.log('   1. User goes to https://federated-memory-production.up.railway.app/register.html');
    console.log('   2. Clicks "Login" tab');
    console.log('   3. Enters email and password');
    console.log('   4. Sees success message');
    console.log('   5. After 2 seconds, redirects to /dashboard.html');
    console.log('   6. Dashboard shows:');
    console.log('      - Token: ' + loginResult.data.token);
    console.log('      - API URL: https://federated-memory-production.up.railway.app');
    console.log('      - MCP URL: https://federated-memory-production.up.railway.app/' + loginResult.data.token);
  } else {
    console.log('   ❌ Login failed:', loginResult.error);
  }

  console.log('\n✨ Direct URLs:');
  console.log('   Login Page: https://federated-memory-production.up.railway.app/register.html');
  console.log('   Dashboard: https://federated-memory-production.up.railway.app/dashboard.html');
}

function checkPage(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'federated-memory-production.up.railway.app',
      port: 443,
      path: path,
      method: 'HEAD'
    };

    https.request(options, (res) => {
      resolve({
        status: res.statusCode,
        statusText: res.statusCode === 200 ? 'OK' : 'Not Found'
      });
    }).end();
  });
}

function makeRequest(path, method, data) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'federated-memory-production.up.railway.app',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Origin': 'https://federated-memory-production.up.railway.app'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            success: res.statusCode === 200,
            data: parsed,
            error: parsed.error
          });
        } catch (e) {
          resolve({
            success: false,
            error: 'Failed to parse response'
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        success: false,
        error: e.message
      });
    });

    req.write(data);
    req.end();
  });
}

testCompleteFlow().catch(console.error);