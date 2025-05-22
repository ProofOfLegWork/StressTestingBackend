import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import config from './config.js';

// Custom metrics
const failRate = new Rate('wallet_failed_requests');
const walletBalanceLatency = new Trend('wallet_balance_latency');
const walletCreationLatency = new Trend('wallet_creation_latency');
const walletUpdateCoinsLatency = new Trend('wallet_update_coins_latency');

// API Configuration
const BASE_URL = __ENV.HOSTNAME ? 'http://host.docker.internal' : 'http://localhost';
const API_PATH = '/api/wallet';

// Test data - sample wallet IDs 
// In a real scenario, these would be actual wallet IDs from your system
const walletIds = new SharedArray('walletIds', function() {
  return [
    '1001', '1002', '1003', '1004', '1005',
    '1006', '1007', '1008', '1009', '1010'
  ];
});

// Get scenario from environment or default to wallet_moderate
const selectedScenario = __ENV.SCENARIO || 'wallet_moderate';

// Set options based on the selected scenario
export const options = {
  scenarios: {
    default: config.scenarios[selectedScenario]
  },
  thresholds: {
    'wallet_balance_latency': ['p(95)<500'],
    'wallet_creation_latency': ['p(95)<1000'],
    'wallet_update_coins_latency': ['p(95)<1000'],
    'wallet_failed_requests': ['rate<0.1'],
    'http_req_duration': ['p(95)<1000'],
  },
};

// Wallet API helper functions
function getRandomWalletId() {
  return walletIds[randomIntBetween(0, walletIds.length - 1)];
}

// Create a new wallet
function createWallet() {
  const url = `${BASE_URL}${API_PATH}/create`;
  const payload = JSON.stringify({
    publicKey: `stress-test-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    coins: randomIntBetween(0, 1000)
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'accept': '*/*',
      'x-internal-testing': 'true'
    }
  };

  const startTime = new Date();
  const response = http.post(url, payload, params);
  const endTime = new Date();
  
  // Record custom metrics
  walletCreationLatency.add(endTime - startTime);
  
  // Check if request was successful
  const success = check(response, {
    'wallet creation status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'wallet creation response has walletId': (r) => {
      try {
        const body = r.json();
        return body && (body.walletId || body.id);
      } catch (e) {
        console.log(`Failed to parse wallet creation response: ${e.message}`);
        return false;
      }
    },
  });
  
  if (!success) {
    failRate.add(1);
    console.log(`Failed to create wallet. Status: ${response.status}, Response: ${response.body}`);
  } else {
    failRate.add(0);
    try {
      const walletData = response.json();
      console.log(`Created wallet with ID: ${walletData.walletId || walletData.id}`);
      return walletData.walletId || walletData.id;
    } catch (e) {
      console.log(`Failed to parse wallet data: ${e.message}`);
      return null;
    }
  }
  
  return null;
}

function getWalletBalance(walletId) {
  const url = `${BASE_URL}${API_PATH}/${walletId}/balance`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'accept': '*/*',
      'x-internal-testing': 'true'
    }
  };

  const startTime = new Date();
  const response = http.get(url, params);
  const endTime = new Date();
  
  // Record custom metrics
  walletBalanceLatency.add(endTime - startTime);
  
  // Check if request was successful
  const success = check(response, {
    'wallet balance status is 200': (r) => r.status === 200,
    'wallet balance response has balance field': (r) => {
      try {
        const body = r.json();
        return body && (body.balance !== undefined);
      } catch (e) {
        return false;
      }
    },
  });
  
  if (!success) {
    failRate.add(1);
    console.log(`Failed to get wallet balance for ID ${walletId}. Status: ${response.status}`);
  } else {
    failRate.add(0);
  }
  
  return response;
}

function updateWalletCoins(walletId, amount) {
  const url = `${BASE_URL}${API_PATH}/add-coins`;
  const payload = JSON.stringify({
    walletId: walletId,
    amount: amount
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'accept': '*/*',
      'x-internal-testing': 'true'
    }
  };

  const startTime = new Date();
  const response = http.post(url, payload, params);
  const endTime = new Date();
  
  // Record custom metrics
  walletUpdateCoinsLatency.add(endTime - startTime);
  
  // Check if request was successful
  const success = check(response, {
    'wallet update coins status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'wallet update coins response has updated balance': (r) => {
      try {
        const body = r.json();
        return body && (body.balance !== undefined);
      } catch (e) {
        return false;
      }
    },
  });
  
  if (!success) {
    failRate.add(1);
    console.log(`Failed to update coins for wallet ID ${walletId}. Status: ${response.status}`);
  } else {
    failRate.add(0);
  }
  
  return response;
}

function updateCoinsDirectly(walletId, amount) {
  const url = `${BASE_URL}${API_PATH}/update-coins`;
  const payload = JSON.stringify({
    walletId: walletId,
    amount: amount
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'accept': '*/*',
      'x-internal-testing': 'true'
    }
  };

  const startTime = new Date();
  const response = http.post(url, payload, params);
  const endTime = new Date();
  
  // Record custom metrics
  walletUpdateCoinsLatency.add(endTime - startTime);
  
  // Check if request was successful
  const success = check(response, {
    'wallet update coins direct status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'wallet update coins direct response has updated balance': (r) => {
      try {
        const body = r.json();
        return body && (body.balance !== undefined);
      } catch (e) {
        return false;
      }
    },
  });
  
  if (!success) {
    failRate.add(1);
    console.log(`Failed to directly update coins for wallet ID ${walletId}. Status: ${response.status}`);
  } else {
    failRate.add(0);
  }
  
  return response;
}

// Main test function
export default function() {
  // Test 1: Create a new wallet
  group('Wallet Creation', function() {
    const newWalletId = createWallet();
    
    // Test the new wallet if creation was successful
    if (newWalletId) {
      sleep(0.5);
      
      // Test 2: Add coins to the new wallet
      group('Add Coins to New Wallet', function() {
        const amount = randomIntBetween(10, 1000);
        updateWalletCoins(newWalletId, amount);
      });
      
      sleep(0.5);
      
      // Test 3: Update coins directly
      group('Update Coins Directly', function() {
        const amount = randomIntBetween(100, 5000);
        updateCoinsDirectly(newWalletId, amount);
      });
    }
  });
  
  // Wait between test iterations
  sleep(randomIntBetween(1, 2));
} 