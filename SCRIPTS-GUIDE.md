# 📋 Smart Blue Cat Scripts Guide

## 🔧 Configuration

### `config.sh`
**Role**: Centralized configuration for all scripts  
**Purpose**: Defines default environment variables (examples)  
**Usage**: Automatically loaded by other scripts  
```bash
# Variables defined:
SERVER_HOST="your-server-ip"      # Server IP (example)
SERVER_USER="user"               # SSH user (example)
SERVER_PROJECT_PATH="/home/user/smart-blue-cat"    # Remote path
LOCAL_PROJECT_PATH="/path/to/local/project"        # Local path
```

### `config.local.sh` ⭐
**Role**: Personal configuration (not versioned)  
**Purpose**: Contains YOUR real server information  
**Usage**: Copy from `config.local.sh.example` and customize  
```bash
# Example content:
SERVER_HOST="your-server-ip"      # YOUR server IP
SERVER_USER="username"             # YOUR username
```

### `config.local.sh.example`
**Role**: Personal configuration template  
**Purpose**: Template to create your config.local.sh  
**Usage**: `cp config.local.sh.example config.local.sh`

---

## 🚀 Deployment Scripts

### `deploy-smart.sh` ⭐ (NEW)
**Role**: Intelligent multi-environment deployment  
**Purpose**: Automatically detects where to deploy (local vs Koyeb)  
**Usage**: 
```bash
./scripts/deploy-smart.sh        # Auto-detection
./scripts/deploy-smart.sh local  # Force local server
./scripts/deploy-smart.sh koyeb  # Force Koyeb preparation
```

### `deploy-local.sh`
**Role**: Classic deployment to local server  
**Purpose**: Deploy after commit to your server
**Usage**: 
```bash
./scripts/deploy-local.sh        # Deploy local production
```

---

## ⚡ Development & Testing

### `sync-and-test.sh` ⭐ (QUICK TEST)
**Role**: Ultra-fast testing without commit  
**Purpose**: Immediate test without commit (rsync + restart)  
**Usage**: 
```bash
./scripts/sync-and-test.sh       # Quick test
```

**Process**:
1. 📤 Sync ALL files (even uncommitted) via rsync
2. 🔄 Quick restart on remote server
3. 📝 Show startup logs

### `sync-and-test.sh`
**Role**: Complete build + tests on server  
**Purpose**: Complete build + tests on server (without commit)  
**Usage**: 
```bash
./scripts/sync-and-test.sh       # Complete test
```

---

## 🔍 Testing Scripts

### `test-search.sh`
**Role**: Test search for specific content  
**Purpose**: Tests search for a specific IMDB ID  
**Usage**: 
```bash
./scripts/test-search.sh "tt1234567"  # Test specific IMDB
```

### `test-strategy.sh`
**Role**: Strategy comparison testing  
**Purpose**: Compare different approaches (episode → season → series)  
**Usage**: 
```bash
./scripts/test-strategy.sh "Breaking Bad"
```

---

## 📊 Monitoring & Logs

### `logs.sh`
**Role**: Remote Docker logs monitoring  
**Purpose**: Follow remote Docker container logs  
**Usage**: 
```bash
./scripts/logs.sh               # Follow logs
./scripts/logs.sh --tail 50     # Last 50 lines
```

### `test-log-level.sh`
**Role**: Debug with specific log level  
**Purpose**: Restart with a log level for debugging  
**Usage**: 
```bash
./scripts/test-log-level.sh debug    # Debug level
./scripts/test-log-level.sh info     # Info level
```

### `set-log-level.sh`
**Role**: Persistent log level change  
**Purpose**: Modifies docker-compose.override.yml  
**Usage**: 
```bash
./scripts/set-log-level.sh debug     # Set debug permanently
```

---

## ☁️ Koyeb Helpers

### `koyeb-helper.sh`
**Role**: Koyeb deployment assistance  
**Purpose**: Configuration and debugging for Koyeb  
**Usage**: 
```bash
./scripts/koyeb-helper.sh config       # Show recommended config
./scripts/koyeb-helper.sh test         # Test image locally
./scripts/koyeb-helper.sh urls my.app  # Generate URLs
./scripts/koyeb-helper.sh troubleshoot # Debug guide
```

---

## 📁 File Structure

```
scripts/
├── config.sh                   # Default config (versioned)
├── config.local.sh             # YOUR config (not versioned)
├── config.local.sh.example     # Template
├── deploy-smart.sh             # Smart deployment ⭐
├── deploy-local.sh             # Local deployment
├── sync-and-test.sh            # Quick testing ⭐
├── logs.sh                     # Remote logs
├── test-search.sh              # Search testing
├── test-strategy.sh            # Strategy testing
├── test-log-level.sh           # Debug with log level
├── set-log-level.sh            # Set log level
└── koyeb-helper.sh             # Koyeb assistance
```

---

## 🚦 Typical Workflow

### 🏃‍♂️ Quick Development
```bash
# 1. Make changes to code
# 2. Test immediately without commit
./scripts/sync-and-test.sh

# 3. If working, commit and deploy
git add . && git commit -m "Your changes"
./scripts/deploy-smart.sh
```

### 🔍 Debug Session
```bash
# 1. Set debug level
./scripts/set-log-level.sh debug

# 2. Test with debug logs
./scripts/sync-and-test.sh

# 3. Follow logs in real-time
./scripts/logs.sh
```

### 🧪 Search Testing
```bash
# Test specific content
./scripts/test-search.sh "tt0944947"    # Game of Thrones

# Test strategy comparison
./scripts/test-strategy.sh "Breaking Bad"
```

### ☁️ Koyeb Deployment
```bash
# 1. Prepare for Koyeb
./scripts/deploy-smart.sh koyeb

# 2. Get Koyeb configuration
./scripts/koyeb-helper.sh config

# 3. Test locally first
./scripts/koyeb-helper.sh test
```