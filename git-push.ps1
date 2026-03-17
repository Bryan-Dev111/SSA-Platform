# Always-use script: add, commit, push without "unable to write new index file".
# Run: .\git-push.ps1 "Your commit message"
# Or: .\git-push.ps1   (uses default message)

param([string]$Msg = "Update SSA Platform")
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$idx = "$env:TEMP\ssa-git-index"
$env:GIT_INDEX_FILE = $idx
try {
    git read-tree HEAD
    git add .
    git commit -m $Msg
    $env:GIT_INDEX_FILE = $null
    Copy-Item -Force $idx ".git\index"
    git push origin main
    Write-Host "Done. Pushed to origin main." -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
} finally {
    $env:GIT_INDEX_FILE = $null
    Remove-Item $idx -Force -ErrorAction SilentlyContinue
}
