# Script PowerShell rapide pour voir les logs
param(
    [switch]$Follow = $true,
    [int]$Tail = 50
)

# Charger la config
if (Test-Path "scripts\config.local.ps1") {
    . "scripts\config.local.ps1"
} else {
    $SERVER_HOST = "192.168.1.155"
    $SERVER_USER = "thomas"
    $SERVER_PROJECT_PATH = "/home/thomas/ygg-stremio-ad"
}

Write-Host "Logs YGG Stremio depuis $SERVER_HOST" -ForegroundColor Green

if ($Follow) {
    Write-Host "Logs en temps reel (Ctrl+C pour quitter)..." -ForegroundColor Yellow
    $cmd = "cd $SERVER_PROJECT_PATH && docker-compose -f docker-compose.local.yml logs -f ygg-stremio-ad-local"
    ssh -t "$SERVER_USER@$SERVER_HOST" $cmd
} else {
    Write-Host "Dernieres $Tail lignes..." -ForegroundColor Yellow
    $cmd = "cd $SERVER_PROJECT_PATH && docker-compose -f docker-compose.local.yml logs --tail=$Tail ygg-stremio-ad-local"
    ssh "$SERVER_USER@$SERVER_HOST" $cmd
}