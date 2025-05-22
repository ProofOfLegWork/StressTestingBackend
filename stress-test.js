import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import config from './config.js';

// Custom metrics
const errorRate = new Rate('errors');
const rateLimitRate = new Rate('rate_limits'); // Track rate limiting specifically

// Get scenario from environment or default to 'smoke'
const selectedScenario = __ENV.SCENARIO || 'smoke';

// Test configuration
export const options = {
  scenarios: {
    default: config.scenarios[selectedScenario]
  },
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests should be below 500ms
    'errors': ['rate<0.1'],             // Error rate should be below 10%
    'rate_limits': ['rate<0.05'],       // Rate limiting threshold
  },
};

// Test setup
const BASE_URL = __ENV.HOSTNAME ? 'http://host.docker.internal' : 'http://localhost';
const API_PATH = '/api';

// Helper function to check for rate limiting
function checkRateLimit(response) {
  // Check for standard rate limiting response code
  if (response.status === 429) {
    console.log(`Rate limit detected: ${response.status} ${response.body}`);
    rateLimitRate.add(1);
    return true;
  }
  
  // Check for nginx rate limiting headers
  if (response.headers['X-RateLimit-Remaining'] === '0' || 
      response.headers['x-ratelimit-remaining'] === '0') {
    console.log('Nginx rate limit detected through headers');
    rateLimitRate.add(1);
    return true;
  }

  // No rate limiting detected
  rateLimitRate.add(0);
  return false;
}

// Test scenarios
export default function() {
  // Test 1: Wallet Creation API
  const walletPayload = JSON.stringify({
    publicKey: `stress-test-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    coins: Math.floor(Math.random() * 1000)
  });
  
  const createWallet = http.post(`${BASE_URL}${API_PATH}/wallet/create`, walletPayload, {
    headers: {
      'Content-Type': 'application/json',
      'accept': '*/*',
      'x-internal-testing': 'true'
    }
  });
  
  // Check for rate limiting
  const createWalletRateLimited = checkRateLimit(createWallet);
  
  check(createWallet, {
    'create wallet status is 200 or 201': (r) => r.status === 200 || r.status === 201 || createWalletRateLimited,
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

  // Short sleep between requests
  sleep(0.5);

  // Test 2: Add Coins to Wallet
  const addCoinsPayload = JSON.stringify({
    walletId: walletId,
    amount: 500
  });
  
  const addCoins = http.post(`${BASE_URL}${API_PATH}/add-coins`, addCoinsPayload, {
    headers: {
      'Content-Type': 'application/json',
      'accept': '*/*',
      'x-internal-testing': 'true'
    }
  });
  
  // Check for rate limiting
  const addCoinsRateLimited = checkRateLimit(addCoins);
  
  check(addCoins, {
    'add coins status is 200 or 201': (r) => r.status === 200 || r.status === 201 || addCoinsRateLimited,
  });

  // Short sleep between requests
  sleep(0.5);

  // Test 3: Update Coins in Wallet
  const updateCoinsPayload = JSON.stringify({
    walletId: walletId,
    amount: 1000
  });
  
  const updateCoins = http.post(`${BASE_URL}${API_PATH}/wallet/update-coins`, updateCoinsPayload, {
    headers: {
      'Content-Type': 'application/json',
      'accept': '*/*',
      'x-internal-testing': 'true'
    }
  });
  
  // Check for rate limiting
  const updateCoinsRateLimited = checkRateLimit(updateCoins);
  
  check(updateCoins, {
    'update coins status is 200 or 201': (r) => r.status === 200 || r.status === 201 || updateCoinsRateLimited,
  });

  // Add sleep between iterations to prevent overwhelming the server
  sleep(1);
} 