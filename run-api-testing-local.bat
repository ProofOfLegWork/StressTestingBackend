@echo off
echo Running API TESTING load test locally with a reduced number of virtual users for 1 minute...
echo WARNING: This test may still cause significant load on your system!
echo.
echo Press Ctrl+C to cancel or any key to continue...
pause > nul

echo Starting test...
echo This assumes you have k6 installed locally. If not, visit https://k6.io/docs/get-started/installation/
echo.

REM Set a more reasonable VU count for local testing
set LOCAL_VUS=50
echo Using %LOCAL_VUS% virtual users instead of 5000 for local testing

REM Run the test with a modified BASE_URL for local testing
echo Modifying the test for local environment...
set "TEMP_FILE=temp-api-testing.js"
type api-testing-mega.js > %TEMP_FILE%

REM Replace Docker-specific host with localhost
powershell -Command "(Get-Content %TEMP_FILE%) -replace 'http://host.docker.internal', 'http://localhost' | Set-Content %TEMP_FILE%"

echo Running test (this will take approximately 1 minute)...
k6 run -e SCENARIO=mega -e LOCAL_VUS=%LOCAL_VUS% %TEMP_FILE%

echo Cleaning up temporary file...
del %TEMP_FILE%

echo Test completed!
echo HTML report has been saved to api-testing-report.html
echo.
echo Press any key to exit...
pause 