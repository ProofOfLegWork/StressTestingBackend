@echo off  
echo Running MEGA load test with 5000 virtual users for 1 minute...  
echo WARNING: This test may cause significant load on your system!  
echo.  
echo Press Ctrl+C to cancel or any key to continue...  
pause > nul  
  
echo Copying the latest test script to container...  
docker cp mega-wallet-test.js k6-runner:/scripts/mega-wallet-test.js  
  
echo Starting test...  
docker exec k6-runner k6 run -e SCENARIO=mega /scripts/mega-wallet-test.js  
  
echo Copying HTML reports from container...  
if not exist "reports" mkdir reports  
docker cp k6-runner:/scripts/mega-test-report.html ./reports/mega-test-report.html  
echo Copied standard report to ./reports/mega-test-report.html  
  
REM Try to get any timestamped reports  
echo Looking for timestamped reports...  
docker exec k6-runner ls /scripts/mega-test-report-*.html 2>nul  
if %ERRORLEVEL% EQU 0 (  
    docker cp k6-runner:/scripts/. ./reports/  
    echo Additional reports copied to reports folder  
)  
  
echo Test completed!  
echo HTML reports saved to the ./reports directory  
echo.  
echo Press any key to exit...  
pause 
