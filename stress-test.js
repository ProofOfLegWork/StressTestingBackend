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
const BASE_URL = 'http://localhost:3400';

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

  // Add more test scenarios based on your API endpoints
  // Example:
  // const getData = http.get(`${BASE_URL}/api/data`);
  // check(getData, {
  //   'get data status is 200': (r) => r.status === 200,
  // });

  // Add sleep between requests to prevent overwhelming the server
  sleep(1);
} 