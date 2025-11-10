# Script PowerShell pour déploiement depuis Windows
param(
    [ValidateSet("auto", "local", "koyeb")]
    [string]$Environment = "auto",
    
    [string]$ConfigPath = "scripts\config.local.ps1"
)

Write-Host "🚀 Déploiement YGG Stremio depuis Windows" -ForegroundColor Green

# Charger la configuration
if (Test-Path $ConfigPath) {
    . $ConfigPath
} else {
    Write-Host "⚠️ Fichier de config non trouvé : $ConfigPath" -ForegroundColor Yellow
    Write-Host "💡 Utilisation de la config par défaut" -ForegroundColor Cyan
    
    $SERVER_HOST = "192.168.1.155"
    $SERVER_USER = "thomas" 
    $SERVER_PROJECT_PATH = "/home/thomas/ygg-stremio-ad"
    $SERVER_URL = "https://$SERVER_HOST:5000"
}

Write-Host "🎯 Environnement cible : $Environment" -ForegroundColor Cyan

# Fonction pour tester la connexion SSH
function Test-SSHConnection {
    try {
        $result = ssh -q -o ConnectTimeout=5 "$SERVER_USER@$SERVER_HOST" "echo 'OK'"
        return $result -eq "OK"
    } catch {
        return $false
    }
}

# Auto-détection de l'environnement
if ($Environment -eq "auto") {
    Write-Host "🔍 Auto-détection de l'environnement..." -ForegroundColor Yellow
    
    if (Test-SSHConnection) {
        $Environment = "local"
        Write-Host "✅ Serveur local détecté" -ForegroundColor Green
    } else {
        $Environment = "koyeb"
        Write-Host "☁️ Déploiement Koyeb recommandé" -ForegroundColor Cyan
    }
}

# Vérifier le statut Git
$gitStatus = git status --porcelain 2>$null
if ($gitStatus) {
    Write-Host "⚠️ Changements non committés détectés" -ForegroundColor Yellow
    
    if ($Environment -eq "local") {
        Write-Host "❌ Déploiement local nécessite un commit propre" -ForegroundColor Red
        Write-Host "💡 Utilisez sync-and-test.ps1 pour les tests rapides" -ForegroundColor Cyan
        return
    }
}

switch ($Environment) {
    "local" {
        Write-Host "🏠 Déploiement sur serveur local..." -ForegroundColor Yellow
        
        # Push vers GitHub
        Write-Host "📤 Push vers GitHub..." -ForegroundColor Cyan
        git push origin main
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Erreur lors du push" -ForegroundColor Red
            return
        }
        
        # SSH et déploiement
        Write-Host "🔄 Déploiement sur $SERVER_HOST..." -ForegroundColor Yellow
        
        $deployCommand = @"
cd $SERVER_PROJECT_PATH || { echo "❌ Dossier projet non trouvé"; exit 1; }
echo "📥 Git pull..."
git pull origin main
echo "🛑 Arrêt conteneurs..."
docker-compose -f docker-compose.local.yml down
echo "🚀 Redémarrage..."
docker-compose -f docker-compose.local.yml up -d --build
echo "⏳ Attente..."
sleep 10
echo "📋 Status:"
docker-compose -f docker-compose.local.yml ps
docker-compose -f docker-compose.local.yml logs --tail=20 ygg-stremio-ad-local
echo "✅ Déploiement terminé !"
"@
        
        ssh "$SERVER_USER@$SERVER_HOST" $deployCommand
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "🎉 Déploiement local réussi !" -ForegroundColor Green
            Write-Host "🌐 URL : $SERVER_URL" -ForegroundColor Cyan
        } else {
            Write-Host "❌ Échec du déploiement" -ForegroundColor Red
        }
    }
    
    "koyeb" {
        Write-Host "☁️ Préparation pour déploiement Koyeb..." -ForegroundColor Yellow
        
        # Commit si nécessaire
        if ($gitStatus) {
            Write-Host "📝 Commit automatique des changements..." -ForegroundColor Cyan
            git add .
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            git commit -m "Deploy: Prepare for Koyeb - $timestamp"
        }
        
        # Push vers GitHub
        Write-Host "📤 Push vers GitHub..." -ForegroundColor Cyan
        git push origin main
        
        Write-Host "✅ Préparation terminée !" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Prochaines étapes sur Koyeb :" -ForegroundColor Cyan
        Write-Host "   1. Aller sur https://app.koyeb.com/" -ForegroundColor White
        Write-Host "   2. Créer une nouvelle app" -ForegroundColor White  
        Write-Host "   3. Image : ghcr.io/2t0m/ygg-stremio-ad:latest" -ForegroundColor White
        Write-Host "   4. Variables d'environnement :" -ForegroundColor White
        Write-Host "      DEPLOYMENT_TARGET=koyeb" -ForegroundColor Gray
        Write-Host "      PORT=8000" -ForegroundColor Gray
        Write-Host "      LOG_LEVEL=info" -ForegroundColor Gray
        Write-Host "      [vos clés API]" -ForegroundColor Gray
        Write-Host "   5. Health check : /health" -ForegroundColor White
        Write-Host ""
        Write-Host "💡 Pour plus d'aide : .\scripts\koyeb-helper.ps1" -ForegroundColor Cyan
    }
    
    default {
        Write-Host "❌ Environnement non reconnu : $Environment" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🔧 Autres commandes PowerShell :" -ForegroundColor Cyan
Write-Host "  .\scripts\sync-and-test.ps1    → Test rapide" -ForegroundColor Gray
Write-Host "  .\scripts\deploy.ps1 local     → Force déploiement local" -ForegroundColor Gray
Write-Host "  .\scripts\deploy.ps1 koyeb     → Force préparation Koyeb" -ForegroundColor Gray