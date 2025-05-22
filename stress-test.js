import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },  // Ramp up to 50 users
    { duration: '3m', target: 50 },  // Stay at 50 users for 3 minutes
    { duration: '1m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests should be below 500ms
    'errors': ['rate<0.1'],             // Error rate should be below 10%
  },
};

// Test setup
const BASE_URL = __ENV.HOSTNAME ? 'http://host.docker.internal' : 'http://localhost';
const API_PATH = '/api';

// Test scenarios
export default function() {
  // Test 1: Health Check
  const healthCheck = http.get(`${BASE_URL}/health`);
  check(healthCheck, {
    'health check status is 200': (r) => r.status === 200,
  });

  // Test 2: API Documentation
  const apiDocs = http.get(`${BASE_URL}/api-docs/`);
  check(apiDocs, {
    'api docs status is 200': (r) => r.status === 200,
  });

  // Test 3: Wallet Creation API
  const walletPayload = JSON.stringify({
    publicKey: `stress-test-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    coins: Math.floor(Math.random() * 1000)
  });
  
  const createWallet = http.post(`${BASE_URL}${API_PATH}/wallet/create`, walletPayload, {
    headers: {
      'Content-Type': 'application/json',
      'accept': '*/*'
    }
  });
  
  check(createWallet, {
    'create wallet status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });
  
  // If wallet creation was successful, get the wallet ID
  let walletId = '1001';  // Default wallet ID if creation fails
  if (createWallet.status === 200 || createWallet.status === 201) {
    try {
      const walletResponse = JSON.parse(createWallet.body);
      walletId = walletResponse.walletId || walletResponse.id || walletId;
    } catch (e) {
      console.log(`Error parsing wallet creation response: ${e.message}`);
    }
  }

  // Test 4: Wallet Balance API
  const walletBalance = http.get(`${BASE_URL}${API_PATH}/wallet/${walletId}/balance`, {
    headers: {
      'Content-Type': 'application/json',
      'accept': '*/*'
    }
  });
  check(walletBalance, {
    'wallet balance status is 200': (r) => r.status === 200,
  });

  // Test 5: Wallet Transactions API
  const walletTransactions = http.get(`${BASE_URL}${API_PATH}/wallet/${walletId}/transactions?limit=5`, {
    headers: {
      'Content-Type': 'application/json',
      'accept': '*/*'
    }
  });
  check(walletTransactions, {
    'wallet transactions status is 200': (r) => r.status === 200,
  });

  // Test 6: Create Transaction API
  const payload = JSON.stringify({
    amount: 100,
    type: 'deposit',
    description: 'Stress test transaction'
  });
  
  const createTransaction = http.post(`${BASE_URL}${API_PATH}/wallet/${walletId}/transaction`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'accept': '*/*'
    }
  });
  check(createTransaction, {
    'create transaction status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });

  // Add sleep between requests to prevent overwhelming the server
  sleep(1);
} 