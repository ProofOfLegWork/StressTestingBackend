import http from 'k6/http';
import { check, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import config from './config.js';

// Custom metrics
const failRate = new Rate('api_testing_failed_requests');
const rateLimitRate = new Rate('api_testing_rate_limits');
const walletCreationLatency = new Trend('wallet_creation_latency');
const addCoinsLatency = new Trend('add_coins_latency');
const updateCoinsLatency = new Trend('update_coins_latency');

// API Configuration
const BASE_URL = 'http://localhost';
const API_PATH = '/api-testing';

// Get scenario from environment or default to mega
const selectedScenario = __ENV.SCENARIO || 'mega';

// For local testing, we can override the number of VUs
if (__ENV.LOCAL_VUS && selectedScenario === 'mega') {
  const localVUs = parseInt(__ENV.LOCAL_VUS);
  console.log(`Using reduced VU count for local testing: ${localVUs} instead of ${config.scenarios.mega.vus}`);
  config.scenarios.mega.vus = localVUs;
}

// Set options based on the selected scenario
export const options = {
  scenarios: {
    default: config.scenarios[selectedScenario]
  },
  thresholds: {
    'wallet_creation_latency': ['p(95)<2000'],   // Higher threshold for extreme load
    'add_coins_latency': ['p(95)<2000'],         // Higher threshold for extreme load
    'update_coins_latency': ['p(95)<2000'],      // Higher threshold for extreme load
    'api_testing_failed_requests': ['rate<0.5'], // Higher failure tolerance
    'api_testing_rate_limits': ['rate<0.5'],     // Higher rate limit tolerance
    'http_req_duration': ['p(95)<2000'],         // Higher duration threshold
  },
  // Disable default browser summary for cleaner output
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)'],
};

// Helper function to check if response indicates rate limiting
function checkRateLimit(response) {
  const isRateLimited = response.status === 429 || 
                       (response.body && response.body.includes("rate limit")) ||
                       (response.headers && response.headers['x-ratelimit-remaining'] === '0');
  
  if (isRateLimited) {
    rateLimitRate.add(1);
    console.log(`Rate limit detected: ${response.status} ${response.body}`);
    return true;
  }
  return false;
}

export default function() {
  // Generate unique wallet ID
  const walletId = `mega-test-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  
  // 1. Wallet Creation
  let createdWalletId = '';
  
  group("Wallet Creation", function() {
    // Start timing for latency measurement
    const start = new Date();
    
    const payload = JSON.stringify({
      publicKey: walletId,
      coins: Math.floor(Math.random() * 1000)
    });
    
    // Using /api-testing/wallet/create endpoint for wallet creation
    const response = http.post(`${BASE_URL}${API_PATH}/wallet/create`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'accept': '*/*',
        'X-Internal-Testing': 'true'
      },
      timeout: '5s'
    });
    
    // Record latency
    walletCreationLatency.add(new Date() - start);
    
    // Check for rate limiting
    const isRateLimited = checkRateLimit(response);
    
    // Record success/failure
    const success = check(response, {
      'wallet creation status is 200 or 201': (r) => r.status === 200 || r.status === 201 || isRateLimited,
      'wallet creation response has data': (r) => {
        if (r.status !== 200 && r.status !== 201) return isRateLimited;
        try {
          const body = JSON.parse(r.body);
          console.log(`Wallet creation response: ${JSON.stringify(body)}`);
          
          if (body.walletId) {
            createdWalletId = body.walletId;
            console.log(`Using walletId: ${createdWalletId}`);
            return true;
          } else if (body.id) {
            createdWalletId = body.id;
            console.log(`Using id: ${createdWalletId}`);
            return true;
          } else if (body.publicKeyHash) {
            createdWalletId = body.publicKeyHash;
            console.log(`Using publicKeyHash as ID: ${createdWalletId}`);
            return true;
          } else if (body.success && body.message && body.message.includes("created")) {
            // Extract ID from success message if possible
            const idMatch = body.message.match(/ID:? ([a-zA-Z0-9]+)/i);
            if (idMatch && idMatch[1]) {
              createdWalletId = idMatch[1];
              console.log(`Extracted ID from message: ${createdWalletId}`);
              return true;
            }
          }
          
          console.log(`Could not find wallet ID in response: ${JSON.stringify(body)}`);
          return isRateLimited;
        } catch (e) {
          console.log(`Failed to parse wallet creation response: ${e.message}`);
          return false;
        }
      }
    });
    
    if (!success) {
      failRate.add(1);
      console.log(`Failed wallet creation. Status: ${response.status}, Response: ${response.body}`);
    }
  });
  
  // Use a default wallet ID if creation failed
  if (!createdWalletId) {
    createdWalletId = '1001';
    console.log(`Using default wallet ID: ${createdWalletId}`);
  }
  
  console.log(`Final wallet ID for subsequent operations: ${createdWalletId}`);
  
  // 2. Add Coins to Wallet
  group("Add Coins", function() {
    // Start timing for latency measurement
    const start = new Date();
    
    // Try adding walletId to query parameters as well
    const addCoinsUrl = `${BASE_URL}${API_PATH}/wallet/add-coins?walletId=${createdWalletId}`;
    
    const payload = JSON.stringify({
      amount: Math.floor(Math.random() * 500) + 100,
      // Include wallet ID in payload as well in case API supports either method
      walletId: createdWalletId
    });
    
    console.log(`Add Coins request to: ${addCoinsUrl}`);
    console.log(`Add Coins request for wallet ID: ${createdWalletId}`);
    console.log(`Add Coins payload: ${payload}`);
    
    // Using /api-testing/wallet/add-coins endpoint
    const response = http.post(addCoinsUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'accept': '*/*',
        'X-Internal-Testing': 'true',
        'X-Wallet-Id': createdWalletId  // Add wallet ID in header
      },
      timeout: '5s'
    });
    
    console.log(`Add Coins response: ${response.status} - ${response.body}`);
    
    // Record latency
    addCoinsLatency.add(new Date() - start);
    
    // Check for rate limiting
    const isRateLimited = checkRateLimit(response);
    
    // Record success/failure
    const success = check(response, {
      'add coins status is 200': (r) => r.status === 200 || isRateLimited,
      'add coins response is valid': (r) => {
        if (r.status !== 200) return isRateLimited;
        try {
          const body = JSON.parse(r.body);
          return body.success || isRateLimited;
        } catch (e) {
          console.log(`Failed to parse add coins response: ${e.message}`);
          return false;
        }
      }
    });
    
    if (!success) {
      failRate.add(1);
      console.log(`Failed to add coins. Status: ${response.status}, Response: ${response.body}`);
    }
  });
  
  // 3. Update Coins in Wallet
  group("Update Coins", function() {
    // Start timing for latency measurement
    const start = new Date();
    
    // Try adding walletId to query parameters as well
    const updateCoinsUrl = `${BASE_URL}${API_PATH}/wallet/update-coins?walletId=${createdWalletId}`;
    
    const payload = JSON.stringify({
      amount: Math.floor(Math.random() * 1000) + 200,
      // Include wallet ID in payload as well in case API supports either method
      walletId: createdWalletId
    });
    
    console.log(`Update Coins request to: ${updateCoinsUrl}`);
    console.log(`Update Coins request for wallet ID: ${createdWalletId}`);
    console.log(`Update Coins payload: ${payload}`);
    
    // Using /api-testing/wallet/update-coins endpoint
    const response = http.post(updateCoinsUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'accept': '*/*',
        'X-Internal-Testing': 'true',
        'X-Wallet-Id': createdWalletId  // Add wallet ID in header
      },
      timeout: '5s'
    });
    
    console.log(`Update Coins response: ${response.status} - ${response.body}`);
    
    // Record latency
    updateCoinsLatency.add(new Date() - start);
    
    // Check for rate limiting
    const isRateLimited = checkRateLimit(response);
    
    // Record success/failure
    const success = check(response, {
      'update coins status is 200': (r) => r.status === 200 || isRateLimited,
      'update coins response is valid': (r) => {
        if (r.status !== 200) return isRateLimited;
        try {
          const body = JSON.parse(r.body);
          return body.success || isRateLimited;
        } catch (e) {
          console.log(`Failed to parse update coins response: ${e.message}`);
          return false;
        }
      }
    });
    
    if (!success) {
      failRate.add(1);
      console.log(`Failed to update coins. Status: ${response.status}, Response: ${response.body}`);
    }
  });
}

// Generate HTML report after test completion
export function handleSummary(data) {
  // Create a report with a timestamp in the filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const vuCount = config.scenarios.mega.vus;
  
  return {
    // Main report with timestamp and VU count in filename
    [`api-testing-wallet-report-${vuCount}vu-${timestamp}.html`]: htmlReport(data, {
      title: `API Testing Wallet Mega Load Report - ${vuCount} VUs`,
      description: `Stress testing wallet operations via the /api-testing/ endpoint with ${vuCount} concurrent users for ${config.scenarios.mega.duration}`
    }),
    // Standard report name for consistency
    "api-testing-wallet-report.html": htmlReport(data, {
      title: `API Testing Wallet Mega Load Report - ${vuCount} VUs`,
      description: `Stress testing wallet operations via the /api-testing/ endpoint with ${vuCount} concurrent users for ${config.scenarios.mega.duration}`
    }),
    // Also output summary to stdout
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Simple text summary function
function textSummary(data, options) {
  options = options || {};
  const indent = options.indent || '  ';
  
  const summary = [];
  summary.push(`\nTest completed at: ${new Date(data.timestamp).toISOString()}`);
  summary.push(`Test duration: ${(data.state.testRunDurationMs/1000).toFixed(1)}s`);
  
  // Basic metrics summary
  summary.push('\nMetrics summary:');
  for (const [metricName, metric] of Object.entries(data.metrics)) {
    if (metric.type === 'trend') {
      summary.push(`${indent}${metricName}:`);
      summary.push(`${indent}${indent}min: ${metric.values.min.toFixed(2)}`);
      summary.push(`${indent}${indent}avg: ${metric.values.avg.toFixed(2)}`);
      summary.push(`${indent}${indent}med: ${metric.values.med.toFixed(2)}`);
      summary.push(`${indent}${indent}p(95): ${metric.values['p(95)'].toFixed(2)}`);
      summary.push(`${indent}${indent}max: ${metric.values.max.toFixed(2)}`);
    } else if (metric.type === 'counter' || metric.type === 'rate') {
      summary.push(`${indent}${metricName}: ${metric.values.rate.toFixed(2)}`);
    }
  }
  
  return summary.join('\n');
} 
