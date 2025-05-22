@echo off
setlocal EnableDelayedExpansion

REM Set colors for output
set "GREEN=[32m"
set "YELLOW=[33m"
set "RED=[31m"
set "NC=[0m"

REM Get current date and time for logs
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "DATETIME=%dt:~0,4%-%dt:~4,2%-%dt:~6,2% %dt:~8,2%:%dt:~10,2%:%dt:~12,2%"

REM Log function
:log
echo %GREEN%[%DATETIME%] %1%NC%
goto :eof

:error
echo %RED%[%DATETIME%] ERROR: %1%NC%
goto :eof

:warn
echo %YELLOW%[%DATETIME%] WARNING: %1%NC%
goto :eof

REM Function to check if docker is running
:check_docker
call :log "Checking if Docker is running..."
docker info >nul 2>&1
if errorlevel 1 (
    call :error "Docker is not running. Please start Docker and try again."
    exit /b 1
)
call :log "Docker is running."
goto :eof

REM Function to stop all containers
:stop_containers
call :log "Stopping all containers..."
docker-compose down
call :log "All containers stopped."
goto :eof

REM Function to start all containers
:start_containers
call :log "Starting all containers..."
docker-compose up -d
REM Wait for containers to be ready
call :log "Waiting for services to be ready..."
timeout /t 5 /nobreak >nul
call :log "Services should be available now."
goto :eof

REM Function to restart all containers
:restart_containers
call :log "Restarting all containers..."
docker-compose restart
REM Wait for containers to be ready
call :log "Waiting for services to be ready..."
timeout /t 5 /nobreak >nul
call :log "Services should be ready now."
goto :eof

REM Function to run a quick test
:run_test
call :log "Running quick test to verify system functionality..."
for /f "tokens=*" %%i in ('docker exec k6-runner k6 run -e SCENARIO^=micro /scripts/wallet-test.js') do (
    set "TEST_OUTPUT=!TEST_OUTPUT!%%i^n"
)

if errorlevel 1 (
    call :error "Test failed!"
    echo !TEST_OUTPUT!
    exit /b 1
) else (
    call :log "Test completed successfully!"
    call :log "Test completed with 5 VUs and 100 iterations"
)
goto :eof

REM Function to view logs
:view_logs
call :log "Showing container logs..."
docker-compose logs
goto :eof

REM Function to show status
:show_status
call :log "Checking container status..."
docker-compose ps
goto :eof

REM Main function
:main
if "%1"=="" goto usage
if "%1"=="start" goto start
if "%1"=="stop" goto stop
if "%1"=="restart" goto restart
if "%1"=="test" goto test
if "%1"=="status" goto status
if "%1"=="logs" goto logs
goto usage

:start
call :check_docker
call :start_containers
call :run_test
call :log "Dashboard is available at http://localhost:3400"
goto end

:stop
call :stop_containers
goto end

:restart
call :check_docker
call :restart_containers
call :run_test
call :log "Dashboard is available at http://localhost:3400"
goto end

:test
call :check_docker
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