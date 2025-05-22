import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const failRate = new Rate('wallet_failed_requests');
const walletBalanceLatency = new Trend('wallet_balance_latency');
const walletTransactionLatency = new Trend('wallet_transaction_latency');
const walletCreationLatency = new Trend('wallet_creation_latency');

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

// Import configuration options - will be loaded from config.js
export const options = {
  // Use the predefined scenario from the config file
  scenarios: {
    wallet_test: {
      // This placeholder will be replaced by the scenario from config.js
      exec: 'default',
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },
      ],
    },
  },
  thresholds: {
    'wallet_balance_latency': ['p(95)<500'],
    'wallet_transaction_latency': ['p(95)<1000'],
    'wallet_creation_latency': ['p(95)<1000'],
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
      'accept': '*/*'
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
      'accept': '*/*'
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

function getWalletTransactions(walletId, limit = 10) {
  const url = `${BASE_URL}${API_PATH}/${walletId}/transactions?limit=${limit}`;
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'accept': '*/*'
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
    'wallet transactions response has items': (r) => {
      try {
        const body = r.json();
        return body && body.transactions;
      } catch (e) {
        return false;
      }
    },
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
      'accept': '*/*'
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
    'wallet transaction response has transaction ID': (r) => {
      try {
        const body = r.json();
        return body && (body.transactionId || body.id);
      } catch (e) {
        return false;
      }
    },
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
  // Create a new wallet 25% of the time
  if (Math.random() < 0.25) {
    group('Wallet Creation', function() {
      const newWalletId = createWallet();
      
      // Test the new wallet if creation was successful
      if (newWalletId) {
        sleep(0.5);
        
        group('New Wallet Balance Check', function() {
          getWalletBalance(newWalletId);
        });
        
        sleep(0.5);
        
        // Add a transaction to the new wallet
        group('New Wallet Transaction', function() {
          const amount = randomIntBetween(10, 1000);
          createWalletTransaction(newWalletId, amount, 'deposit');
        });
      }
    });
  } 
  // Use existing wallet IDs the rest of the time
  else {
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
  }
  
  // Wait between user actions
  sleep(randomIntBetween(1, 3));
} 