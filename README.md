# API Stress Testing Suite

This repository contains K6-based stress testing scripts for the MySQL API running at http://localhost:3400.

## Prerequisites

1. Install K6:
   - Windows: `choco install k6`
   - Mac: `brew install k6`
   - Linux: `sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69 && echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list && sudo apt-get update && sudo apt-get install k6`

## Test Scenarios

The test suite includes several scenarios:

1. **Smoke Test** (`smoke`): Basic test with 10 virtual users
2. **Load Test** (`load`): Medium load with 50 virtual users
3. **Stress Test** (`stress`): High load with 100 virtual users
4. **Spike Test** (`spike`): Sudden spike to 200 virtual users

## Running Tests

To run a specific test scenario:

```bash
k6 run --config config.js stress-test.js
```

To run a specific scenario:

```bash
k6 run --config config.js -e SCENARIO=smoke stress-test.js
```

## Test Results

The tests will output metrics including:
- HTTP request duration
- Error rates
- Virtual users
- Request rates

## Customizing Tests

1. Modify `config.js` to adjust test scenarios and thresholds
2. Update `stress-test.js` to add or modify API endpoints
3. Adjust sleep times and request patterns as needed

## Monitoring

Monitor your MySQL server and Nginx performance during tests:
- MySQL: `SHOW PROCESSLIST;` and `SHOW STATUS;`
- Nginx: Access and error logs
