import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const failRate = new Rate('wallet_failed_requests');
const walletBalanceLatency = new Trend('wallet_balance_latency');
const walletTransactionLatency = new Trend('wallet_transaction_latency');

// API Configuration - Updated to correct endpoint
const BASE_URL = 'http://localhost:3500';
const API_PATH = '/api/wallet';

// Test data - sample wallet IDs 
// In a real scenario, these would be actual wallet IDs from your system
const walletIds = new SharedArray('walletIds', function() {
  return [
    '1001', '1002', '1003', '1004', '1005',
    '1006', '1007', '1008', '1009', '1010'
  ];
});

// Test configuration from env vars or with defaults
export const options = {
  scenarios: {
    wallet_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },  // Ramp up to 100 users
        { duration: '1m', target: 100 },   // Stay at 100 users
        { duration: '30s', target: 0 },    // Ramp down to 0 users
      ],
    },
  },
  thresholds: {
    'wallet_balance_latency': ['p(95)<500'],  // 95% of balance requests should be below 500ms
    'wallet_transaction_latency': ['p(95)<1000'],  // 95% of transaction requests should be below 1000ms
    'wallet_failed_requests': ['rate<0.1'],   // Less than 10% of requests should fail
    'http_req_duration': ['p(95)<1000'],      // 95% of all requests should be below 1000ms
  },
};

// Wallet API helper functions
function getRandomWalletId() {
  return walletIds[randomIntBetween(0, walletIds.length - 1)];
}

function getWalletBalance(walletId) {
  const url = `${BASE_URL}${API_PATH}/${walletId}/balance`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token' // Replace with actual auth if needed
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
    'wallet balance response has balance field': (r) => r.json().hasOwnProperty('balance'),
  });
  
  if (!success) {
    failRate.add(1);
    console.log(`Failed to get wallet balance for ID ${walletId}. Status: ${response.status}`);
  } else {
    failRate.add(0);
  }
  
  return response;
}

function getWalletTransactions(walletId, limit = 10) {
  const url = `${BASE_URL}${API_PATH}/${walletId}/transactions?limit=${limit}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token' // Replace with actual auth if needed
    }
  };

  const startTime = new Date();
  const response = http.get(url, params);
  const endTime = new Date();
  
  // Record custom metrics
  walletTransactionLatency.add(endTime - startTime);
  
  // Check if request was successful
  const success = check(response, {
    'wallet transactions status is 200': (r) => r.status === 200,
    'wallet transactions response has items': (r) => r.json().hasOwnProperty('transactions'),
  });
  
  if (!success) {
    failRate.add(1);
    console.log(`Failed to get wallet transactions for ID ${walletId}. Status: ${response.status}`);
  } else {
    failRate.add(0);
  }
  
  return response;
}

function createWalletTransaction(walletId, amount, type = 'deposit') {
  const url = `${BASE_URL}${API_PATH}/${walletId}/transaction`;
  const payload = JSON.stringify({
    amount: amount,
    type: type,
    description: `Stress test ${type} of ${amount}`
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token' // Replace with actual auth if needed
    }
  };

  const startTime = new Date();
  const response = http.post(url, payload, params);
  const endTime = new Date();
  
  // Record custom metrics
  walletTransactionLatency.add(endTime - startTime);
  
  // Check if request was successful
  const success = check(response, {
    'wallet transaction status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'wallet transaction response has transaction ID': (r) => r.json().hasOwnProperty('transactionId'),
  });
  
  if (!success) {
    failRate.add(1);
    console.log(`Failed to create wallet transaction for ID ${walletId}. Status: ${response.status}`);
  } else {
    failRate.add(0);
  }
  
  return response;
}

// Main test function
export default function() {
  const walletId = getRandomWalletId();
  
  group('Wallet Balance Check', function() {
    getWalletBalance(walletId);
  });
  
  sleep(0.5);
  
  group('Wallet Transactions History', function() {
    getWalletTransactions(walletId, 5);
  });
  
  sleep(0.5);
  
  group('Wallet Transaction Creation', function() {
    // 70% deposit, 30% withdraw
    const transactionType = Math.random() < 0.7 ? 'deposit' : 'withdraw';
    const amount = randomIntBetween(10, 1000);
    createWalletTransaction(walletId, amount, transactionType);
  });
  
  // Wait between user actions
  sleep(randomIntBetween(1, 3));
} 