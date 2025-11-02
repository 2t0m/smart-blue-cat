# 🛠️ Guide de développement YGG Stremio AD

## 🏗️ Architecture avec Override

```
Mac (VS Code) ──sync──→ Serveur (192.168.1.155) ──build──→ Test
      ↓                          ↓
   Git commit              docker-compose.override.yml
      ↓                          ↓
   GitHub Push             Build local + LOG_LEVEL=INFO
```

## 📁 Structure des dossiers

### Sur le serveur (192.168.1.155)
- **Code source :** `/home/thomas/ygg-stremio-ad/` (projet principal)
- **Données persistantes :** `/docker_data/ygg-stremio-ad/data/` (base SQLite, logs, etc.)
- **Docker override :** Active automatiquement le build local

### Sur Mac (développement)
- **Code source :** `/Users/thomas/Visual Studio Code/ygg-stremio-ad/`
- **Scripts :** `./scripts/` (deploy, test, sync, logs)

## 📁 Configuration des fichiers

### `docker-compose.yml` (Production)
- Image pré-buildée : `ghcr.io/2t0m/ygg-stremio-ad:latest`
- LOG_LEVEL: ERROR
- Volume: MY_PATH (à configurer)

### `docker-compose.override.yml` (Développement/Test)
- Build local avec `build: .`
- LOG_LEVEL: INFO (plus verbeux)
- Volume: `/docker_data/ygg-stremio-ad/data:/data` (données persistantes)
- Port: 5000:5000

## 🚀 Workflow de développement

### 1. Test rapide (modifications en cours)
```bash
# Synchronise TOUT (même non-committé) et teste
ygg-sync
```
**Usage:** Pour tester rapidement une modification sans faire de commit

### 2. Test complet (code propre)
```bash
# Synchronise, build et teste avec vérifications
ygg-test
```
**Usage:** Avant de faire un commit, pour valider que tout fonctionne

### 3. Déploiement (après commit)
```bash
# Commit → Push GitHub → Deploy serveur
git add .
git commit -m "feat: nouvelle fonctionnalité"
ygg-deploy
```
**Usage:** Déploiement final après validation

### 4. Monitoring
```bash
# Logs en temps réel
ygg-logs

# Connexion serveur
ygg-server
```

## 🔧 Structure du projet

### Mac (local)
```
ygg-stremio-ad/
├── index.js                    # Point d'entrée Express
├── package.json                # Dépendances Node.js
├── Dockerfile                  # Image de production
├── docker-compose.yml          # Config production
├── docker-compose.override.yml # Config dev/test
├── routes/                     # Routes Express
├── services/                   # Services métier
├── utils/                      # Utilitaires
├── public/                     # Assets statiques
└── scripts/                    # Scripts de développement
    ├── deploy-local.sh         # Déploiement après commit
    ├── test-remote.sh          # Test complet
    ├── sync-and-test.sh        # Sync rapide
    └── logs.sh                 # Monitoring
```

### Serveur (192.168.1.155)
```
/home/thomas/ygg-stremio-ad/    # ← Code source (synchronisé depuis Mac)
├── docker-compose.yml          # Config de base
├── docker-compose.override.yml # Override pour dev (build local)
└── [tous les fichiers du projet]

/docker_data/ygg-stremio-ad/    # ← Données persistantes
└── data/                       # Base SQLite, logs, cache
```

## 🎯 Commandes utiles

### Développement local
```bash
# Installation des dépendances
npm install

# Test local (sans Docker)
npm start

# Test local avec Docker
docker-compose up --build
```

### Tests sur serveur distant
```bash
# Test ultra-rapide (sans commit)
ygg-sync

# Test complet avec vérifications
ygg-test

# Déploiement après validation
ygg-deploy
```

### Monitoring et debug
```bash
# Logs en continu
ygg-logs

# Status des conteneurs
ygg-server
docker-compose ps

```bash
# Restart manuel
ygg-server
cd /home/thomas/ygg-stremio-ad
docker-compose restart
```
```

## 🐛 Troubleshooting

### Problèmes courants

**Port 5000 occupé:**
```bash
ygg-server
docker-compose down
docker-compose up -d
```

**Build qui échoue:**
```bash
ygg-server
cd /home/thomas/ygg-stremio-ad
docker-compose down
docker system prune -f
docker-compose up --build
```

**Sync qui échoue:**
```bash
# Vérifier la connexion SSH
ssh thomas@192.168.1.155

# Vérifier les permissions
ygg-server
ls -la /home/thomas/ygg-stremio-ad
```

### Logs importants
- **Application:** `ygg-logs`
- **Docker:** `docker-compose logs`
- **Système:** `journalctl -f`

## 🌐 URLs importantes

- **Local:** http://localhost:5000
- **Serveur:** http://192.168.1.155:5000
- **Manifest:** http://192.168.1.155:5000/manifest.json
- **GitHub:** https://github.com/2t0m/ygg-stremio-ad

## ⚙️ Variables d'environnement

### Production (`docker-compose.yml`)
```yaml
LOG_LEVEL: ERROR
CUSTOM_SEARCH_KEYWORDS: "tt0098749=keyword"
```

### Développement (`docker-compose.override.yml`)
```yaml
LOG_LEVEL: INFO
CUSTOM_SEARCH_KEYWORDS: "tt0098749=Loki"
```