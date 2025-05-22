import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,
};

// Endpoints to test with expected status codes
const endpointsToTest = [
  { url: 'http://localhost/api-docs/', expectedStatus: 200, name: 'API Documentation' },
  { url: 'http://localhost/api/wallet/1001/balance', expectedStatus: 200, name: 'Wallet Balance' },
  { url: 'http://localhost/api/wallet/1001/transactions', expectedStatus: 200, name: 'Wallet Transactions' },
  { url: 'http://host.docker.internal/api-docs/', expectedStatus: 200, name: 'API Documentation (Docker)' },
  { url: 'http://host.docker.internal/api/wallet/1001/balance', expectedStatus: 200, name: 'Wallet Balance (Docker)' },
  { url: 'http://host.docker.internal/api/wallet/1001/transactions', expectedStatus: 200, name: 'Wallet Transactions (Docker)' },
];

export default function() {
  console.log('Testing API endpoints...');

  for (const endpoint of endpointsToTest) {
    try {
      console.log(`Testing: ${endpoint.name} - ${endpoint.url}`);
      const response = http.get(endpoint.url, {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const checkResult = check(response, {
        [`${endpoint.name} returns ${endpoint.expectedStatus}`]: (r) => r.status === endpoint.expectedStatus,
      });
      
      if (checkResult) {
        console.log(`✅ SUCCESS: ${endpoint.name} - Status: ${response.status}`);
      } else {
        console.log(`❌ FAILED: ${endpoint.name} - Expected: ${endpoint.expectedStatus}, Got: ${response.status}`);
        if (response.status !== 0) {
          console.log(`Response body: ${response.body.substring(0, 200)}...`);
        } else {
          console.log('No response received. Check if the endpoint exists and is accessible.');
        }
      }
    } catch (error) {
      console.log(`❌ ERROR: ${endpoint.name} - ${error.message}`);
    }
    
    sleep(1);
  }
  
  console.log('Endpoint testing completed');
} 