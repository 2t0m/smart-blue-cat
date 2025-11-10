# Script PowerShell pour sync-and-test depuis Windows
param(
    [string]$ConfigPath = "scripts\config.local.ps1"
)

Write-Host "Sync-and-test depuis Windows..." -ForegroundColor Green

# Charger la configuration
if (Test-Path $ConfigPath) {
    . $ConfigPath
    Write-Host "Configuration chargee depuis $ConfigPath" -ForegroundColor Cyan
} else {
    # Configuration par défaut si pas de fichier config
    $SERVER_HOST = "192.168.1.155"
    $SERVER_USER = "thomas"
    $SERVER_PROJECT_PATH = "/home/thomas/ygg-stremio-ad"
    $LOCAL_PROJECT_PATH = "c:\Users\ThomasPRUDHOMME\Visual Studio Code\Y"
    $SERVER_URL = "https://$SERVER_HOST:5000"
    
    Write-Host "Config par defaut utilisee. Creez $ConfigPath pour personnaliser" -ForegroundColor Yellow
}

# Synchronisation via Git
Write-Host "Synchronisation via Git..." -ForegroundColor Cyan

try {
    # Vérifier s'il y a des changements
    $changes = git status --porcelain
    
    if ($changes) {
        Write-Host "Changements detectes, commit temporaire..." -ForegroundColor Yellow
        git add .
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        git commit -m "WIP: Sync-and-test from Windows - $timestamp"
        
        # Push vers le serveur
        Write-Host "Push vers GitHub..." -ForegroundColor Cyan
        git push origin main
        
        # Pull sur le serveur et restart
        Write-Host "Deploiement sur le serveur..." -ForegroundColor Yellow
        
        $sshCommand = @"
cd $SERVER_PROJECT_PATH
echo "Git pull..."
git pull origin main
echo "Arret conteneurs..."
docker-compose -f docker-compose.local.yml down
echo "Redemarrage..."
docker-compose -f docker-compose.local.yml up -d --build
echo "Attente 8s..."
sleep 8
echo "Status:"
docker-compose -f docker-compose.local.yml ps
echo "Logs recents:"
docker-compose -f docker-compose.local.yml logs --tail=15 ygg-stremio-ad-local
echo "Sync termine !"
"@
        
        ssh "$SERVER_USER@$SERVER_HOST" $sshCommand
        
        Write-Host "Synchronisation terminee !" -ForegroundColor Green
        Write-Host "Testez sur : $SERVER_URL" -ForegroundColor Cyan
        
    } else {
        Write-Host "Aucun changement detecte" -ForegroundColor Blue
    }
    
} catch {
    Write-Host "Erreur lors de la synchronisation : $_" -ForegroundColor Red
    
    # Fallback : méthode alternative
    Write-Host "Tentative avec methode alternative..." -ForegroundColor Yellow
    Write-Host "Veuillez committer manuellement et utiliser deploy.ps1" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Commandes alternatives :" -ForegroundColor Cyan
Write-Host "  Git Bash    : ./scripts/sync-and-test.sh" -ForegroundColor Gray
Write-Host "  WSL         : wsl ./scripts/sync-and-test.sh" -ForegroundColor Gray
Write-Host "  PowerShell  : .\scripts\sync-and-test.ps1" -ForegroundColor Gray