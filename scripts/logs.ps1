# Script PowerShell pour voir les logs depuis Windows
param(
    [string]$ConfigPath = "scripts\config.local.ps1",
    [switch]$Follow = $true,
    [int]$Lines = 50
)

Write-Host "📋 Logs YGG Stremio depuis Windows" -ForegroundColor Green

# Charger la configuration
if (Test-Path $ConfigPath) {
    . $ConfigPath
} else {
    $SERVER_HOST = "192.168.1.155"
    $SERVER_USER = "thomas"
    $SERVER_PROJECT_PATH = "/home/thomas/ygg-stremio-ad"
}

Write-Host "🔗 Connexion à $SERVER_HOST..." -ForegroundColor Cyan

try {
    if ($Follow) {
        Write-Host "📺 Logs en temps réel (Ctrl+C pour quitter)..." -ForegroundColor Yellow
        $logsCommand = "cd $SERVER_PROJECT_PATH && docker-compose -f docker-compose.local.yml logs -f ygg-stremio-ad-local"
    } else {
        Write-Host "📄 Dernières $Lines lignes..." -ForegroundColor Yellow
        $logsCommand = "cd $SERVER_PROJECT_PATH && docker-compose -f docker-compose.local.yml logs --tail=$Lines ygg-stremio-ad-local"
    }
    
    ssh -t "$SERVER_USER@$SERVER_HOST" $logsCommand
    
} catch {
    Write-Host "❌ Erreur de connexion : $_" -ForegroundColor Red
    Write-Host "💡 Vérifiez votre configuration SSH" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🔧 Options disponibles :" -ForegroundColor Cyan
Write-Host "  .\scripts\logs.ps1              → Logs en temps réel" -ForegroundColor Gray
Write-Host "  .\scripts\logs.ps1 -Follow:`$false → Logs statiques" -ForegroundColor Gray
Write-Host "  .\scripts\logs.ps1 -Lines 100   → 100 dernières lignes" -ForegroundColor Gray