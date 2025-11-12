const axios = require('axios');
const httpClient = require('../utils/http');
const logger = require('../utils/logger');

// Normalize title for consistent filtering
function normalizeTitle(title) {
  return title.toLowerCase()
    .replace(/\b4k\b/g, '2160p')     // 4K -> 2160p
    .replace(/\bx264\b/g, 'h264')    // x264 -> h264  
    .replace(/\bx265\b/g, 'h265')    // x265 -> h265
    .replace(/\bhevc\b/g, 'h265')    // HEVC -> h265
    .replace(/\bvof\b/g, 'vff')      // VOF -> VFF
    .replace(/\bvf2\b/g, 'vff');     // VF2 -> VFF
}

// Map subcategories for Sharewood
const SUBCATEGORY_MAP = {
  movie: [9, 11],
  series: [10, 12]
};

// Perform a search on Sharewood
async function searchSharewood(title, type, season = null, episode = null, config, year = null) {
  const subcategories = SUBCATEGORY_MAP[type];
  if (!subcategories) {
    logger.error(`❌ Invalid type "${type}" for Sharewood search.`);
    return {
      completeSeriesTorrents: [],
      completeSeasonTorrents: [],
      episodeTorrents: [],
      movieTorrents: []
    };
  }

  const subcategoryParams = subcategories.map(id => `subcategory_id=${id}`).join(',');
  
  const requestUrl = `https://www.sharewood.tv/api/${config.SHAREWOOD_PASSKEY}/search?name=${encodeURIComponent(title)}&category=1&subcategory_id=${subcategoryParams}`;

  logger.search(`Searching for torrents on Sharewood`);
  logger.verbose(`🎯 Sharewood search params - Title: "${title}", Type: ${type}, Year: ${year || 'N/A'}, Season: ${season || 'N/A'}, Episode: ${episode || 'N/A'}`);
  if (type === 'movie' && year) {
    logger.info(`🎬 Adding year to Sharewood movie search: "${title}" → "${title} ${year}"`);
  }
  logger.info(`🔍 Performing Sharewood search with URL: ${requestUrl}`);

  try {
    const response = await httpClient.get(requestUrl, {
      source: 'SW',
      timeout: 10000,
      maxRetries: 3,
      useCircuitBreaker: true
    });
    const torrents = response.data || [];

    logger.info(`✅ Found ${torrents.length} torrents on Sharewood for "${title}".`);
    
    // Log des premiers torrents pour debug
    if (torrents.length > 0) {
      logger.debug(`🔍 First 3 Sharewood torrent titles found:`);
      torrents.slice(0, 3).forEach((torrent, index) => {
        logger.debug(`   ${index + 1}. "${torrent.name}"`);
      });
    }

    // Process torrents to structure the results
    return processTorrents(torrents, type, season, episode, config);
  } catch (error) {
    logger.error(`❌ Sharewood Search Error: ${error.message}`);
    return {
      completeSeriesTorrents: [],
      completeSeasonTorrents: [],
      episodeTorrents: [],
      movieTorrents: []
    };
  }
}

// Process torrents based on type, season, and episode with priority system
function processTorrents(torrents, type, season, episode, config) {
  logger.filter(`🎯 Processing ${torrents.length} Sharewood torrents`);
  logger.debug(`📊 Request params - Type: ${type}, Season: ${season || 'N/A'}, Episode: ${episode || 'N/A'}`);

  const completeSeriesTorrents = [];
  const completeSeasonTorrents = [];
  const episodeTorrents = [];
  const movieTorrents = [];

  if (type === "movie") {
    logger.filter(`🎬 Processing movies`);
    
    torrents.forEach(torrent => {
      if (meetsCriteria(torrent, config)) {
        movieTorrents.push(formatTorrent(torrent));
        logger.debug(`✅ Movie added: "${torrent.name}"`);
      }
    });
    
    logger.info(`🎬 Found ${movieTorrents.length} valid movie torrents on Sharewood`);
    return { completeSeriesTorrents, completeSeasonTorrents, episodeTorrents, movieTorrents };
  }

  if (type === "series") {
    logger.filter(`📺 Processing series - prioritizing episode → season → complete series`);
    
    // Priority 1: Specific episodes (if season & episode provided)
    if (season && episode) {
      const seasonPadded = season.padStart(2, '0');
      const episodePadded = episode.padStart(2, '0');
      
      const episodePatterns = [
        `s${seasonPadded}e${episodePadded}`,  // s01e01
        `s${seasonPadded}.e${episodePadded}`, // s01.e01  
        `${seasonPadded}x${episodePadded}`,   // 01x01
        `season.${season}.episode.${episode}`, // season.1.episode.1
        `s${season}e${episode}`,              // s1e1 (non-padded)
        `saison.${season}.episode.${episode}` // French format
      ];

      logger.filter(`🎯 Priority 1 - Searching for specific episode S${seasonPadded}E${episodePadded}`);
      logger.debug(`🔍 Episode patterns: ${episodePatterns.join(', ')}`);

      torrents.forEach(torrent => {
        const name = torrent.name.toLowerCase();
        const hasEpisodePattern = episodePatterns.some(pattern => name.includes(pattern.toLowerCase()));
        
        // Additional check: ensure it's not a season pack
        const isNotSeasonPack = !name.match(/complete|integrale?|saison.*complete|season.*complete|multi/i);
        
        if (hasEpisodePattern && isNotSeasonPack && meetsCriteria(torrent, config)) {
          episodeTorrents.push(formatTorrent(torrent));
          logger.debug(`✅ Episode torrent added: "${torrent.name}"`);
        }
      });
      
      logger.info(`� Found ${episodeTorrents.length} episode-specific torrents`);
    }

    // Priority 2: Complete seasons (if season provided)
    if (season) {
      const seasonPadded = season.padStart(2, '0');
      
      const seasonPatterns = [
        `s${seasonPadded}`,          // s01
        `season.${season}`,          // season.1
        `saison.${season}`,          // saison.1 (French)
        `season ${season}`,          // season 1
        `saison ${season}`           // saison 1
      ];

      logger.filter(`🎯 Priority 2 - Searching for complete season S${seasonPadded}`);
      logger.debug(`🔍 Season patterns: ${seasonPatterns.join(', ')}`);

      torrents.forEach(torrent => {
        const name = torrent.name.toLowerCase();
        
        // Check for season patterns
        const hasSeasonPattern = seasonPatterns.some(pattern => name.includes(pattern.toLowerCase()));
        
        // Exclude specific episodes (they go in episodeTorrents)
        const excludeEpisodePatterns = [
          `s${seasonPadded}e\\d{1,2}`,        // s01e01, s01e1
          `s${seasonPadded}\\.e\\d{1,2}`,     // s01.e01
          `${seasonPadded}x\\d{1,2}`,         // 01x01
          `s${season}e\\d{1,2}`,              // s1e1
          `season\\.${season}\\.episode`      // season.1.episode
        ];
        
        const isNotSpecificEpisode = !excludeEpisodePatterns.some(pattern => 
          name.match(new RegExp(pattern, 'i'))
        );
        
        // Look for indicators it's a complete season
        const seasonIndicators = [
          'complete', 'integrale?', 'saison.*complete', 'season.*complete',
          'multi', 'pack', 'collection'
        ];
        
        const hasSeasonIndicator = seasonIndicators.some(indicator => 
          name.match(new RegExp(indicator, 'i'))
        ) || hasSeasonPattern;
        
        if (hasSeasonIndicator && isNotSpecificEpisode && meetsCriteria(torrent, config)) {
          completeSeasonTorrents.push(formatTorrent(torrent));
          logger.debug(`✅ Season torrent added: "${torrent.name}"`);
        }
      });
      
      logger.info(`� Found ${completeSeasonTorrents.length} complete season torrents`);
    }

    // Priority 3: Complete series (fallback)
    const seriesPatterns = [
      'complete', 'integrale?', 'serie.*complete', 'series.*complete',
      'collection.*complete', 'pack.*complete', 'saison.*complete',
      'season.*complete', 'multi.*season', 'toutes.*saisons'
    ];

    logger.filter(`🎯 Priority 3 - Searching for complete series`);
    logger.debug(`🔍 Series patterns: ${seriesPatterns.join(', ')}`);

    torrents.forEach(torrent => {
      const name = torrent.name.toLowerCase();
      
      const hasSeriesPattern = seriesPatterns.some(pattern => 
        name.match(new RegExp(pattern, 'i'))
      );
      
      // Exclude specific seasons/episodes (they go in their respective arrays)
      const isNotSpecific = !name.match(/s\d{1,2}(e\d{1,2})?|season\s*\d|saison\s*\d/i);
      
      if (hasSeriesPattern && isNotSpecific && meetsCriteria(torrent, config)) {
        completeSeriesTorrents.push(formatTorrent(torrent));
        logger.debug(`✅ Complete series torrent added: "${torrent.name}"`);
      }
    });
    
    logger.info(`🎯 Found ${completeSeriesTorrents.length} complete series torrents`);
  }

  const totalFound = episodeTorrents.length + completeSeasonTorrents.length + completeSeriesTorrents.length + movieTorrents.length;
  logger.info(`📊 Sharewood processing complete: ${totalFound} torrents matched criteria`);
  
  return { completeSeriesTorrents, completeSeasonTorrents, episodeTorrents, movieTorrents };
}

// Helper function to check if torrent meets quality criteria
function meetsCriteria(torrent, config) {
  const name = normalizeTitle(torrent.name);
  const language = normalizeTitle(torrent.language || '').toLowerCase();
  
  const hasValidResolution = config.RES_TO_SHOW.some(res => name.includes(res.toLowerCase()));
  // Check language in both torrent.language AND torrent.name
  const hasValidLanguage = config.LANG_TO_SHOW.some(lang => 
    language.includes(lang.toLowerCase()) || name.includes(lang.toLowerCase())
  );
  const hasValidCodec = config.CODECS_TO_SHOW.some(codec => name.includes(codec.toLowerCase()));
  
  const isValid = hasValidResolution && hasValidLanguage && hasValidCodec;
  
  if (!isValid) {
    logger.debug(`❌ Torrent filtered out: "${torrent.name}" - Res:${hasValidResolution} Lang:${hasValidLanguage} Codec:${hasValidCodec} (language field: "${language}")`);
  }
  
  return isValid;
}

// Helper function to format torrent for output
function formatTorrent(torrent) {
  return {
    id: torrent.id,
    hash: torrent.info_hash,
    title: torrent.name,
    resolution: torrent.type,
    size: torrent.size,
    seeders: torrent.seeders,
    leechers: torrent.leechers,
    language: torrent.language,
    download_url: torrent.download_url,
    created_at: torrent.created_at,
    source: "SW"
  };
}

module.exports = { searchSharewood, processTorrents };