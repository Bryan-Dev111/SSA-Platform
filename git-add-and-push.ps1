# Workaround for "fatal: unable to write new index file" when .git/index is locked.
# Uses a temp index file so "git add" can run. You still need .git to be writable for commit/push.
# Run from project root: .\git-add-and-push.ps1

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$tempIndex = Join-Path $env:TEMP "sentinel-git-index-$([guid]::NewGuid().ToString('n').Substring(0,8))"

Push-Location $projectRoot
try {
    $env:GIT_INDEX_FILE = $tempIndex
    Write-Host "Staging with temp index..."
    git read-tree HEAD
    git add .
    git reset HEAD -- temp-index 2>$null
    git reset HEAD -- "git-add-and-push.ps1" 2>$null
    Write-Host "Staged. Attempting commit..."
    git commit -m "Week 2 Day 1: Audits and Findings CRUD, UI, permissions, date and status fixes"
    Write-Host "Pushing..."
    git push origin main
    Write-Host "Done."
} catch {
    Write-Host "Error: $_"
    if ($_.Exception.Message -match "couldn't set 'refs") {
        Write-Host ""
        Write-Host "Git cannot write to .git (e.g. refs/heads/main). Try:"
        Write-Host "  1. Close Cursor and any other app using this repo, then run this script again."
        Write-Host "  2. Add this folder to Windows Defender/antivirus exclusions."
        Write-Host "  3. Copy the repo to C:\Sentinel-push and run: cd C:\Sentinel-push; git add .; git commit -m '...'; git push"
    }
} finally {
    Remove-Item $tempIndex -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $env:TEMP "sentinel-git-index-*") -Force -ErrorAction SilentlyContinue
    $env:GIT_INDEX_FILE = $null
    Pop-Location
}
