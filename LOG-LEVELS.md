# 📋 Guide des niveaux de logging YGG Stremio AD

## 🎯 Niveaux de log disponibles

### **ERROR** (niveau 0) - Production
- ❌ Erreurs critiques uniquement
- API failures, configuration errors
- **Usage :** Production stable

### **WARN** (niveau 1) - Production + Avertissements  
- ⚠️ Erreurs + Avertissements importants
- No results found, skipped files
- **Usage :** Production avec monitoring

### **INFO** (niveau 2) - Informations principales
- ✅ Erreurs + Warns + Infos essentielles
- Requests, results counts, successful operations
- **Usage :** Développement normal

### **VERBOSE** (niveau 3) - Détails étendus
- 🔍 Info + Détails sur les recherches et traitements
- Search parameters, API responses, filtering results
- **Usage :** Debug des algorithmes de recherche

### **DEBUG** (niveau 4) - Debug complet
- 🐛 Verbose + Traces détaillées de chaque étape
- URL requests, individual filter checks, parsing details
- **Usage :** Debug approfondi, développement de features

### **SILLY** (niveau 5) - Tout afficher
- 🔬 Debug + Traces ultra-détaillées
- Raw data dumps, every decision point
- **Usage :** Debug de problèmes très spécifiques

## 🚀 Configuration rapide

### Dans docker-compose.override.yml:
```yaml
environment:
  LOG_LEVEL: DEBUG  # Changez ici
```

### Avec le script de test:
```bash
# Tester différents niveaux
./scripts/test-log-level.sh debug
./scripts/test-log-level.sh verbose
./scripts/test-log-level.sh info
```

## 📊 Méthodes de logging spécialisées

### Nouvelles méthodes ajoutées:
- `logger.request()` → 📥 Requêtes entrantes
- `logger.search()` → 🔍 Recherches API 
- `logger.filter()` → 🎯 Filtrage de contenu
- `logger.result()` → ✅ Résultats obtenus
- `logger.upload()` → 🔄 Upload magnets
- `logger.unlock()` → 🔓 Unlock files
- `logger.skip()` → ⏭️ Elements skippés

## 🎯 Recommandations par usage

### 🔧 **Développement actif:**
```yaml
LOG_LEVEL: DEBUG
```
- Voir tous les détails de filtrage
- Comprendre pourquoi certains torrents sont rejetés
- Suivre le parsing des noms de fichiers

### 🧪 **Tests et validation:**
```yaml
LOG_LEVEL: VERBOSE  
```
- Voir les paramètres de recherche
- Suivre les résultats d'API
- Monitorer les performances

### 🚀 **Production:**
```yaml
LOG_LEVEL: WARN
```
- Erreurs et avertissements uniquement
- Performance optimale
- Logs essentiels seulement

## 🔍 Exemples de sortie par niveau

### DEBUG - Vous verrez:
```
14:32:45.123 [DEBUG]: 🔍 Episode filter "Series.S01E05.1080p.FRENCH.x264": ✅ MATCH
14:32:45.124 [DEBUG]: 🚫 Movie rejected "Film.720p.ENGLISH.xvid" - Res:true, Lang:false, Codec:false
14:32:45.125 [DEBUG]: 🔓 Unlocking file: /path/to/video.mkv
```

### VERBOSE - Vous verrez:
```
14:32:44.456 [VERBOSE]: 🎯 YGG Results - Episodes: 5, Movies: 12, Seasons: 2
14:32:44.789 [VERBOSE]: 🎯 Filtered episodes: 3/5 torrents match S01E05
14:32:45.012 [VERBOSE]: 🔄 Uploading 8 magnets to AllDebrid
```

### INFO - Vous verrez:
```
14:32:43.123 [INFO]: 📥 Stream request received for ID: tt1234567:1:5
14:32:44.456 [INFO]: ✅ Found 15 torrents on YggTorrent for "Series Name"
14:32:45.789 [INFO]: ✅ 3 stream(s) obtained
```