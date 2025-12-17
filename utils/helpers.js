// Format file size from bytes to GB
const logger = require('./logger');
function formatSize(bytes) {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb.toFixed(2) + " GB";
}

// Extract resolution, codec, source, and language from a file name
function parseFileName(fileName) {
  logger.debug(`[helpers] parseFileName IN: ${fileName}`);
  const resolutionMatch = fileName.match(/(4k|\d{3,4}p)/i);
  const codecMatch = fileName.match(/(h.264|h.265|x.264|x.265|h264|h265|x264|x265|AV1|HEVC)/i);
  const sourceMatch = fileName.match(/(BluRay|WEB[-]?DL|WEB|HDRip|DVDRip|BRRip)/i);
  
  // Language detection with emojis
  const languagePatterns = [
    { pattern: /MULTI/i, name: 'MULTI', emoji: '🌍' },
    { pattern: /VOSTFR/i, name: 'VOSTFR', emoji: '🇫🇷' },
    { pattern: /FRENCH/i, name: 'FRENCH', emoji: '🇫🇷' },
    { pattern: /TRUEFRENCH/i, name: 'TRUEFRENCH', emoji: '🇫🇷' },
    { pattern: /VFF/i, name: 'VFF', emoji: '🇫🇷' },
    { pattern: /VF2/i, name: 'VF2', emoji: '🇫🇷' },
    { pattern: /VFQ/i, name: 'VFQ', emoji: '🇫🇷' },
    { pattern: /VFI/i, name: 'VFI', emoji: '🇫🇷' },
    { pattern: /VOF/i, name: 'VOF', emoji: '🇫🇷' },
    { pattern: /ENGLISH/i, name: 'ENGLISH', emoji: '🇺🇸' },
    { pattern: /SPANISH/i, name: 'SPANISH', emoji: '🇪🇸' },
    { pattern: /GERMAN/i, name: 'GERMAN', emoji: '🇩🇪' },
    { pattern: /ITALIAN/i, name: 'ITALIAN', emoji: '🇮🇹' }
  ];
  
  const languageMatch = languagePatterns.find(lang => lang.pattern.test(fileName));

  logger.debug(`[helpers] parseFileName OUT: result computed`);
  return {
    resolution: resolutionMatch ? resolutionMatch[0] : "?",
    codec: codecMatch ? codecMatch[0] : "?",
    source: sourceMatch ? sourceMatch[0] : "?",
    language: languageMatch ? languageMatch.name : "?",
    languageEmoji: languageMatch ? languageMatch.emoji : "🌐"
  };
}

// Decode and parse configuration from the request
function getConfig(req) {
  logger.debug(`[helpers] getConfig IN: ${req && req.url}`);
  if (req.params.variables) {
    try {
      const decoded = Buffer.from(req.params.variables, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (e) {
      throw new Error("Invalid configuration in URL");
    }
  } else {
    throw new Error("Configuration missing in URL");
  }
  logger.debug(`[helpers] getConfig OUT: config built`);
}

module.exports = { formatSize, parseFileName, getConfig };