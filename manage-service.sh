#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Log function
log() {
  echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
  echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warn() {
  echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Function to check if docker is running
check_docker() {
  log "Checking if Docker is running..."
  if ! docker info > /dev/null 2>&1; then
    error "Docker is not running. Please start Docker and try again."
    exit 1
  fi
  log "Docker is running."
}

# Function to stop all containers
stop_containers() {
  log "Stopping all containers..."
  docker-compose down
  log "All containers stopped."
}

# Function to start all containers
start_containers() {
  log "Starting all containers..."
  docker-compose up -d
  
  # Wait for containers to be ready
  log "Waiting for services to be ready..."
  sleep 5
  log "Services should be available now."
}

# Function to restart all containers
restart_containers() {
  log "Restarting all containers..."
  docker-compose restart
  
  # Wait for containers to be ready
  log "Waiting for services to be ready..."
  sleep 5
  log "Services should be ready now."
}

# Function to run a quick test
run_test() {
  log "Running quick test to verify system functionality..."
  TEST_OUTPUT=$(docker exec k6-runner k6 run -e SCENARIO=micro /scripts/wallet-test.js)
  
  # Check if test completed successfully
  if [[ $? -eq 0 ]]; then
    log "Test completed successfully!"
    
    # Extract some basic metrics
    ITERATIONS=$(echo "$TEST_OUTPUT" | grep "iterations" | awk '{print $2}')
    VUS=$(echo "$TEST_OUTPUT" | grep "vus" | awk '{print $2}')
    
    log "Test ran with $VUS VUs and completed $ITERATIONS iterations"
    return 0
  else
    error "Test failed!"
    echo "$TEST_OUTPUT"
    return 1
  fi
}

# Function to view logs
view_logs() {
  log "Showing container logs..."
  docker-compose logs
}

# Function to show status
show_status() {
  log "Checking container status..."
  docker-compose ps
}

# Main function
main() {
  case "$1" in
    start)
      check_docker
      start_containers
      run_test
      log "Dashboard is available at http://localhost:3400"
      ;;
    stop)
      stop_containers
      ;;
    restart)
      check_docker
      restart_containers
      run_test
      log "Dashboard is available at http://localhost:3400"
      ;;
    test)
      check_docker
      run_test
      ;;
    status)
      show_status
      ;;
    logs)
      view_logs
      ;;
    *)
      echo "Usage: $0 {start|stop|restart|test|status|logs}"
      echo ""
      echo "  start   - Start all containers and run a verification test"
      echo "  stop    - Stop all containers"
      echo "  restart - Restart all containers and run a verification test"
      echo "  test    - Run a quick verification test"
      echo "  status  - Show container status"
      echo "  logs    - View container logs"
      exit 1
      ;;
  esac
}

# Execute main with all arguments
main "$@" 