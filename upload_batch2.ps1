# 업로드 대기열 중 다음 3개 회차(76s, 75s, 74s)를 업로드하는 스크립트입니다.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
[System.Console]::InputEncoding = [System.Text.Encoding]::UTF8

$NODE_EXE = "C:\Users\naoma\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages\playwright\driver\node.exe"
$NODE_ARGS = @("--env-file=.env.local", "--experimental-strip-types", "scripts/import-exam.ts")

Write-Host "제76회 심화 업로드 시작..."
& $NODE_EXE $NODE_ARGS --json _import/76s/analysis.json --images _import/76s/pages --upload --replace-round --release "제76회 한국사능력검정시험 심화"
if ($LASTEXITCODE -ne 0) { Write-Error "76회 심화 업로드 실패"; exit $LASTEXITCODE }

Write-Host "제75회 심화 업로드 시작..."
& $NODE_EXE $NODE_ARGS --json _import/75s/analysis.json --images _import/75s/pages --upload --replace-round --release "제75회 한국사능력검정시험 심화"
if ($LASTEXITCODE -ne 0) { Write-Error "75회 심화 업로드 실패"; exit $LASTEXITCODE }

Write-Host "제74회 심화 업로드 시작..."
& $NODE_EXE $NODE_ARGS --json _import/74s/analysis.json --images _import/74s/pages --upload --replace-round --release "제74회 한국사능력검정시험 심화"
if ($LASTEXITCODE -ne 0) { Write-Error "74회 심화 업로드 실패"; exit $LASTEXITCODE }

Write-Host "모든 업로드가 완료되었습니다. 스크립트 실행 후 verify-live-images.mjs 로 최종 검증을 권장합니다."
