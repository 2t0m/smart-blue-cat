# 🪟 Guide Windows - YGG Stremio Add-on

## 🚀 Comment faire sync-and-test depuis Windows

Vous avez **plusieurs options** pour synchroniser et tester depuis Windows :

### ⭐ **Option 1 : PowerShell natif (Recommandé)**
```powershell
# Sync rapide avec test
.\scripts\sync-and-test.ps1

# Déploiement intelligent  
.\scripts\deploy.ps1

# Voir les logs
.\scripts\logs.ps1
```

### 🐧 **Option 2 : WSL (Windows Subsystem for Linux)**
```bash
# Dans WSL
wsl
cd /mnt/c/Users/ThomasPRUDHOMME/Visual\ Studio\ Code/Y
./scripts/sync-and-test.sh
```

### 🎯 **Option 3 : Git Bash**
```bash
# Dans Git Bash
cd "c:/Users/ThomasPRUDHOMME/Visual Studio Code/Y"
./scripts/sync-and-test.sh
```

### ⚙️ **Option 4 : PowerShell avec commandes Unix**
Si vous avez Git avec rsync installé :
```powershell
# Utiliser bash depuis PowerShell
bash -c "./scripts/sync-and-test.sh"
```

---

## 📋 **Scripts PowerShell disponibles**

### `sync-and-test.ps1`
**Fonction** : Synchronisation rapide + test  
**Utilité** : Équivalent PowerShell de sync-and-test.sh  
```powershell
.\scripts\sync-and-test.ps1    # Sync automatique via Git
```

### `deploy.ps1`  
**Fonction** : Déploiement intelligent  
**Utilité** : Détection auto local/Koyeb  
```powershell
.\scripts\deploy.ps1           # Auto-détection
.\scripts\deploy.ps1 local     # Force serveur local
.\scripts\deploy.ps1 koyeb     # Force Koyeb
```

### `logs.ps1`
**Fonction** : Affichage des logs  
**Utilité** : Logs en temps réel depuis Windows  
```powershell
.\scripts\logs.ps1             # Logs temps réel
.\scripts\logs.ps1 -Follow:$false -Lines 100  # 100 dernières lignes
```

### `config.local.ps1`
**Fonction** : Configuration PowerShell  
**Utilité** : Variables d'environnement pour scripts PS  
```powershell
# Contenu exemple :
$SERVER_HOST = "192.168.1.155"
$SERVER_USER = "thomas"
```

---

## ⚡ **Workflow recommandé pour Windows**

### 1. **Configuration initiale**
```powershell
# 1. Cloner le projet (déjà fait)
# 2. Vérifier la config PowerShell
Get-Content scripts\config.local.ps1

# 3. Tester la connexion SSH
ssh thomas@192.168.1.155 "echo 'Connection OK'"
```

### 2. **Développement quotidien**
```powershell
# Modifications de code...
# Puis sync rapide :
.\scripts\sync-and-test.ps1

# Voir les résultats :
.\scripts\logs.ps1
```

### 3. **Déploiement**
```powershell
# Quand votre code est prêt :
git add .
git commit -m "Feature: ..."

# Déploiement intelligent :
.\scripts\deploy.ps1
```

---

## 🔧 **Prérequis Windows**

### ✅ **Installé (vous avez déjà)**
- Git for Windows
- PowerShell 5.1+
- SSH client (inclus dans Windows 10+)

### 📦 **Optionnel mais recommandé**  
- **WSL2** : Pour utiliser les scripts bash natifs
- **Git Bash** : Alternative à PowerShell
- **Windows Terminal** : Meilleur terminal

### 🛠️ **Installation WSL (optionnel)**
```powershell
# Activer WSL
wsl --install

# Ou si déjà activé, installer Ubuntu
wsl --install -d Ubuntu

# Puis dans WSL :
cd /mnt/c/Users/ThomasPRUDHOMME/Visual\ Studio\ Code/Y
```

---

## 🚨 **Résolution de problèmes courants**

### ❌ **"ssh: commande introuvable"**
```powershell
# Vérifier SSH
Get-Command ssh

# Si absent, installer OpenSSH :
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

### ❌ **"Permission denied (publickey)"**
```powershell
# Configurer clé SSH
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
ssh-copy-id thomas@192.168.1.155
```

### ❌ **"Execution Policy Error"**
```powershell
# Autoriser l'exécution de scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### ❌ **"rsync: commande introuvable"**  
```powershell
# Les scripts PS utilisent Git au lieu de rsync
# Pas de problème, cela fonctionne automatiquement
```

---

## 📊 **Comparaison des méthodes**

| Méthode | Vitesse | Simplicité | Compatibilité |
|---------|---------|------------|---------------|
| **PowerShell** | ⚡⚡⚡ | ⭐⭐⭐ | 🪟 Windows natif |
| **WSL** | ⚡⚡ | ⭐⭐ | 🐧 Linux dans Windows |
| **Git Bash** | ⚡⚡ | ⭐⭐⭐ | 🎯 Scripts bash natifs |
| **Direct SSH** | ⚡ | ⭐ | 🔧 Manuel |

---

## 🎯 **Recommandation finale**

**Pour vous (utilisateur Windows) :**

1. **Utilisez PowerShell** pour la simplicité : `.\scripts\sync-and-test.ps1`
2. **Gardez WSL/Git Bash** comme alternatives
3. **Les scripts bash** continuent de fonctionner sur le serveur
4. **Configuration unique** : `config.local.ps1` pour PowerShell, `config.local.sh` pour bash

**Commande la plus simple pour sync-and-test :**
```powershell
.\scripts\sync-and-test.ps1
```

C'est tout ! 🎉