# BOOM Payment Gateway - PowerShell Setup Script
# Run this script as Administrator for best results

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  BOOM Payment Gateway - PowerShell Setup" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# Check if running as administrator
$isAdmin = [bool](([System.Security.Principal.WindowsIdentity]::GetCurrent()).groups -match "S-1-5-32-544")
if (-not $isAdmin) {
    Write-Host "[WARNING] Not running as administrator" -ForegroundColor Yellow
    Write-Host "Some features may not work correctly" -ForegroundColor Yellow
    Write-Host ""
}

# Function to check if a command exists
function Test-Command($command) {
    try {
        Get-Command $command -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Check for Node.js
Write-Host "[INFO] Checking for Node.js..." -ForegroundColor Blue
if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Host "[INFO] Node.js is installed: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Node.js is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "Download the 'LTS' version and run the installer." -ForegroundColor Yellow
    Write-Host ""
    
    # Try to open the Node.js website
    try {
        Start-Process "https://nodejs.org/"
        Write-Host "[INFO] Opening Node.js website..." -ForegroundColor Blue
    } catch {
        Write-Host "[WARNING] Could not open browser automatically" -ForegroundColor Yellow
    }
    
    Read-Host "Press Enter to exit..."
    exit 1
}

# Check for npm
Write-Host "[INFO] Checking for npm..." -ForegroundColor Blue
if (Test-Command "npm") {
    $npmVersion = npm --version
    Write-Host "[INFO] npm is available: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "[ERROR] npm is not available!" -ForegroundColor Red
    Write-Host "Please reinstall Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit 1
}

# Install dependencies
Write-Host ""
Write-Host "[INFO] Installing dependencies..." -ForegroundColor Blue
try {
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[INFO] Dependencies installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Failed to install dependencies!" -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }
} catch {
    Write-Host "[ERROR] Failed to install dependencies!" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

# Create environment file
Write-Host ""
Write-Host "[INFO] Creating environment configuration..." -ForegroundColor Blue
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "[INFO] Created .env file with default configuration" -ForegroundColor Green
} else {
    Write-Host "[INFO] .env file already exists" -ForegroundColor Yellow
}

# Create data directory
Write-Host ""
Write-Host "[INFO] Creating data directory..." -ForegroundColor Blue
if (-not (Test-Path "data")) {
    New-Item -ItemType Directory -Path "data"
    Write-Host "[INFO] Created data directory" -ForegroundColor Green
} else {
    Write-Host "[INFO] Data directory already exists" -ForegroundColor Yellow
}

# Run database setup
Write-Host ""
Write-Host "[INFO] Setting up database..." -ForegroundColor Blue
try {
    npm run migrate
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[INFO] Database setup completed!" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Database migration failed, but continuing..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARNING] Database setup failed, but continuing..." -ForegroundColor Yellow
}

# Run tests
Write-Host ""
Write-Host "[INFO] Running tests..." -ForegroundColor Blue
try {
    npm test
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[INFO] All tests passed!" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Some tests failed, but continuing..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARNING] Tests failed, but continuing..." -ForegroundColor Yellow
}

# Success message
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your BOOM Payment Gateway is ready to use!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the server:" -ForegroundColor White
Write-Host "  npm start" -ForegroundColor Cyan
Write-Host ""
Write-Host "Once started, you can access:" -ForegroundColor White
Write-Host "  Admin Panel: http://localhost:3000/admin" -ForegroundColor Cyan
Write-Host "  API Base:    http://localhost:3000/api/v1" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default admin credentials:" -ForegroundColor White
Write-Host "  Email:    admin@boom-payments.com" -ForegroundColor Cyan
Write-Host "  Password: password" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT: Change the default password in production!" -ForegroundColor Red
Write-Host ""

# Ask if user wants to start the server now
$startNow = Read-Host "Would you like to start the server now? (y/n)"
if ($startNow -eq "y" -or $startNow -eq "Y" -or $startNow -eq "yes" -or $startNow -eq "Yes") {
    Write-Host ""
    Write-Host "[INFO] Starting server..." -ForegroundColor Blue
    Write-Host "Press Ctrl+C to stop the server when done" -ForegroundColor Yellow
    Write-Host ""
    
    # Try to open the admin panel in browser
    try {
        Start-Process "http://localhost:3000/admin"
        Write-Host "[INFO] Opening admin panel in browser..." -ForegroundColor Blue
    } catch {
        Write-Host "[WARNING] Could not open browser automatically" -ForegroundColor Yellow
    }
    
    npm start
} else {
    Write-Host "Setup complete! Run 'npm start' when ready to begin." -ForegroundColor Green
}

Read-Host "Press Enter to exit..."