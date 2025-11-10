# 📋 Guide des Scripts YGG Stremio Add-on

## 🔧 Configuration

### `config.sh`
**Rôle** : Configuration centralisée pour tous les scripts  
**Utilité** : Définit les variables d'environnement par défaut (exemples)  
**Usage** : Chargé automatiquement par les autres scripts  
```bash
# Variables définies :
SERVER_HOST="192.168.1.100"      # IP du serveur (exemple)
SERVER_USER="user"               # Utilisateur SSH (exemple)
SERVER_PROJECT_PATH="/home/user/ygg-stremio-ad"    # Chemin distant
LOCAL_PROJECT_PATH="/path/to/local/project"        # Chemin local
```

### `config.local.sh` ⭐
**Rôle** : Configuration personnelle (non versionnée)  
**Utilité** : Contient VOS vraies informations de serveur  
**Usage** : Copier depuis `config.local.sh.example` et personnaliser  
```bash
# Exemple de contenu :
SERVER_HOST="192.168.1.155"      # VOTRE IP
SERVER_USER="thomas"             # VOTRE utilisateur
```

### `config.local.sh.example`
**Rôle** : Modèle de configuration personnelle  
**Utilité** : Template pour créer votre config.local.sh  
**Usage** : `cp config.local.sh.example config.local.sh`

---

## 🚀 Scripts de Déploiement

### `deploy-smart.sh` ⭐ (NOUVEAU)
**Rôle** : Déploiement intelligent multi-environnement  
**Utilité** : Détecte automatiquement où déployer (local vs Koyeb)  
**Usage** : 
```bash
./scripts/deploy-smart.sh        # Auto-détection
./scripts/deploy-smart.sh local  # Force serveur local
./scripts/deploy-smart.sh koyeb  # Force préparation Koyeb
```

### `deploy-local.sh`
**Rôle** : Déploiement classique sur serveur local  
**Utilité** : Deploy après commit vers votre serveur 192.168.1.155  
**Usage** : 
```bash
./scripts/deploy-local.sh        # Deploy production locale
ygg-deploy-local                 # Alias
```

### `sync-and-test.sh`
**Rôle** : Synchronisation rapide pour développement  
**Utilité** : Test immédiat sans commit (rsync + restart)  
**Usage** : 
```bash
./scripts/sync-and-test.sh       # Sync rapide
ygg-sync                         # Alias
```

---

## 🧪 Scripts de Test

### `test-remote.sh`
**Rôle** : Test complet sur serveur distant  
**Utilité** : Build complet + tests sur serveur (sans commit)  
**Usage** : 
```bash
./scripts/test-remote.sh         # Test complet
ygg-test                         # Alias
```

### `test-search.sh`
**Rôle** : Test de recherche spécifique  
**Utilité** : Teste la recherche pour un IMDB ID précis  
**Usage** : 
```bash
./scripts/test-search.sh tt0283226 4 17    # Test épisode S04E17
./scripts/test-search.sh tt0098749         # Test film
```

### `test-strategy.sh`
**Rôle** : Test des stratégies de recherche  
**Utilité** : Compare différentes approches (épisode → saison → série)  
**Usage** : 
```bash
./scripts/test-strategy.sh       # Test stratégies automatiques
```

---

## 📊 Scripts de Monitoring

### `logs.sh`
**Rôle** : Affichage des logs en temps réel  
**Utilité** : Suit les logs du conteneur Docker distant  
**Usage** : 
```bash
./scripts/logs.sh                # Logs temps réel
ygg-logs                         # Alias
```

### `test-log-level.sh`
**Rôle** : Test avec niveau de log spécifique  
**Utilité** : Redémarre avec un niveau de log pour debug  
**Usage** : 
```bash
./scripts/test-log-level.sh debug    # Test avec logs debug
./scripts/test-log-level.sh silly    # Ultra-détaillé
```

### `set-log-level.sh`
**Rôle** : Change le niveau de log à chaud  
**Utilité** : Modifie docker-compose.override.yml  
**Usage** : 
```bash
./scripts/set-log-level.sh info      # Niveau standard
./scripts/set-log-level.sh debug     # Niveau développement
```

---

## ☁️ Scripts Koyeb (NOUVEAUX)

### `koyeb-helper.sh` ⭐
**Rôle** : Aide pour déploiement Koyeb  
**Utilité** : Config, test et troubleshooting Koyeb  
**Usage** : 
```bash
./scripts/koyeb-helper.sh config           # Config recommandée
./scripts/koyeb-helper.sh test             # Test image Docker
./scripts/koyeb-helper.sh urls mydomain    # URLs d'accès
./scripts/koyeb-helper.sh troubleshoot     # Guide debug
ygg-koyeb                                  # Alias
```

---

## 🎯 Workflow Recommandé

### 1. **Configuration initiale**
```bash
# 1. Copier la configuration
cp scripts/config.local.sh.example scripts/config.local.sh

# 2. Éditer avec vos infos
nano scripts/config.local.sh

# 3. Setup initial
./setup.sh
```

### 2. **Développement quotidien**
```bash
# Développement rapide (sans commit)
ygg-sync                         # Sync + test

# Test spécifique 
./scripts/test-search.sh tt0283226 4 17

# Voir les logs
ygg-logs
```

### 3. **Déploiement production**
```bash
# Auto-détection (recommandé)
ygg-deploy

# Ou spécifique
./scripts/deploy-smart.sh local     # Serveur local
./scripts/deploy-smart.sh koyeb     # Cloud Koyeb
```

### 4. **Debug et troubleshooting**
```bash
# Changer niveau de log
./scripts/set-log-level.sh debug

# Test avec logs détaillés
./scripts/test-log-level.sh verbose

# Aide Koyeb
ygg-koyeb troubleshoot
```

---

## 📁 Hiérarchie des Scripts

```
scripts/
├── 🔧 Configuration
│   ├── config.sh                 # Config par défaut (exemples)
│   ├── config.local.sh.example   # Template personnalisable
│   └── config.local.sh           # VOTRE config (non versionnée)
│
├── 🚀 Déploiement
│   ├── deploy-smart.sh           # ⭐ Intelligent (auto-détection)
│   ├── deploy-local.sh           # Classique serveur local
│   └── sync-and-test.sh          # Sync rapide développement
│
├── 🧪 Tests
│   ├── test-remote.sh            # Test complet distant
│   ├── test-search.sh            # Test recherche spécifique
│   └── test-strategy.sh          # Test stratégies
│
├── 📊 Monitoring
│   ├── logs.sh                   # Logs temps réel
│   ├── test-log-level.sh         # Test avec niveau spécifique
│   └── set-log-level.sh          # Change niveau à chaud
│
└── ☁️ Koyeb
    └── koyeb-helper.sh           # ⭐ Aide Koyeb complète
```

## 🔑 Points Clés

- ✅ **Aucune info personnelle** dans les scripts versionnés
- ✅ **Configuration centralisée** via config.local.sh
- ✅ **Multi-environnement** : local + Koyeb
- ✅ **Auto-détection** intelligente
- ✅ **Workflow optimisé** pour développement + production