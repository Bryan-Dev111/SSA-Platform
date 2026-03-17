# Push Sentinel code to GitHub (main branch)
# Run this in PowerShell from the project folder: .\push-to-github.ps1

Set-Location $PSScriptRoot

Write-Host "Staging all files..." -ForegroundColor Cyan
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: git add failed. Close other apps using this folder and try again." -ForegroundColor Red
    exit 1
}

Write-Host "Creating initial commit..." -ForegroundColor Cyan
git commit -m "Initial commit: Sentinel Supplier Assurance Platform"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: git commit failed." -ForegroundColor Red
    exit 1
}

Write-Host "Pushing to origin main..." -ForegroundColor Cyan
git push -u origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "If push failed due to auth, use: git push -u origin main" -ForegroundColor Yellow
    Write-Host "You may be prompted for GitHub username and password/token." -ForegroundColor Yellow
    exit 1
}

Write-Host "Done. Code is on https://github.com/bryandev91/SSA-Platform" -ForegroundColor Green
