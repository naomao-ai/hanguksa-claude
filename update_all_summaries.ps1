[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
[System.Console]::InputEncoding = [System.Text.Encoding]::UTF8

$NODE_EXE = "C:\Users\naoma\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages\playwright\driver\node.exe"
$NODE_ARGS = @("--env-file=.env.local", "--experimental-strip-types", "scripts/import-exam.ts")

$importDir = "c:\01.claude\hanguksa\_import"
$dirs = Get-ChildItem -Path $importDir -Directory | Where-Object { $_.Name -match "^\d+[gs]?$" }

foreach ($dir in $dirs) {
    $analysisPath = Join-Path $dir.FullName "analysis.json"
    if (Test-Path $analysisPath) {
        Write-Host "업데이트 시작: $($dir.Name)회차..."
        & $NODE_EXE $NODE_ARGS --json $analysisPath --images $dir.FullName --update
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "$($dir.Name)회차 업데이트 실패"
        }
    }
}

Write-Host "모든 회차 업데이트 완료."
