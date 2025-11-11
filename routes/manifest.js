const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { getConfig } = require('../utils/helpers');
const { requireAccessKey } = require('../utils/auth');

// Read version from VERSION file
function getVersion() {
  try {
    const versionPath = path.join(__dirname, '..', 'VERSION');
    return fs.readFileSync(versionPath, 'utf8').trim();
  } catch (error) {
    console.warn('⚠️ Could not read VERSION file, using fallback version');
    return '0.0.0';
  }
}

// Serve the manifest file
router.get('/:variables/manifest.json', requireAccessKey, (req, res) => {
  let config;

  // Retrieve configuration
  try {
    config = getConfig(req);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  // Define the manifest object
  const manifest = {
    id: 'smart.blue.cat',
    version: getVersion(),
    name: 'Smart Blue Cat',
    description: 'An addon to say Miaaaouu.',
    logo: `${req.protocol}://${req.get('host')}/logo.png`,
    types: ['movie', 'series'],
    resources: ['stream'],
    catalogs: [],
    behaviorHints: {
      configurable: true
    }
  };

  // Send the manifest as a JSON response
  res.json(manifest);
});

module.exports = router;