import http from 'k6/http';
import { check, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import config from './config.js';

// Custom metrics
const failRate = new Rate('wallet_failed_requests');
const rateLimitRate = new Rate('wallet_rate_limits');
const walletCreationLatency = new Trend('wallet_creation_latency');

// API Configuration
const BASE_URL = 'http://host.docker.internal';
const API_PATH = '/api';

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
    'wallet_creation_latency': ['p(95)<2000'],  // Higher threshold for extreme load
    'wallet_failed_requests': ['rate<0.5'],     // Higher failure tolerance
    'wallet_rate_limits': ['rate<0.5'],         // Higher rate limit tolerance
    'http_req_duration': ['p(95)<2000'],        // Higher duration threshold
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
  // Generate unique wallet data
  const walletId = `mega-test-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  
  // Wallet Creation
  group("Wallet Creation", function() {
    // Start timing for latency measurement
    const start = new Date();
    
    const payload = JSON.stringify({
      publicKey: walletId,
      coins: Math.floor(Math.random() * 1000)
    });
    
    const createResponse = http.post(`${BASE_URL}${API_PATH}/wallet/create`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'accept': '*/*',
        'x-internal-testing': 'true'
      },
      timeout: '5s'  // Shorter timeout to avoid hanging requests
    });
    
    // Record latency
    walletCreationLatency.add(new Date() - start);
    
    // Check for rate limiting
    const isRateLimited = checkRateLimit(createResponse);
    
    // Record success/failure
    const success = check(createResponse, {
      'wallet creation status is 200 or 201': (r) => r.status === 200 || r.status === 201 || isRateLimited,
      'wallet creation response has walletId': (r) => {
        if (r.status !== 200 && r.status !== 201) return isRateLimited;
        try {
          const body = JSON.parse(r.body);
          return body.walletId || body.id || isRateLimited;
        } catch (e) {
          console.log(`Failed to parse wallet creation response: ${e.message}`);
          return false;
        }
      }
    });
    
    if (!success) {
      failRate.add(1);
      console.log(`Failed to create wallet. Status: ${createResponse.status}, Response: ${createResponse.body}`);
    }
  });
  
  // No sleep between iterations to maximize load
}

// Generate HTML report after test completion
export function handleSummary(data) {
  // Create a report with a timestamp in the filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const vuCount = config.scenarios.mega.vus;
  
  return {
    // Main report with timestamp and VU count in filename
    [`mega-test-report-${vuCount}vu-${timestamp}.html`]: htmlReport(data, {
      title: `Mega Load Test Report - ${vuCount} VUs`,
      description: `Stress testing the wallet API with ${vuCount} concurrent users for ${config.scenarios.mega.duration}`
    }),
    // Standard report name for consistency
    "mega-test-report.html": htmlReport(data, {
      title: `Mega Load Test Report - ${vuCount} VUs`,
      description: `Stress testing the wallet API with ${vuCount} concurrent users for ${config.scenarios.mega.duration}`
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