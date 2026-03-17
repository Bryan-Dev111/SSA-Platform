# Add, commit, and push. Uses normal git; fallback if "unable to write new index file".
# Run from project root: .\git-add-and-push.ps1
# Optional: pass a commit message: .\git-add-and-push.ps1 -Message "Your message"

param([string]$Message = "Update: SSA Platform")

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
Push-Location $projectRoot

function Push-Git {
    git add . 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { return $false }
    git commit -m $Message 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { return $false }
    git push origin main 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
}

try {
    Write-Host "Staging and committing..." -ForegroundColor Cyan
    if (Push-Git) {
        Write-Host "Done. Pushed to origin main." -ForegroundColor Green
        Pop-Location
        exit 0
    }

    # Fallback: if .git/index is missing or locked, recreate it then retry
    if (-not (Test-Path ".git\index")) {
        Write-Host "Recreating .git/index from HEAD..." -ForegroundColor Yellow
        $idx = Join-Path $env:TEMP "ssa-git-index-recover"
        $env:GIT_INDEX_FILE = $idx
        git read-tree HEAD 2>&1 | Out-Null
        if (Test-Path $idx) {
            Copy-Item -Force $idx ".git\index"
            Remove-Item $idx -Force -ErrorAction SilentlyContinue
        }
        $env:GIT_INDEX_FILE = $null
    }

    Write-Host "Retrying with normal git..." -ForegroundColor Cyan
    if (Push-Git) {
        Write-Host "Done. Pushed to origin main." -ForegroundColor Green
        Pop-Location
        exit 0
    }

    # Last resort: temp index for add/commit only (keeps .git/index in sync by copy)
    Write-Host "Using temp index workaround for this run..." -ForegroundColor Yellow
    $tempIndex = Join-Path $env:TEMP "ssa-git-index-$([guid]::NewGuid().ToString('n').Substring(0,8))"
    $env:GIT_INDEX_FILE = $tempIndex
    git read-tree HEAD
    git add .
    git commit -m $Message
    git push origin main
    # Copy temp index back so next time normal git works
    if (Test-Path $tempIndex) {
        Copy-Item -Force $tempIndex ".git\index"
        Remove-Item $tempIndex -Force -ErrorAction SilentlyContinue
    }
    $env:GIT_INDEX_FILE = $null
    Write-Host "Done. Pushed to origin main." -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    if ($_.Exception.Message -match "couldn't set 'refs") {
        Write-Host "Tip: Close Cursor/other apps using this folder, or add E:\SSA-Platform to antivirus exclusions." -ForegroundColor Yellow
    }
    Pop-Location
    exit 1
}
Pop-Location
