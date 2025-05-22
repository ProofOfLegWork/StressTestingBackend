import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
};

// Endpoints to test with expected status codes
const endpointsToTest = [
  // Port 80
  { url: 'http://localhost/api-docs/', expectedStatus: 200, name: 'API Documentation (Port 80)' },
  { url: 'http://localhost/api/wallet/1001/balance', expectedStatus: 200, name: 'Wallet Balance (Port 80)' },
  
  // Port 3000
  { url: 'http://localhost:3000/api-docs/', expectedStatus: 200, name: 'API Documentation (Port 3000)' },
  { url: 'http://localhost:3000/api/wallet/1001/balance', expectedStatus: 200, name: 'Wallet Balance (Port 3000)' },
  
  // Port 3500
  { url: 'http://localhost:3500/api-docs/', expectedStatus: 200, name: 'API Documentation (Port 3500)' },
  { url: 'http://localhost:3500/api/wallet/1001/balance', expectedStatus: 200, name: 'Wallet Balance (Port 3500)' },
  
  // Docker host
  { url: 'http://host.docker.internal/api-docs/', expectedStatus: 200, name: 'API Documentation (Docker Host Port 80)' },
  { url: 'http://host.docker.internal:3000/api-docs/', expectedStatus: 200, name: 'API Documentation (Docker Host Port 3000)' },
  { url: 'http://host.docker.internal:3500/api-docs/', expectedStatus: 200, name: 'API Documentation (Docker Host Port 3500)' },
];

export default function() {
  console.log('Testing API endpoints on multiple ports...');

  for (const endpoint of endpointsToTest) {
    try {
      console.log(`Testing: ${endpoint.name} - ${endpoint.url}`);
      const response = http.get(endpoint.url, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: '3s'  // Short timeout to avoid waiting too long
      });
      
      const checkResult = check(response, {
        [`${endpoint.name} returns status`]: (r) => r.status !== 0,
      });
      
      if (checkResult) {
        console.log(`✅ CONNECTED: ${endpoint.name} - Status: ${response.status}`);
        if (response.status === endpoint.expectedStatus) {
          console.log(`✅ SUCCESS: Expected ${endpoint.expectedStatus}, Got: ${response.status}`);
        } else {
          console.log(`⚠️ WARNING: Expected ${endpoint.expectedStatus}, Got: ${response.status}`);
        }
        
        if (response.body) {
          console.log(`Response preview: ${response.body.substring(0, 100)}...`);
        }
      } else {
        console.log(`❌ FAILED: ${endpoint.name} - Connection failed`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${endpoint.name} - ${error.message}`);
    }
    
    sleep(1);
  }
  
  console.log('Endpoint testing completed');
} 