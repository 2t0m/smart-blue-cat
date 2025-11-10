# Script PowerShell pour sync-and-test depuis Windows
param(
    [string]$ConfigPath = "scripts\config.local.ps1"
)

Write-Host "Test rapide sur serveur distant (sans commit)..." -ForegroundColor Green

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

# Synchronisation TOUS les fichiers (même non committés)
Write-Host "Synchronisation des modifications locales..." -ForegroundColor Cyan

try {
    # Méthode 1 : Rsync si disponible (comme le script bash)
    if (Get-Command rsync -ErrorAction SilentlyContinue) {
        Write-Host "Utilisation de rsync pour synchronisation directe..." -ForegroundColor Yellow
        rsync -avz --exclude='node_modules' --exclude='.git' --exclude='data' `
            "$LOCAL_PROJECT_PATH/" `
            "$SERVER_USER@$SERVER_HOST`:$SERVER_PROJECT_PATH/"
        
        Write-Host "Restart rapide du service..." -ForegroundColor Yellow
        $needGitPull = $false
    } else {
        # Méthode 2 : Git commit temporaire (fallback Windows)
        Write-Host "Rsync non disponible, utilisation de Git..." -ForegroundColor Yellow
        
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
            
            if ($LASTEXITCODE -ne 0) {
                Write-Host "Erreur lors du push GitHub" -ForegroundColor Red
                return
            }
            
            # Ajouter un git pull dans la commande SSH
            $needGitPull = $true
        } else {
            Write-Host "Aucun changement detecte, restart uniquement..." -ForegroundColor Blue
            $needGitPull = $false
        }
    }
    
    # Restart sur le serveur (comme le script bash)
    if ($needGitPull) {
        $deployCommand = @'
cd /home/thomas/ygg-stremio-ad
echo "=== Git pull ==="
git pull origin main
echo "=== Arret conteneur ==="
docker-compose down
echo "=== Redemarrage avec build ==="
docker-compose up -d --build
echo "=== Attente (10s) ==="
sleep 10
echo "=== Status ==="
docker-compose ps
echo "=== Logs de demarrage ==="
docker-compose logs --tail=25 ygg-stremio-ad
echo "=== Redemarrage termine ==="
'@
    } else {
        $deployCommand = @'
cd /home/thomas/ygg-stremio-ad
echo "=== Arret conteneur ==="
docker-compose down
echo "=== Redemarrage avec build ==="
docker-compose up -d --build
echo "=== Attente (10s) ==="
sleep 10
echo "=== Status ==="
docker-compose ps
echo "=== Logs de demarrage ==="
docker-compose logs --tail=25 ygg-stremio-ad
echo "=== Redemarrage termine ==="
'@
    }
        
    ssh "$SERVER_USER@$SERVER_HOST" $deployCommand
    
    Write-Host ""
    Write-Host "Synchronisation terminee" -ForegroundColor Green
    Write-Host "Testez sur : $SERVER_URL" -ForegroundColor Cyan
    Write-Host ""
    
    # Proposer de voir les logs en temps réel (comme le script bash)
    $showLogs = Read-Host "Voulez-vous voir les logs en temps reel ? (o/N)"
    if ($showLogs -match '^[oO].*') {
        Write-Host "Logs en temps reel (Ctrl+C pour quitter)..." -ForegroundColor Yellow
        $logsCommand = "cd /home/thomas/ygg-stremio-ad && docker-compose logs -f ygg-stremio-ad"
        ssh -t "$SERVER_USER@$SERVER_HOST" $logsCommand
    }
} catch {
    Write-Host "Erreur lors de la synchronisation : $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Commandes alternatives :" -ForegroundColor Cyan
Write-Host "  Git Bash    : ./scripts/sync-and-test.sh" -ForegroundColor Gray
Write-Host "  WSL         : wsl ./scripts/sync-and-test.sh" -ForegroundColor Gray
Write-Host "  PowerShell  : .\scripts\sync-and-test.ps1" -ForegroundColor Gray