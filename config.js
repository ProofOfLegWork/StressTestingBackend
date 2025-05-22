export const scenarios = {
  smoke: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 10 },  // Ramp up to 10 users
      { duration: '1m', target: 10 },  // Stay at 10 users
      { duration: '1m', target: 0 },   // Ramp down to 0 users
    ],
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 50 },  // Ramp up to 50 users
      { duration: '5m', target: 50 },  // Stay at 50 users
      { duration: '2m', target: 0 },   // Ramp down to 0 users
    ],
  },
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 100 },  // Ramp up to 100 users
      { duration: '5m', target: 100 },  // Stay at 100 users
      { duration: '2m', target: 0 },    // Ramp down to 0 users
    ],
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 200 },  // Spike to 200 users
      { duration: '1m', target: 0 },    // Ramp down to 0 users
    ],
  },
  endurance: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '5m', target: 50 },   // Ramp up to 50 users
      { duration: '20m', target: 50 },  // Stay at 50 users for 20 minutes
      { duration: '5m', target: 0 },    // Ramp down to 0 users
    ],
  },
  soak: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '5m', target: 25 },   // Ramp up to 25 users
      { duration: '50m', target: 25 },  // Stay at 25 users for 50 minutes
      { duration: '5m', target: 0 },    // Ramp down to 0 users
    ],
  },
  
  // Wallet-specific test scenarios
  wallet_light: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 5 },   // Ramp up to 5 users
      { duration: '1m', target: 5 },    // Stay at 5 users
      { duration: '30s', target: 0 },   // Ramp down to 0 users
    ],
  },
  wallet_moderate: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 20 },  // Ramp up to 20 users
      { duration: '2m', target: 20 },   // Stay at 20 users
      { duration: '30s', target: 0 },   // Ramp down to 0 users
    ],
  },
  wallet_heavy: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 50 },   // Ramp up to 50 users
      { duration: '3m', target: 50 },   // Stay at 50 users
      { duration: '1m', target: 0 },    // Ramp down to 0 users
    ],
  },
  wallet_extreme: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 100 },  // Ramp up to 100 users
      { duration: '3m', target: 100 },  // Stay at 100 users
      { duration: '1m', target: 0 },    // Ramp down to 0 users
    ],
  },
};

export const thresholds = {
  http_req_duration: ['p(95)<500'],  // 95% of requests should be below 500ms
  http_req_failed: ['rate<0.1'],     // Error rate should be below 10%
  'http_req_duration{type:static}': ['p(95)<100'],  // Static content should be faster
  
  // Wallet-specific thresholds
  'wallet_balance_latency': ['p(95)<500'],  // 95% of balance requests should be below 500ms
  'wallet_transaction_latency': ['p(95)<1000'],  // 95% of transaction requests should be below 1000ms
  'wallet_failed_requests': ['rate<0.1'],   // Less than 10% of requests should fail
}; 