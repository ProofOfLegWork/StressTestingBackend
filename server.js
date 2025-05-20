const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const app = express();
const port = 8080;

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint to run preset K6 tests
app.post('/run-test', (req, res) => {
    const { scenario } = req.body;
    const command = `k6 run --config config.js -e SCENARIO=${scenario} stress-test.js`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing test: ${error}`);
            return res.status(500).json({ error: error.message });
        }
        
        // Parse metrics from K6 output
        const metrics = parseK6Metrics(stdout);
        
        res.json({ 
            output: stdout,
            error: stderr,
            metrics
        });
    });
});

// Endpoint to run custom K6 tests
app.post('/run-custom-test', (req, res) => {
    const { name, initialUsers, targetUsers, duration } = req.body;
    
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
    const configPath = path.join(__dirname, `custom-config-${Date.now()}.js`);
    require('fs').writeFileSync(configPath, `export default ${JSON.stringify(customConfig, null, 2)}`);

    const command = `k6 run --config ${configPath} stress-test.js`;

    exec(command, (error, stdout, stderr) => {
        // Clean up temporary config file
        require('fs').unlinkSync(configPath);

        if (error) {
            console.error(`Error executing custom test: ${error}`);
            return res.status(500).json({ error: error.message });
        }
        
        // Parse metrics from K6 output
        const metrics = parseK6Metrics(stdout);
        
        res.json({ 
            output: stdout,
            error: stderr,
            metrics
        });
    });
});

// Helper function to parse K6 metrics
function parseK6Metrics(output) {
    try {
        // Extract metrics from K6 output
        const responseTimeMatch = output.match(/http_req_duration.*?p95=(\d+)/);
        const usersMatch = output.match(/vus=(\d+)/);
        const requestRateMatch = output.match(/http_reqs.*?rate=(\d+\.?\d*)/);
        const errorRateMatch = output.match(/http_req_failed.*?rate=(\d+\.?\d*)/);

        return {
            responseTime: responseTimeMatch ? parseInt(responseTimeMatch[1]) : 0,
            virtualUsers: usersMatch ? parseInt(usersMatch[1]) : 0,
            requestRate: requestRateMatch ? parseFloat(requestRateMatch[1]) : 0,
            errorRate: errorRateMatch ? parseFloat(errorRateMatch[1]) * 100 : 0
        };
    } catch (error) {
        console.error('Error parsing metrics:', error);
        return {
            responseTime: 0,
            virtualUsers: 0,
            requestRate: 0,
            errorRate: 0
        };
    }
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 