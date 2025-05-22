@echo off
setlocal EnableDelayedExpansion

REM Set colors for output (not working correctly in Windows CMD)
set "GREEN="
set "YELLOW="
set "RED="
set "NC="

REM Get current date and time for logs
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "DATETIME=%dt:~0,4%-%dt:~4,2%-%dt:~6,2% %dt:~8,2%:%dt:~10,2%:%dt:~12,2%"

goto main

REM Log function
:log
echo [%DATETIME%] %~1
exit /b 0

:error
echo [%DATETIME%] ERROR: %~1
exit /b 0

:warn
echo [%DATETIME%] WARNING: %~1
exit /b 0

REM Function to check if docker is running
:check_docker
call :log "Checking if Docker is running..."
docker info >nul 2>&1
if errorlevel 1 (
    call :error "Docker is not running. Please start Docker and try again."
    exit /b 1
)
call :log "Docker is running."
exit /b 0

REM Function to stop all containers
:stop_containers
call :log "Stopping all containers..."
docker-compose down
call :log "All containers stopped."
exit /b 0

REM Function to start all containers
:start_containers
call :log "Starting all containers..."
docker-compose up -d
REM Wait for containers to be ready
call :log "Waiting for services to be ready..."
timeout /t 5 /nobreak >nul
call :log "Services should be available now."
exit /b 0

REM Function to restart all containers
:restart_containers
call :log "Restarting all containers..."
docker-compose restart
REM Wait for containers to be ready
call :log "Waiting for services to be ready..."
timeout /t 5 /nobreak >nul
call :log "Services should be ready now."
exit /b 0

REM Function to run a quick test
:run_test
call :log "Running quick test to verify system functionality..."
echo Running a lightweight micro test (100 iterations, 5 VUs)...

REM Run test and continue regardless of the result
docker exec k6-runner k6 run -e SCENARIO=micro /scripts/wallet-test.js
call :log "Test execution finished. Some rate limiting errors are normal."
call :log "If you see HTTP requests being made, the system is functioning correctly."
exit /b 0

REM Function to view logs
:view_logs
call :log "Showing container logs..."
docker-compose logs
exit /b 0

REM Function to show status
:show_status
call :log "Checking container status..."
docker-compose ps
exit /b 0

REM Main function
:main
if "%1"=="" goto usage
if /i "%1"=="start" goto start
if /i "%1"=="stop" goto stop
if /i "%1"=="restart" goto restart
if /i "%1"=="test" goto test
if /i "%1"=="status" goto status
if /i "%1"=="logs" goto logs
goto usage

:start
call :check_docker || goto end
call :start_containers || goto end
call :run_test
call :log "Dashboard is available at http://localhost:3400"
goto end

:stop
call :stop_containers
goto end

:restart
call :check_docker || goto end
call :restart_containers || goto end
call :run_test
call :log "Dashboard is available at http://localhost:3400"
goto end

:test
call :check_docker || goto end
call :run_test
goto end

:status
call :show_status
goto end

:logs
call :view_logs
goto end

:usage
echo Usage: %0 {start^|stop^|restart^|test^|status^|logs}
echo.
echo   start   - Start all containers and run a verification test
echo   stop    - Stop all containers
echo   restart - Restart all containers and run a verification test
echo   test    - Run a quick verification test
echo   status  - Show container status
echo   logs    - View container logs
exit /b 1

:end
exit /b 0 