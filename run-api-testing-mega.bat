@echo off
echo Running API TESTING MEGA load test for wallet operations with 5000 virtual users for 1 minute...
echo WARNING: This test may cause significant load on your system!
echo.
echo Press Ctrl+C to cancel or any key to continue...
pause > nul

echo Copying the latest test script to container...
docker cp api-testing-mega.js k6-runner:/scripts/api-testing-mega.js

echo Starting test...
docker exec k6-runner k6 run -e SCENARIO=mega /scripts/api-testing-mega.js

echo Copying HTML reports from container...
if not exist "reports" mkdir reports
docker cp k6-runner:/scripts/api-testing-wallet-report.html ./reports/api-testing-wallet-report.html
echo Copied standard report to ./reports/api-testing-wallet-report.html

REM Try to get any timestamped reports
echo Looking for timestamped reports...
docker exec k6-runner ls /scripts/api-testing-wallet-report-*.html 2>nul
if %ERRORLEVEL% EQU 0 (
    docker cp k6-runner:/scripts/. ./reports/
    echo Additional reports copied to reports folder
)

echo Test completed!
echo HTML reports saved to the ./reports directory
echo.
echo Press any key to exit...
pause 