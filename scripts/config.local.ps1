# Configuration PowerShell pour scripts Windows
# Équivalent de config.local.sh pour PowerShell

$SERVER_HOST = "192.168.1.155"
$SERVER_USER = "thomas"
$SERVER_PROJECT_PATH = "/home/thomas/ygg-stremio-ad"
$LOCAL_PROJECT_PATH = "c:\Users\ThomasPRUDHOMME\Visual Studio Code\Y"
$SERVER_URL = "https://$SERVER_HOST:5000"

# Configuration SSH (optionnel)
$SSH_OPTIONS = "-o ConnectTimeout=10"

Write-Host "📝 Configuration PowerShell chargée" -ForegroundColor Green