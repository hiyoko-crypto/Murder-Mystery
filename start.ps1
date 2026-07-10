$backend  = "cd 'C:\Users\hiyok\holmes'; .\venv\Scripts\Activate.ps1; uvicorn api:app --reload"
$frontend = "cd 'C:\Users\hiyok\holmes\frontend'; npm run dev"

Start-Process powershell -ArgumentList @("-NoExit", "-Command", $backend)
Start-Process powershell -ArgumentList @("-NoExit", "-Command", $frontend)

Write-Host "Starting... open http://localhost:5173"
