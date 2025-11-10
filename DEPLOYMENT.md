# 🚀 YGG Stremio Add-on - Guide de déploiement multi-environnement

Ce projet supporte maintenant **deux environnements de déploiement** avec détection automatique :

## 🏠 Serveur Local (192.168.1.155)
- **SSL** : Activé avec certificats auto-téléchargés
- **Base de données** : `/data` (stockage persistant)
- **Port** : 5000 (HTTPS)

## ☁️ Koyeb Cloud
- **SSL** : Géré par la plateforme  
- **Base de données** : `/tmp` (temporaire)
- **Port** : 8000 (HTTP → HTTPS par Koyeb)

---

## 🛠️ Commandes de déploiement

### Déploiement automatique (recommandé)
```bash
# Détection automatique de l'environnement
./scripts/deploy-smart.sh

# Forcer un environnement spécifique
./scripts/deploy-smart.sh local   # → Serveur 192.168.1.155
./scripts/deploy-smart.sh koyeb   # → Préparation Koyeb
```

### Commandes spécialisées
```bash
# Serveur local (existant)
ygg-deploy                        # Déploiement classique local
ygg-sync                         # Test rapide local

# Aide Koyeb
./scripts/koyeb-helper.sh config    # Configuration recommandée
./scripts/koyeb-helper.sh test      # Test image Docker
./scripts/koyeb-helper.sh urls <domain>  # URLs d'accès
```

---

## ⚙️ Configuration par environnement

### Variables d'environnement communes
```bash
# Détection d'environnement
DEPLOYMENT_TARGET=local|koyeb|docker

# Application 
TMDB_API_KEY=your_key
API_KEY_ALLEDBRID=your_key
SHAREWOOD_PASSKEY=your_key
CUSTOM_SEARCH_KEYWORDS=tt0098749=keyword
```

### Spécifique Serveur Local
```bash
PORT=5000
LOG_LEVEL=debug
BASE_URL=https://192.168.1.155:5000
```

### Spécifique Koyeb
```bash
PORT=8000
LOG_LEVEL=info
# BASE_URL auto-détecté via KOYEB_PUBLIC_DOMAIN
```

---

## 📁 Structure des fichiers

```
ygg-stremio-ad/
├── docker-compose.yml           # Configuration générique
├── docker-compose.local.yml     # Configuration serveur local
├── docker-compose.koyeb.yml     # Configuration Koyeb
├── utils/environment.js         # Détection d'environnement
├── init-ssl.sh                  # Setup SSL intelligent
└── scripts/
    ├── deploy-smart.sh          # Déploiement intelligent
    ├── koyeb-helper.sh          # Aide Koyeb
    └── [autres scripts existants]
```

---

## 🔧 Workflow de développement

### 1. Développement local avec serveur distant
```bash
# Modifications rapides (sans commit)
ygg-sync

# Test avec niveau de log spécifique  
./scripts/test-log-level.sh debug

# Recherche spécifique
./scripts/test-search.sh tt0283226 4 17
```

### 2. Déploiement production
```bash
# Auto-détection (recommandé)
./scripts/deploy-smart.sh

# Ou forcer l'environnement
./scripts/deploy-smart.sh local   # Serveur local
./scripts/deploy-smart.sh koyeb   # Cloud Koyeb
```

---

## ☁️ Guide spécifique Koyeb

### 1. Préparation
```bash
./scripts/deploy-smart.sh koyeb
```

### 2. Configuration sur Koyeb
```bash
# Voir la config recommandée
./scripts/koyeb-helper.sh config

# Tester l'image localement 
./scripts/koyeb-helper.sh test
```

### 3. Déploiement sur Koyeb
1. Créer une app sur https://app.koyeb.com/
2. Image : `ghcr.io/2t0m/ygg-stremio-ad:latest`
3. Variables d'environnement (voir config recommandée)
4. Health check : `/health` sur port 8000
5. Déployer !

### 4. URLs d'accès
```bash
./scripts/koyeb-helper.sh urls your-app.koyeb.app
```

---

## 🏥 Health Checks

Tous les environnements exposent un endpoint de santé :

```bash
# Local
curl -k https://192.168.1.155:5000/health

# Koyeb  
curl https://your-app.koyeb.app/health
```

Réponse attendue :
```json
{
  "status": "OK",
  "environment": "local|koyeb",
  "timestamp": "2025-11-10T..."
}
```

---

## 🐛 Troubleshooting

### Problèmes courants
```bash
# Guide de dépannage Koyeb
./scripts/koyeb-helper.sh troubleshoot

# Logs détaillés
LOG_LEVEL=debug    # Dans les variables d'environnement
```

### Vérifications rapides
- ✅ Health check répond 
- ✅ Variables d'environnement correctes
- ✅ Image Docker à jour
- ✅ Ports corrects (5000 local, 8000 Koyeb)

---

## 📊 Monitoring

### Logs
```bash
# Local
ygg-logs

# Koyeb
# Via l'interface web Koyeb
```

### Métriques
- Health check status
- Response time
- Database size (local uniquement)
- Memory usage

---

## 🔄 Migration entre environnements

La migration est transparente grâce à la détection automatique :
- **Local → Koyeb** : Database remise à zéro (/tmp)
- **Koyeb → Local** : Database persistante restaurée
- **Configuration** : Identique, seules les variables d'env changent