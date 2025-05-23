const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 8080;

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Environment check - are we running in Docker?
const isDocker = process.env.NODE_ENV === 'production' || process.env.DOCKER_CONTAINER || false;

// Configure logging
const logFile = path.join(__dirname, 'server.log');
const log = (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(logFile, logMessage + '\n');
};

log('Starting server...');
log(`Running in Docker: ${isDocker}`);

// Serve the main page
app.get('/', (req, res) => {
    log(`GET / request from ${req.ip}`);
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    log('Health check request');
    res.json({ status: 'ok', isDocker });
});

// Endpoint to run preset K6 tests
app.post('/run-test', (req, res) => {
    const { scenario } = req.body;
    log(`Running preset test: ${scenario}`);
    
    // Validate scenario
    if (!scenario) {
        log('Error: No scenario provided');
        return res.status(400).json({ error: 'No scenario provided' });
    }
    
    let command;
    
    if (isDocker) {
        // Use Docker exec to run K6 in the k6 container
        // Since we modified the entrypoint, we need to call k6 directly
        command = `docker exec k6-runner k6 run -e SCENARIO=${scenario} /scripts/stress-test.js`;
    } else {
        // Run K6 locally
        command = `k6 run -e SCENARIO=${scenario} stress-test.js`;
    }

    log(`Executing command: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            log(`Error executing test: ${error.message}`);
            return res.status(500).json({ 
                error: error.message,
                stdout,
                stderr
            });
        }
        
        log('Test completed successfully');
        
        // Parse metrics from K6 output
        try {
            const metrics = parseK6Metrics(stdout);
            log(`Parsed metrics: ${JSON.stringify(metrics)}`);
            
            res.json({ 
                output: stdout,
                error: stderr,
                metrics
            });
        } catch (parseError) {
            log(`Error parsing metrics: ${parseError.message}`);
            res.json({
                output: stdout,
                error: stderr,
                metrics: {
                    responseTime: 0,
                    virtualUsers: 0,
                    requestRate: 0,
                    errorRate: 0
                },
                parseError: parseError.message
            });
        }
    });
});

// Endpoint to run custom K6 tests
app.post('/run-custom-test', (req, res) => {
    const { name, initialUsers, targetUsers, duration } = req.body;
    log(`Running custom test: ${name}, initial: ${initialUsers}, target: ${targetUsers}, duration: ${duration}m`);
    
    // Validate input
    if (!name || !initialUsers || !targetUsers || !duration) {
        log('Error: Missing required parameters');
        return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Create custom config for this test
    const customConfig = {
        executor: 'ramping-vus',
        startVUs: initialUsers,
        stages: [
            { duration: `${duration/2}m`, target: targetUsers },
            { duration: `${duration/2}m`, target: 0 }
        ]
    };

    // Write custom config to temporary file
    const timestamp = Date.now();
    const configPath = path.join(__dirname, `custom-config-${timestamp}.js`);
    try {
        fs.writeFileSync(configPath, `export default ${JSON.stringify(customConfig, null, 2)}`);
        log(`Created custom config file at ${configPath}`);
    } catch (fileError) {
        log(`Error creating config file: ${fileError.message}`);
        return res.status(500).json({ error: `Error creating config file: ${fileError.message}` });
    }

    let command;
    let dockerConfigPath;
    
    if (isDocker) {
        // Path inside k6 container
        dockerConfigPath = `/scripts/custom-config-${timestamp}.js`;
        // Since we modified the entrypoint, we need to call k6 directly
        command = `docker exec k6-runner k6 run --config ${dockerConfigPath} /scripts/stress-test.js`;
    } else {
        command = `k6 run --config ${configPath} stress-test.js`;
    }

    log(`Executing command: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
        // Clean up temporary config file
        try {
            fs.unlinkSync(configPath);
            log(`Deleted custom config file ${configPath}`);
        } catch (unlinkError) {
            log(`Error deleting config file: ${unlinkError.message}`);
        }

        if (error) {
            log(`Error executing custom test: ${error.message}`);
            return res.status(500).json({ 
                error: error.message,
                stdout,
                stderr
            });
        }
        
        log('Custom test completed successfully');
        
        // Parse metrics from K6 output
        try {
            const metrics = parseK6Metrics(stdout);
            log(`Parsed metrics: ${JSON.stringify(metrics)}`);
            
            res.json({ 
                output: stdout,
                error: stderr,
                metrics
            });
        } catch (parseError) {
            log(`Error parsing metrics: ${parseError.message}`);
            res.json({
                output: stdout,
                error: stderr,
                metrics: {
                    responseTime: 0,
                    virtualUsers: 0,
                    requestRate: 0,
                    errorRate: 0
                },
                parseError: parseError.message
            });
        }
    });
});

// Endpoint to run wallet-specific K6 tests
app.post('/run-wallet-test', (req, res) => {
    const { intensity = 'moderate' } = req.body;
    log(`Running wallet-specific test with intensity: ${intensity}`);
    
    // Map intensity to specific scenario
    let scenario;
    
    switch(intensity) {
        case 'light':
            scenario = 'wallet_light';
            break;
        case 'moderate':
            scenario = 'wallet_moderate';
            break;
        case 'heavy':
            scenario = 'wallet_heavy';
            break;
        case 'extreme':
            scenario = 'wallet_extreme';
            break;
        default:
            scenario = 'wallet_moderate';
    }
    
    let command;
    
    if (isDocker) {
        // Use Docker exec to run K6 in the k6 container
        // Since we modified the entrypoint, we need to call k6 directly
        command = `docker exec k6-runner k6 run -e SCENARIO=${scenario} /scripts/wallet-test.js`;
    } else {
        // Run K6 locally
        command = `k6 run -e SCENARIO=${scenario} wallet-test.js`;
    }
    
    log(`Executing wallet test command: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            log(`Error executing wallet test: ${error.message}`);
            return res.status(500).json({ 
                error: error.message,
                stdout,
                stderr
            });
        }
        
        log('Wallet test completed successfully');
        
        // Parse metrics from K6 output
        try {
            // Extract wallet-specific metrics
            const walletMetrics = {
                balanceLatency: parseMetric(stdout, 'wallet_balance_latency'),
                transactionLatency: parseMetric(stdout, 'wallet_transaction_latency'),
                failRate: parseMetric(stdout, 'wallet_failed_requests'),
                ...parseK6Metrics(stdout)
            };
            
            log(`Parsed wallet metrics: ${JSON.stringify(walletMetrics)}`);
            
            res.json({ 
                output: stdout,
                error: stderr,
                metrics: walletMetrics
            });
        } catch (parseError) {
            log(`Error parsing wallet metrics: ${parseError.message}`);
            res.json({
                output: stdout,
                error: stderr,
                metrics: {
                    responseTime: 0,
                    virtualUsers: 0,
                    requestRate: 0,
                    errorRate: 0,
                    balanceLatency: 0,
                    transactionLatency: 0,
                    failRate: 0
                },
                parseError: parseError.message
            });
        }
    });
});

// Helper function to parse specific metrics
function parseMetric(output, metricName) {
    try {
        // Try different patterns for metrics
        const avgMatch = output.match(new RegExp(`${metricName}.*?avg=(\\d+\\.?\\d*)`));
        const rateMatch = output.match(new RegExp(`${metricName}.*?rate=(\\d+\\.?\\d*)`));
        const p95Match = output.match(new RegExp(`${metricName}.*?p\\(95\\)=(\\d+\\.?\\d*)`));
        const valueMatch = output.match(new RegExp(`${metricName}.*?value=(\\d+\\.?\\d*)`));
        const countMatch = output.match(new RegExp(`${metricName}.*?count=(\\d+\\.?\\d*)`));
        
        // Check for VUs specifically as it has a different format
        if (metricName === 'vus' || metricName === 'virtual users') {
            const vusMatch = output.match(/vus\s*[:=]\s*(\d+)/i);
            const vusMaxMatch = output.match(/vus_max\s*[:=]\s*(\d+)/i);
            if (vusMatch) return parseFloat(vusMatch[1]);
            if (vusMaxMatch) return parseFloat(vusMaxMatch[1]);
        }
        
        // Return the first match found
        if (avgMatch) return parseFloat(avgMatch[1]);
        if (rateMatch) return parseFloat(rateMatch[1]);
        if (p95Match) return parseFloat(p95Match[1]);
        if (valueMatch) return parseFloat(valueMatch[1]);
        if (countMatch) return parseFloat(countMatch[1]);
        
        // For rate limits, also look for mentions in the logs
        if (metricName.includes('rate_limit')) {
            if (output.includes('Rate limit detected') || 
                output.includes('rate limit detected') ||
                output.includes('429 Too Many Requests')) {
                return 0.01; // Return a small value to indicate rate limiting was detected
            }
        }
        
        // Check if metricName appears in output at all
        if (output.includes(metricName)) {
            // Try a more aggressive pattern
            const anyValueMatch = output.match(new RegExp(`${metricName}.*?(\\d+\\.?\\d*)`));
            if (anyValueMatch) return parseFloat(anyValueMatch[1]);
        }
        
        // Default fallback value
        return 0;
    } catch (error) {
        log(`Error parsing metric ${metricName}: ${error.message}`);
        return 0;
    }
}

// More robust K6 metrics parsing
function parseK6Metrics(output) {
    try {
        log('Parsing K6 metrics from output');
        
        // Basic metrics parsing
        let responseTime = parseMetric(output, 'http_req_duration');
        let virtualUsers = parseMetric(output, 'vus');
        let requestRate = parseMetric(output, 'http_reqs');
        let errorRate = parseMetric(output, 'errors') || parseMetric(output, 'http_req_failed');
        const rateLimitRate = parseMetric(output, 'rate_limits') || parseMetric(output, 'wallet_rate_limits') || 0;
        
        // If we couldn't find values using the standard patterns, try alternative approaches
        if (responseTime === 0) {
            // Look for response time in other formats
            const rtMatch = output.match(/response\s+time.*?(\d+\.\d+)\s*ms/i);
            if (rtMatch) responseTime = parseFloat(rtMatch[1]);
        }
        
        if (virtualUsers === 0) {
            // Try to extract VUs from iteration counts or other mentions
            const iterMatch = output.match(/iterations.*?(\d+)/i);
            if (iterMatch) virtualUsers = Math.ceil(parseFloat(iterMatch[1]) / 10); // Rough estimate
        }
        
        if (requestRate === 0) {
            // Look for requests per second
            const rpsMatch = output.match(/(\d+\.\d+)\s*req\/s/i);
            if (rpsMatch) requestRate = parseFloat(rpsMatch[1]);
        }
        
        if (errorRate === 0 && output.includes('fail')) {
            // Check for failures or errors
            const failMatch = output.match(/fail.*?(\d+\.\d+)%/i);
            if (failMatch) errorRate = parseFloat(failMatch[1]) / 100;
        }
        
        // Determine rate limit source (nginx or API)
        let rateLimitSource = 'none';
        if (rateLimitRate > 0) {
            // Look for headers or specific responses to determine source
            if (output.includes('Nginx rate limit detected') || output.includes('x-ratelimit-remaining')) {
                rateLimitSource = 'nginx';
            } else {
                rateLimitSource = 'api';
            }
        }
        
        const parsedMetrics = {
            responseTime: responseTime || 0,
            virtualUsers: virtualUsers || 0,
            requestRate: requestRate || 0,
            errorRate: errorRate || 0,
            rateLimitRate: rateLimitRate || 0,
            rateLimitSource
        };
        
        log(`Extracted metrics: ${JSON.stringify(parsedMetrics)}`);
        return parsedMetrics;
    } catch (error) {
        log(`Error parsing metrics: ${error.stack}`);
        return { responseTime: 0, virtualUsers: 0, requestRate: 0, errorRate: 0, rateLimitRate: 0, rateLimitSource: 'none' };
    }
}

app.listen(port, () => {
    log(`Server running at http://localhost:${port}`);
}); 