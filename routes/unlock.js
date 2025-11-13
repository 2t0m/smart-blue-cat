const express = require('express');
const { unlockFileLink } = require('../services/alldebrid');
const { getConfig } = require('../utils/helpers');
const logger = require('../utils/logger');
const { requireAccessKey } = require('../utils/auth');

const router = express.Router();

// Cache temporaire pour éviter les déverrouillages multiples du même fichier
const unlockCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fonction pour nettoyer le cache périodiquement
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of unlockCache.entries()) {
    if (now - data.timestamp > CACHE_DURATION) {
      unlockCache.delete(key);
    }
  }
}, 60000); // Nettoyage toutes les minutes

// Route pour débridement à la demande
router.get('/:variables/unlock/:encryptedData', requireAccessKey, async (req, res) => {
  const requestTime = new Date().toISOString();
  const startTime = Date.now();
  let config;

  try {
    config = getConfig(req);
  } catch (e) {
    logger.error("❌ Invalid configuration in unlock request:", e.message);
    return res.status(400).json({ error: e.message });
  }

  const { encryptedData } = req.params;
  
  try {
    // Décoder les données (base64url safe)
    const jsonData = Buffer.from(encryptedData.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const linkData = JSON.parse(jsonData);
    
    // Créer une clé de cache basée sur le lien AllDebrid
    const cacheKey = linkData.allDebridLink;
    
    // Log de la requête avec timestamp précis
    logger.info(`🔓 UNLOCK REQUEST: ${linkData.fileName} (${linkData.source}) [${requestTime}]`);
    
    // Vérifier si ce lien a déjà été débridé récemment
    if (unlockCache.has(cacheKey)) {
      const cachedData = unlockCache.get(cacheKey);
      const totalTime = Date.now() - startTime;
      logger.info(`🎯 CACHE HIT: ${linkData.fileName} (${totalTime}ms) [${requestTime}]`);
      return res.redirect(cachedData.unlockedLink);
    }
    
    logger.info(`� UNLOCKING: ${linkData.fileName} (${linkData.source})`);
    
    // Débridement du lien
    const unlockedLink = await unlockFileLink(linkData.allDebridLink, config);
    
    if (unlockedLink) {
      const totalTime = Date.now() - startTime;
      
      // Mettre en cache le résultat
      unlockCache.set(cacheKey, {
        unlockedLink,
        timestamp: Date.now()
      });
      
      logger.info(`✅ UNLOCK SUCCESS: ${linkData.fileName} in ${totalTime}ms [${requestTime}]`);
      
      // Redirection vers le lien débloqué
      res.redirect(unlockedLink);
    } else {
      logger.error(`❌ UNLOCK FAILED: ${linkData.fileName} [${requestTime}]`);
      res.status(500).json({ error: 'Failed to unlock file' });
    }
    
  } catch (error) {
    logger.error(`❌ UNLOCK ERROR: ${error.message} [${requestTime}]`);
    res.status(400).json({ error: 'Invalid request data' });
  }
});

module.exports = router;