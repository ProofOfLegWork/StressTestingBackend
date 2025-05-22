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
  
echo Copying HTML report from container...  
docker cp k6-runner:/scripts/mega-test-report.html ./mega-test-report.html  
  
echo Test completed!  
echo HTML report saved to mega-test-report.html  
echo.  
echo Press any key to exit...  
pause 
