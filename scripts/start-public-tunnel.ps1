param(
  [int]$LocalPort = 8787,
  [string]$TunnelUser = "nokey@localhost.run"
)

$out = Join-Path $env:TEMP "lhr-tunnel.out"
$err = Join-Path $env:TEMP "lhr-tunnel.err"
Remove-Item -LiteralPath $out, $err -Force -ErrorAction SilentlyContinue

$args = @(
  "-o", "StrictHostKeyChecking=no",
  "-o", "UserKnownHostsFile=NUL",
  "-o", "ConnectTimeout=15",
  "-o", "ExitOnForwardFailure=yes",
  "-o", "ServerAliveInterval=60",
  "-R", "80:localhost:$LocalPort",
  $TunnelUser
)

$process = Start-Process -FilePath "ssh.exe" -ArgumentList $args -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
Start-Sleep -Seconds 8
Write-Output "PID=$($process.Id)"
Write-Output "--- stdout ---"
if (Test-Path -LiteralPath $out) { Get-Content -LiteralPath $out }
Write-Output "--- stderr ---"
if (Test-Path -LiteralPath $err) { Get-Content -LiteralPath $err }
