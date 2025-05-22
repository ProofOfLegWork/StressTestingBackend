#!/bin/bash

echo "Starting K6 Stress Testing Dashboard..."
echo "Building and starting containers..."
docker-compose up -d --build

echo ""
echo "Setup complete! Access the dashboard at http://localhost:3400"
echo "Press Ctrl+C to view logs"
echo "To stop the service, run: docker-compose down"

# Wait for input and then show logs
read -p "Press Enter to view logs..."
docker-compose logs -f 