@echo off  
echo Running MEGA load test with 5000 virtual users for 1 minute...  
echo WARNING: This test may cause significant load on your system!  
echo.  
echo Press Ctrl+C to cancel or any key to continue...  
pause > nul  
  
echo Starting test...  
docker exec k6-runner k6 run -e SCENARIO=mega /scripts/mega-wallet-test.js  
  
echo Test completed!  
pause 
