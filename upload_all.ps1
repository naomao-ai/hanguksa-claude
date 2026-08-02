# 업로드 대기열(upload_queue.json)에 있는 5개 회차를 모두 업로드하는 스크립트입니다.
# npm 환경 변수가 설정되지 않은 터미널에서도 동작하도록 로컬에 내장된 Node.js를 직접 호출합니다.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
[System.Console]::InputEncoding = [System.Text.Encoding]::UTF8

$NODE_EXE = "C:\Users\naoma\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages\playwright\driver\node.exe"
$NODE_ARGS = @("--env-file=.env.local", "--experimental-strip-types", "scripts/import-exam.ts")

Write-Host "제70회 심화 업로드 시작..."
& $NODE_EXE $NODE_ARGS --json _import/70s/analysis.json --images _import/70s/pages --upload --replace-round --release "제70회 한국사능력검정시험 심화"
if ($LASTEXITCODE -ne 0) { Write-Error "70회 심화 업로드 실패"; exit $LASTEXITCODE }

Write-Host "제69회 심화 업로드 시작..."
& $NODE_EXE $NODE_ARGS --json _import/69s/analysis.json --images _import/69s/pages --upload --replace-round --release "제69회 한국사능력검정시험 심화"
if ($LASTEXITCODE -ne 0) { Write-Error "69회 심화 업로드 실패"; exit $LASTEXITCODE }

Write-Host "제68회 심화 업로드 시작..."
& $NODE_EXE $NODE_ARGS --json _import/68s/analysis.json --images _import/68s/pages --upload --replace-round --release "제68회 한국사능력검정시험 심화"
if ($LASTEXITCODE -ne 0) { Write-Error "68회 심화 업로드 실패"; exit $LASTEXITCODE }

Write-Host "제60회 심화 업로드 시작..."
& $NODE_EXE $NODE_ARGS --json _import/60s/analysis.json --images _import/60s/pages --upload --replace-round --release "제60회 한국사능력검정시험 심화"
if ($LASTEXITCODE -ne 0) { Write-Error "60회 심화 업로드 실패"; exit $LASTEXITCODE }

Write-Host "제60회 기본 업로드 시작..."
& $NODE_EXE $NODE_ARGS --json _import/60g/analysis.json --images _import/60g/pages --upload --replace-round --release "제60회 한국사능력검정시험 기본"
if ($LASTEXITCODE -ne 0) { Write-Error "60회 기본 업로드 실패"; exit $LASTEXITCODE }

Write-Host "모든 업로드가 완료되었습니다. 스크립트 실행 후 verify-live-images.mjs 로 최종 검증을 권장합니다."
