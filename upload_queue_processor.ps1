[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
[System.Console]::InputEncoding = [System.Text.Encoding]::UTF8

$NODE_EXE = "C:\Users\naoma\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages\playwright\driver\node.exe"
$NODE_ARGS = @("--env-file=.env.local", "--experimental-strip-types", "scripts/import-exam.ts")

$queue = Get-Content -Raw -Encoding UTF8 _import/upload_queue.json | ConvertFrom-Json

foreach ($item in $queue) {
    $round = $item.round
    $levelText = if ($item.level -eq "SIMHWA") { "심화" } else { "기본" }
    $dir = $item.dir
    $kind = $item.kind
    $title = "제${round}회 한국사능력검정시험 ${levelText}"

    Write-Host "========== [시작] $title ($dir) =========="
    
    $argsToPass = @("--json", "$dir/analysis.json", "--images", "$dir/pages", "--release", $title)
    
    if ($kind -eq "update") {
        $argsToPass += "--update"
    } else {
        $argsToPass += "--upload"
        $argsToPass += "--replace-round"
    }

    $processArgs = $NODE_ARGS + $argsToPass
    & $NODE_EXE $processArgs

    if ($LASTEXITCODE -ne 0) {
        Write-Error "업로드 실패: $title"
    } else {
        Write-Host "========== [완료] $title =========="
    }
}
Write-Host "모든 대기열 업로드 작업이 완료되었습니다."
