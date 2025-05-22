@echo off
echo Running MEGA load test locally with 5000 virtual users for 1 minute...
echo WARNING: This test may cause significant load on your system!
echo.
echo Press Ctrl+C to cancel or any key to continue...
pause > nul

echo Starting test...
echo This assumes you have k6 installed locally. If not, visit https://k6.io/docs/get-started/installation/
echo.

REM Run the test with a modified BASE_URL for local testing
echo Modifying the test for local environment...
set "TEMP_FILE=temp-mega-test.js"
type mega-wallet-test.js > %TEMP_FILE%

REM Replace Docker-specific host with localhost
powershell -Command "(Get-Content %TEMP_FILE%) -replace 'http://host.docker.internal', 'http://localhost' | Set-Content %TEMP_FILE%"

echo Running test (this will take approximately 1 minute)...
k6 run -e SCENARIO=mega %TEMP_FILE%

echo Cleaning up temporary file...
del %TEMP_FILE%

echo Test completed!
echo HTML report has been saved to mega-test-report.html
echo.
echo Press any key to exit...
pause 