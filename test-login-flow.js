const https = require('https');

async function testLoginFlow() {
  console.log('🔍 Testing complete login flow...\n');

  // 1. Login
  const loginData = JSON.stringify({
    email: 'keithrivas@gmail.com',
    password: '70%qe6izpQ&e17Fg1IHQ'
  });

  const loginOptions = {
    hostname: 'federated-memory-production.up.railway.app',
    port: 443,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length,
      'Origin': 'https://charming-mercy-production.up.railway.app'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(loginOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('1️⃣ Login Response:');
        console.log('Status:', res.statusCode);
        const loginResponse = JSON.parse(responseData);
        console.log('Response:', JSON.stringify(loginResponse, null, 2));
        
        if (loginResponse.success) {
          console.log('\n✅ Login successful!');
          console.log('\n2️⃣ What should happen next:');
          console.log('- Frontend should store the token in localStorage/sessionStorage');
          console.log('- Frontend should redirect to /dashboard or /profile');
          console.log('- Dashboard should display:');
          console.log('  - User token:', loginResponse.token);
          console.log('  - API URL: https://federated-memory-production.up.railway.app');
          console.log('  - MCP URL: https://federated-memory-production.up.railway.app/' + loginResponse.token);
          console.log('\n3️⃣ Frontend routing suggestions:');
          console.log('- After login success: router.push("/dashboard")');
          console.log('- Dashboard should check for token in storage');
          console.log('- If no token, redirect back to login');
          
          // Test if we can access protected endpoints with the token
          console.log('\n4️⃣ Testing protected endpoint access...');
          testProtectedEndpoint(loginResponse.token);
        }
        
        resolve();
      });
    });
    
    req.on('error', (e) => {
      console.error('Request error:', e);
      reject(e);
    });
    
    req.write(loginData);
    req.end();
  });
}

function testProtectedEndpoint(token) {
  const options = {
    hostname: 'federated-memory-production.up.railway.app',
    port: 443,
    path: '/api/user/profile',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Origin': 'https://charming-mercy-production.up.railway.app'
    }
  };

  https.get(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Protected endpoint test:');
      console.log('Status:', res.statusCode);
      if (res.statusCode === 200) {
        console.log('✅ Token works for protected endpoints');
      } else {
        console.log('❌ Issue with protected endpoint access');
      }
    });
  });
}

testLoginFlow().catch(console.error);