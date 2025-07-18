const https = require('https');

// Test login endpoint
const testLogin = async () => {
  const data = JSON.stringify({
    email: 'keithrivas@gmail.com',
    password: '70%qe6izpQ&e17Fg1IHQ'
  });

  const options = {
    hostname: 'federated-memory-production.up.railway.app',
    port: 443,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
      'Origin': 'https://charming-mercy-production.up.railway.app'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Headers:', res.headers);
        console.log('Response:', responseData);
        
        if (res.statusCode !== 200) {
          console.log('\n❌ Login failed with status:', res.statusCode);
        }
        
        resolve();
      });
    });
    
    req.on('error', (e) => {
      console.error('Request error:', e);
      reject(e);
    });
    
    req.write(data);
    req.end();
  });
};

// Test if user exists
const checkUser = async () => {
  const options = {
    hostname: 'federated-memory-production.up.railway.app',
    port: 443,
    path: '/api/health',
    method: 'GET'
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('\n📡 Health check:');
        console.log('Status:', res.statusCode);
        console.log('Response:', responseData);
        resolve();
      });
    });
    
    req.on('error', (e) => {
      console.error('Health check error:', e);
      reject(e);
    });
    
    req.end();
  });
};

async function main() {
  console.log('🔍 Checking production server...\n');
  
  // First check health
  await checkUser();
  
  console.log('\n🔐 Testing login...\n');
  await testLogin();
  
  console.log('\n\nPossible issues to check:');
  console.log('1. Database connection on production (DATABASE_URL)');
  console.log('2. User might not exist in production database');
  console.log('3. JWT_SECRET might be different in production');
  console.log('4. Email service configuration (SMTP settings)');
  console.log('5. Check Railway logs for the actual error');
}

main().catch(console.error);