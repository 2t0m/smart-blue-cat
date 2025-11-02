const axios = require('axios');
const logger = require('../utils/logger');

// Retrieve the hash of a torrent on YggTorrent
async function getTorrentHashFromYgg(torrentId) {
  const url = `https://yggapi.eu/torrent/${torrentId}`;
  try {
    const response = await axios.get(url);
    if (response.data && response.data.hash) {
      return response.data.hash;
    }
  } catch (error) {
    logger.error(`❌ Hash Retrieval Error for ${torrentId}: ${error.message}`);
    return null;
  }
  return null;
}

// Process torrents based on type, season, and episode
function processTorrents(torrents, type, season, episode, config) {
  const completeSeriesTorrents = [];
  const completeSeasonTorrents = [];
  const episodeTorrents = [];
  const movieTorrents = [];

  if (type === "movie") {
    logger.filter(`Searching for movies with filters - Res: [${config.RES_TO_SHOW.join(', ')}], Lang: [${config.LANG_TO_SHOW.join(', ')}], Codecs: [${config.CODECS_TO_SHOW.join(', ')}]`);
    movieTorrents.push(
      ...torrents
        .filter(torrent => {
          const hasRes = config.RES_TO_SHOW.some(res => torrent.title.toLowerCase().includes(res.toLowerCase()));
          const hasLang = config.LANG_TO_SHOW.some(lang => torrent.title.toLowerCase().includes(lang.toLowerCase()));
          const hasCodec = config.CODECS_TO_SHOW.some(codec => torrent.title.toLowerCase().includes(codec.toLowerCase()));
          const passes = hasRes && hasLang && hasCodec;
          
          if (!passes) {
            logger.debug(`🚫 Movie rejected "${torrent.title}" - Res:${hasRes}, Lang:${hasLang}, Codec:${hasCodec}`);
          }
          return passes;
        })
        .map(torrent => ({ ...torrent, category: "movieTorrents", source: "YGG" }))
    );
    logger.result(`${movieTorrents.length} movie torrents found.`);
  }

  if (type === "series") {
    // 1. PRIORITÉ: Chercher l'épisode spécifique d'abord (si season + episode fournis)
    if (season && episode) {
      const seasonFormatted = season.padStart(2, '0');
      const episodeFormatted = episode.padStart(2, '0');
      logger.filter(`🎯 PRIORITY 1: Searching for specific episode S${seasonFormatted}E${episodeFormatted}`);
      
      // Patterns de recherche très flexibles pour épisodes
      const episodePatterns = [
        `s${seasonFormatted}e${episodeFormatted}`,
        `s${seasonFormatted}.e${episodeFormatted}`,
        `s${seasonFormatted} e${episodeFormatted}`,
        `s${seasonFormatted}_e${episodeFormatted}`,
        `season ${parseInt(season)} episode ${parseInt(episode)}`,
        `saison ${parseInt(season)} episode ${parseInt(episode)}`,
        `${seasonFormatted}x${episodeFormatted}`,
      ];
      
      logger.debug(`🔍 Episode search patterns: ${episodePatterns.join(', ')}`);
      
      episodeTorrents.push(
        ...torrents
          .filter(torrent => {
            const title = torrent.title.toLowerCase();
            const hasRes = config.RES_TO_SHOW.some(res => title.includes(res.toLowerCase()));
            const hasLang = config.LANG_TO_SHOW.some(lang => title.includes(lang.toLowerCase()));
            const hasCodec = config.CODECS_TO_SHOW.some(codec => title.includes(codec.toLowerCase()));
            const hasPattern = episodePatterns.some(pattern => title.includes(pattern));
            
            const passes = hasRes && hasLang && hasCodec && hasPattern;
            
            logger.debug(`🔍 Episode "${torrent.title}" - Res:${hasRes}, Lang:${hasLang}, Codec:${hasCodec}, Pattern:${hasPattern} => ${passes ? '✅ ACCEPTED' : '❌ REJECTED'}`);
            
            return passes;
          })
          .map(torrent => ({ ...torrent, category: "episodeTorrents", source: "YGG" }))
      );
      logger.result(`${episodeTorrents.length} specific episode torrents found.`);
    }

    // 2. PRIORITÉ: Chercher la saison complète (fallback fiable)
    if (season) {
      const seasonFormatted = season.padStart(2, '0');
      logger.filter(`🎯 PRIORITY 2: Searching for complete season S${seasonFormatted}`);

      // Patterns pour saisons complètes
      const seasonPatterns = [
        `saison ${seasonFormatted}`,
        `season ${seasonFormatted}`,
        `s${seasonFormatted}`,
        `saison ${parseInt(season)}`,
        `season ${parseInt(season)}`,
        `s${parseInt(season)} `,
        `s${seasonFormatted} `,
      ];

      logger.debug(`🔍 Season search patterns: ${seasonPatterns.join(', ')}`);

      completeSeasonTorrents.push(
        ...torrents
          .filter(torrent => {
            const title = torrent.title.toLowerCase();
            const hasRes = config.RES_TO_SHOW.some(res => title.includes(res.toLowerCase()));
            const hasLang = config.LANG_TO_SHOW.some(lang => title.includes(lang.toLowerCase()));
            const hasCodec = config.CODECS_TO_SHOW.some(codec => title.includes(codec.toLowerCase()));
            
            // Vérifier les patterns de saison ET exclure les épisodes spécifiques
            const hasSeasonPattern = seasonPatterns.some(pattern => title.includes(pattern));
            const isSpecificEpisode = title.match(new RegExp(`s${seasonFormatted}e\\d{2}`, "i")) || 
                                     title.match(new RegExp(`s${seasonFormatted}\\.e\\d{2}`, "i"));
            
            const passes = hasRes && hasLang && hasCodec && hasSeasonPattern && !isSpecificEpisode;
            
            logger.debug(`🔍 Season "${torrent.title}" - Res:${hasRes}, Lang:${hasLang}, Codec:${hasCodec}, Season:${hasSeasonPattern}, NotEpisode:${!isSpecificEpisode} => ${passes ? '✅ ACCEPTED' : '❌ REJECTED'}`);
            
            return passes;
          })
          .map(torrent => ({ ...torrent, category: "completeSeasonTorrents", source: "YGG" }))
      );

      logger.result(`${completeSeasonTorrents.length} complete season torrents found.`);
    }

    // 3. PRIORITÉ: Chercher les séries complètes (dernier recours)
    logger.filter(`🎯 PRIORITY 3: Searching for complete series`);
    
    const completeSeriesPatterns = [
      'complete',
      'integral',
      'integrale',
      'collection',
      'serie complete',
      'series complete',
      'saison 1-',
      'season 1-',
      's01-s',
      's1-s'
    ];

    logger.debug(`🔍 Complete series patterns: ${completeSeriesPatterns.join(', ')}`);

    completeSeriesTorrents.push(
      ...torrents
        .filter(torrent => {
          const title = torrent.title.toLowerCase();
          const hasRes = config.RES_TO_SHOW.some(res => title.includes(res.toLowerCase()));
          const hasLang = config.LANG_TO_SHOW.some(lang => title.includes(lang.toLowerCase()));
          const hasCodec = config.CODECS_TO_SHOW.some(codec => title.includes(codec.toLowerCase()));
          const hasCompletePattern = completeSeriesPatterns.some(pattern => title.includes(pattern));
          
          const passes = hasRes && hasLang && hasCodec && hasCompletePattern;
          
          logger.debug(`🔍 Complete "${torrent.title}" - Res:${hasRes}, Lang:${hasLang}, Codec:${hasCodec}, Complete:${hasCompletePattern} => ${passes ? '✅ ACCEPTED' : '❌ REJECTED'}`);
          
          return passes;
        })
        .map(torrent => ({ ...torrent, category: "completeSeriesTorrents", source: "YGG" }))
    );
    logger.result(`${completeSeriesTorrents.length} complete series torrents found.`);
  }

  return { completeSeriesTorrents, completeSeasonTorrents, episodeTorrents, movieTorrents };
}

// Search for torrents on YggTorrent
async function searchYgg(title, type, season, episode, config, titleFR = null, imdbId = null) {
  logger.search(`Searching for torrents on YggTorrent`);
  logger.verbose(`🎯 Search params - Title: "${title}", Type: ${type}, Season: ${season || 'N/A'}, Episode: ${episode || 'N/A'}`);

  // Use the title for the search
  let searchTitle = title;

  // Check for custom search keywords
  const customKeywords = process.env.CUSTOM_SEARCH_KEYWORDS || "";
  logger.debug(`🔍 CUSTOM_SEARCH_KEYWORDS: ${customKeywords}`);

  const keywordMap = Object.fromEntries(
    customKeywords.split(",").map(entry => entry.split("=").map(s => s.trim()))
  );

  logger.debug(`🔍 Keyword Map: ${JSON.stringify(keywordMap, null, 2)}`);
  logger.debug(`🔍 Checking for custom keywords for IMDB ID: ${imdbId}`);

  // Add custom keywords if a match is found
  if (keywordMap[imdbId]) {
    const customKeyword = keywordMap[imdbId];
    searchTitle += ` ${customKeyword}`;
    logger.info(`🔍 Custom keywords added for "${title}": ${customKeyword}`);
  } else {
    logger.debug(`🔍 No custom keywords found for "${imdbId}".`);
  }

  let torrents = await performSearch(searchTitle, type, config);

  // If no results, try with the French title
  if (torrents.length === 0 && titleFR !== null && title !== titleFR) {
    logger.warn(`📢 No results found with "${searchTitle}", trying with "${titleFR}"`);
    searchTitle = titleFR;

    // Add custom keywords for the French title if available
    if (keywordMap[imdbId]) {
      const customKeyword = keywordMap[imdbId];
      searchTitle += ` ${customKeyword}`;
      logger.info(`🔍 Custom keywords added for "${titleFR}": ${customKeyword}`);
    }

    torrents = await performSearch(searchTitle, type, config);
  }

  if (torrents.length === 0) {
    logger.error(`❌ No torrents found for ${searchTitle}`);
    return { completeSeriesTorrents: [], completeSeasonTorrents: [], episodeTorrents: [], movieTorrents: [] };
  }

  return processTorrents(torrents, type, season, episode, config);
}

async function performSearch(searchTitle, type, config) {
  const categoryIds = type === "movie" 
    ? [2178, 2181, 2183]
    : [2179, 2181, 2182, 2184];

  const categoryParams = categoryIds.map(id => `category_id=${id}`).join('&');

  const requestUrl = `https://yggapi.eu/torrents?q=${encodeURIComponent(searchTitle)}&page=1&per_page=100&order_by=uploaded_at&${categoryParams}`;

  logger.debug(`🔍 Performing YGG search with URL: ${requestUrl}`);

  try {
    const response = await axios.get(requestUrl);
    let torrents = response.data || [];

    logger.info(`✅ Found ${torrents.length} torrents on YggTorrent for "${searchTitle}".`);
    
    // Log des premiers torrents pour debug
    if (torrents.length > 0) {
      logger.debug(`🔍 First 5 torrent titles found:`);
      torrents.slice(0, 5).forEach((torrent, index) => {
        logger.debug(`   ${index + 1}. "${torrent.title}"`);
      });
    }

    torrents.sort((a, b) => {
      const priorityA = prioritizeTorrent(a, config);
      const priorityB = prioritizeTorrent(b, config);

      if (priorityA.resolution !== priorityB.resolution) {
        return priorityA.resolution - priorityB.resolution;
      }
      if (priorityA.language !== priorityB.language) {
        return priorityA.language - priorityB.language;
      }
      return priorityA.codec - priorityB.codec;
    });

    return torrents;
  } catch (error) {
    logger.error("❌ Ygg Search Error:", error.message);
    return [];
  }
}

function prioritizeTorrent(torrent, config) {
  const resolutionPriority = config.RES_TO_SHOW.findIndex(res => torrent.title.toLowerCase().includes(res.toLowerCase()));
  const languagePriority = config.LANG_TO_SHOW.findIndex(lang => torrent.title.toLowerCase().includes(lang.toLowerCase()));
  const codecPriority = config.CODECS_TO_SHOW.findIndex(codec => torrent.title.toLowerCase().includes(codec.toLowerCase()));

  return {
    resolution: resolutionPriority === -1 ? Infinity : resolutionPriority,
    language: languagePriority === -1 ? Infinity : languagePriority,
    codec: codecPriority === -1 ? Infinity : codecPriority
  };
}

module.exports = { getTorrentHashFromYgg, searchYgg };