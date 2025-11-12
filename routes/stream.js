const express = require('express');
const { getTmdbData } = require('../services/tmdb');
const { searchYgg, getTorrentHashFromYgg } = require('../services/yggapi');
const { searchSharewood } = require('../services/sharewoodapi');
const { uploadMagnets, getFilesFromMagnetId, unlockFileLink } = require('../services/alldebrid');
const { parseFileName, formatSize, getConfig } = require('../utils/helpers');
const logger = require('../utils/logger');
const { requireAccessKey } = require('../utils/auth');
const cache = require('../utils/cache');

const router = express.Router();

router.get('/:variables/stream/:type/:id.json', requireAccessKey, async (req, res) => {
  const startTime = Date.now(); // Start timer
  let config;

  // Log the start of a new stream request
  logger.info("--------------------");

  // Retrieve configuration
  try {
    config = getConfig(req);
  } catch (e) {
    logger.error("❌ Invalid configuration in request:", e.message);
    return res.status(400).json({ error: e.message });
  }

  // Parse optional NAMES from configuration (comma separated)
  const names = (config.NAMES || "").split(',').map(s => s.trim()).filter(Boolean);

  const { type, id } = req.params;
  logger.request(`Stream request received for ID: ${id}`);
  logger.debug(`📋 Request details - Type: ${type}, Full ID: ${id}`);

  // Parse the ID to extract IMDB ID, season, and episode
  const parts = id.split(':');
  const imdbId = parts[0];
  const season = parts[1];
  const episode = parts[2];
  
  logger.debug(`🔍 Parsed ID components - IMDB: ${imdbId}, Season: ${season || 'N/A'}, Episode: ${episode || 'N/A'}`);

  // Retrieve TMDB data based on IMDB ID
  logger.search(`Retrieving TMDB info for IMDB ID: ${imdbId}`);
  const tmdbData = await getTmdbData(imdbId, config);
  if (!tmdbData) {
    logger.warn(`❌ Unable to retrieve TMDB info for ${imdbId}`);
    const totalTime = Date.now() - startTime;
    logger.info(`❌ Request failed in ${totalTime}ms (no TMDB data)`);
    return res.json({ streams: [] });
  }
  
  logger.verbose(`📽️ TMDB Data - Title: "${tmdbData.title}", French: "${tmdbData.frenchTitle}", Type: ${tmdbData.type}`);

  // Call searchYgg and searchSharewood to retrieve processed torrents
  const searchKey = cache.generateKey('search', [tmdbData.title, tmdbData.type, season, episode, tmdbData.year]);
  let combinedResults = cache.getSearch(searchKey);
  
  if (!combinedResults) {
    const searchStartTime = Date.now();
    logger.search(`Starting parallel search on YGG and Sharewood for "${tmdbData.title}"${tmdbData.year ? ` (${tmdbData.year})` : ''}`);
    
    // Optimized parallel execution with Promise.allSettled for better error handling
    const searchPromises = [
      searchYgg(
        tmdbData.title,
        tmdbData.type,
        season,
        episode,
        config,
        tmdbData.frenchTitle,
        tmdbData.year,
        imdbId
      ).catch(err => {
        logger.error('❌ YGG search failed:', err.message);
        return { completeSeriesTorrents: [], completeSeasonTorrents: [], episodeTorrents: [], movieTorrents: [] };
      }),
      searchSharewood(
        tmdbData.title,
        tmdbData.type,
        season,
        episode,
        config,
        tmdbData.year
      ).catch(err => {
        logger.error('❌ Sharewood search failed:', err.message);
        return { completeSeriesTorrents: [], completeSeasonTorrents: [], episodeTorrents: [], movieTorrents: [] };
      })
    ];

    const [yggResults, sharewoodResults] = await Promise.allSettled(searchPromises);
    
    const yggData = yggResults.status === 'fulfilled' ? yggResults.value : { completeSeriesTorrents: [], completeSeasonTorrents: [], episodeTorrents: [], movieTorrents: [] };
    const sharewoodData = sharewoodResults.status === 'fulfilled' ? sharewoodResults.value : { completeSeriesTorrents: [], completeSeasonTorrents: [], episodeTorrents: [], movieTorrents: [] };

    logger.verbose(`🎯 YGG Results - Complete Series: ${yggData.completeSeriesTorrents.length}, Seasons: ${yggData.completeSeasonTorrents.length}, Episodes: ${yggData.episodeTorrents.length}, Movies: ${yggData.movieTorrents.length}`);
    logger.verbose(`🎯 Sharewood Results - Complete Series: ${sharewoodData.completeSeriesTorrents.length}, Seasons: ${sharewoodData.completeSeasonTorrents.length}, Episodes: ${sharewoodData.episodeTorrents.length}, Movies: ${sharewoodData.movieTorrents.length}`);

    // Combine results from both sources
    combinedResults = {
      completeSeriesTorrents: [
        ...yggData.completeSeriesTorrents,
        ...sharewoodData.completeSeriesTorrents
      ],
      completeSeasonTorrents: [
        ...yggData.completeSeasonTorrents,
        ...sharewoodData.completeSeasonTorrents
      ],
      episodeTorrents: [
        ...yggData.episodeTorrents,
        ...sharewoodData.episodeTorrents
      ],
      movieTorrents: [
        ...yggData.movieTorrents,
        ...sharewoodData.movieTorrents
      ]
    };
    
    const searchTime = Date.now() - searchStartTime;
    logger.info(`🔍 Search completed in ${searchTime}ms`);
    
    // Cache the combined search results
    cache.setSearch(searchKey, combinedResults);
  } else {
    logger.info(`⚡ Search cache hit for "${tmdbData.title}"`);
  }

  logger.debug(`🔗 Combined Results: ${JSON.stringify(combinedResults, null, 2)}`);

  // Check if any results were found
  if (!combinedResults || (
    combinedResults.completeSeriesTorrents.length === 0 &&
    combinedResults.completeSeasonTorrents.length === 0 &&
    combinedResults.episodeTorrents.length === 0 &&
    combinedResults.movieTorrents.length === 0
  )) {
    logger.warn("❌ No torrents found for the requested content.");
    return res.json({ streams: [] });
  }

  // Combine torrents based on type (series or movie) with optimal priority order
  let allTorrents = [];
  if (type === "series") {
    const { completeSeriesTorrents, completeSeasonTorrents, episodeTorrents } = combinedResults;

    logger.debug(`📝 Episode torrents (PRIORITY 1): ${episodeTorrents.map(t => `${t.title} (${t.source})`).join(', ')}`);
    logger.debug(`📝 Complete season torrents (PRIORITY 2): ${completeSeasonTorrents.map(t => `${t.title} (${t.source})`).join(', ')}`);
    logger.debug(`📝 Complete series torrents (PRIORITY 3): ${completeSeriesTorrents.map(t => `${t.title} (${t.source})`).join(', ')}`);

    // Filter episode torrents to ensure they match the requested season and episode
    const seasonEpisodePattern1 = `s${season.padStart(2, '0')}e${episode.padStart(2, '0')}`;
    const seasonEpisodePattern2 = `s${season.padStart(2, '0')}.e${episode.padStart(2, '0')}`;
    
    logger.filter(`Final filtering of episodes with patterns: "${seasonEpisodePattern1}" and "${seasonEpisodePattern2}"`);
    
    const filteredEpisodeTorrents = episodeTorrents.filter(torrent => {
      const torrentTitle = torrent.title.toLowerCase();
      const matches = torrentTitle.includes(seasonEpisodePattern1) || torrentTitle.includes(seasonEpisodePattern2);
      logger.debug(`🔍 Final episode filter "${torrent.title}": ${matches ? '✅ MATCH' : '❌ SKIP'}`);
      return matches;
    });

    logger.verbose(`🎯 Final filtered episodes: ${filteredEpisodeTorrents.length}/${episodeTorrents.length} torrents match S${season.padStart(2, '0')}E${episode.padStart(2, '0')}`);
    
    // OPTIMAL ORDER: Specific episode → Complete season → Complete series
    allTorrents = [
      ...filteredEpisodeTorrents,     // PRIORITÉ 1: Épisodes exacts
      ...completeSeasonTorrents,      // PRIORITÉ 2: Saisons complètes  
      ...completeSeriesTorrents       // PRIORITÉ 3: Séries complètes
    ];
    
    logger.info(`🎯 Torrent priority order - Episodes: ${filteredEpisodeTorrents.length}, Seasons: ${completeSeasonTorrents.length}, Series: ${completeSeriesTorrents.length}`);
  } else if (type === "movie") {
    const { movieTorrents } = combinedResults;
    logger.debug(`📝 Movie torrents: ${movieTorrents.map(t => `${t.title} (${t.source})`).join(', ')}`);
    allTorrents = [...movieTorrents];
  }

  // Limit the number of torrents to process - Optimized for speed like StreamFusion
  const maxTorrentsToProcess = Math.min(config.FILES_TO_SHOW, 2); // Further reduced to 2 for maximum speed
  
  // FILTRAGE INTELLIGENT: Optimiser la qualité avant envoi à AllDebrid (MODE PERMISSIF)
  const intelligentFilter = (torrents) => {
    const parseSizeMB = (size) => {
      if (!size && size !== 0) return 0;
      // If already a number, assume bytes if large, otherwise assume MB
      if (typeof size === 'number') {
        if (size > 1000) return Math.round(size / (1024 * 1024));
        return Math.round(size);
      }

      const s = String(size).trim();
      // Match patterns like "1.2 GB", "700 MB", or raw bytes like "1048576"
      const m = s.match(/^([\d,.]+)\s*(kb|mb|gb|tb)?/i);
      if (m) {
        let val = parseFloat(m[1].replace(',', '.'));
        const unit = (m[2] || '').toLowerCase();
        if (unit === 'kb') return Math.round(val / 1024);
        if (unit === 'mb') return Math.round(val);
        if (unit === 'gb') return Math.round(val * 1024);
        if (unit === 'tb') return Math.round(val * 1024 * 1024);
        // no unit: if value looks big, treat as bytes -> convert to MB
        if (!unit) {
          if (val > 1000) return Math.round(val / (1024 * 1024));
          return Math.round(val);
        }
      }

      // Fallback: extract digits and convert
      const digits = s.replace(/[^\d]/g, '');
      if (!digits) return 0;
      const v = parseInt(digits, 10);
      if (v > 1000) return Math.round(v / (1024 * 1024));
      return v;
    };

    logger.debug(`🔍 Starting intelligent filter on ${torrents.length} torrents...`);
    
    return torrents
      // 1. Filtrer par taille de manière permissive (garder plus de torrents)
      .filter(torrent => {
        const sizeMB = parseSizeMB(torrent.size);
        const sizeOK = sizeMB === 0 || // Garder si pas de taille (on ne peut pas juger)
          (type === "series" ? sizeMB >= 10 : sizeMB >= 100); // Critères très permissifs
        
        logger.debug(`📏 Size filter "${torrent.title}": ${torrent.size} → ${sizeMB}MB → ${sizeOK ? '✅ KEEP' : '❌ SKIP'}`);
        return sizeOK;
      })
      // 2. Trier par qualité (priorité aux 1080p, 720p, puis le reste) - PAS DE FILTRAGE SUPPLÉMENTAIRE
      .sort((a, b) => {
        const getQualityScore = (title) => {
          const lower = title.toLowerCase();
          if (lower.includes('1080p') || lower.includes('1080')) return 100;
          if (lower.includes('720p') || lower.includes('720')) return 90;
          if (lower.includes('2160p') || lower.includes('4k')) return 95;
          if (lower.includes('480p') || lower.includes('480')) return 70;
          return 60;
        };
        const scoreA = getQualityScore(a.title);
        const scoreB = getQualityScore(b.title);
        logger.debug(`🎬 Quality sort "${a.title}" (${scoreA}) vs "${b.title}" (${scoreB})`);
        return scoreB - scoreA;
      });
      // Seeds sorting removed - not relevant for cached files
  };
  
  logger.info(`🧠 Applying intelligent filtering to ${allTorrents.length} torrents...`);
  const filteredTorrents = intelligentFilter(allTorrents);
  logger.info(`🎯 Intelligent filter result: ${filteredTorrents.length}/${allTorrents.length} torrents kept after quality/size filtering`);
  
  // Comparaison avant/après pour debug
  if (filteredTorrents.length < allTorrents.length) {
    logger.debug(`📊 Filtered out ${allTorrents.length - filteredTorrents.length} torrents:`);
    const removed = allTorrents.filter(t => !filteredTorrents.includes(t));
    removed.slice(0, 3).forEach(t => {
      logger.debug(`❌ Removed: "${t.title}" (size: ${t.size})`);
    });
  }
  
  const limitedTorrents = filteredTorrents.slice(0, maxTorrentsToProcess);
  logger.info(`📊 Processing ${limitedTorrents.length} high-quality torrents (limit: ${maxTorrentsToProcess})`);

  // Retrieve hashes for the torrents and detect duplicates
  const magnets = [];
  const hashSourceMap = new Map(); // Track which sources have which hashes
  
  for (const torrent of limitedTorrents) {
    if (torrent.hash) {
      // Track sources for this hash
      if (!hashSourceMap.has(torrent.hash)) {
        hashSourceMap.set(torrent.hash, []);
      }
      hashSourceMap.get(torrent.hash).push(torrent.source);
      
      magnets.push({ 
        hash: torrent.hash, 
        title: torrent.title, 
        source: torrent.source || "Unknown",
        sources: hashSourceMap.get(torrent.hash) // All sources for this hash
      });
    } else {
      const hash = await getTorrentHashFromYgg(torrent.id);
      if (hash) {
        torrent.hash = hash;
        magnets.push({ hash, title: torrent.title, source: torrent.source || "Unknown" });
      } else {
        logger.warn(`❌ Skipping torrent: ${torrent.title} (no hash found)`);
      }
    }
  }

  logger.info(`✅ Processed ${magnets.length} torrents (limited to ${maxTorrentsToProcess}).`);

  // Check if any magnets are available
  if (magnets.length === 0) {
    logger.warn("❌ No magnets available for upload.");
    return res.json({ streams: [] });
  }

  // Upload magnets to AllDebrid
  const allDebridStartTime = Date.now();
  logger.info(`🔄 Uploading ${magnets.length} magnets to AllDebrid`);
  const uploadedStatuses = await uploadMagnets(magnets, config);
  const allDebridTime = Date.now() - allDebridStartTime;
  logger.info(`⚡ AllDebrid processing completed in ${allDebridTime}ms`);

  // Filter ready torrents
  const readyTorrents = uploadedStatuses.filter(file => file.ready === '✅ Ready');

  logger.info(`✅ ${readyTorrents.length} ready torrents found.`);
  readyTorrents.forEach(torrent => {
    logger.debug(`✅ Ready torrent: ${torrent.hash} (Torrent: ${torrent.name})`);
  });

  // Unlock files from ready torrents
  const streams = [];
  const unlockAndAddStreams = async (readyTorrents) => {
    for (const torrent of readyTorrents) {
      if (streams.length >= config.FILES_TO_SHOW) {
        logger.info(`🎯 Reached the maximum number of streams (${config.FILES_TO_SHOW}). Stopping.`);
        break;
      }

      const videoFiles = await getFilesFromMagnetId(torrent.id, torrent.source, config);

      // Filter relevant video files
      const filteredFiles = videoFiles.filter(file => {
        const fileName = file.name.toLowerCase();

        // First, check episode/movie match
        let matchesContent = false;
        if (type === "series") {
          const seasonEpisodePattern = `s${season.padStart(2, '0')}e${episode.padStart(2, '0')}`;
          matchesContent = fileName.includes(seasonEpisodePattern);
          logger.debug(`🔍 Checking episode pattern "${seasonEpisodePattern}" against file "${fileName}": ${matchesContent}`);
        } else if (type === "movie") {
          matchesContent = true;
          logger.debug(`✅ File matches movie content: ${file.name}`);
        }

        if (!matchesContent) {
          logger.debug(`❌ File excluded (content mismatch): ${file.name}`);
          return false;
        }

        // Then, filter by resolution BEFORE unlocking (to avoid unnecessary AllDebrid calls)
        if (config.RES_TO_SHOW && config.RES_TO_SHOW.length > 0) {
          const { resolution } = parseFileName(file.name);
          const { resolution: torrentResolution } = parseFileName(torrent.name);
          
          // Use torrent resolution if file doesn't have one (common for season packs)
          const actualResolution = resolution !== '?' ? resolution : torrentResolution;
          
          const allowedResolutions = config.RES_TO_SHOW.map(r => r.toLowerCase());
          let fileResolution = actualResolution.toLowerCase();
          
          // Normalize 4K to 2160p for comparison
          if (fileResolution === '4k') {
            fileResolution = '2160p';
          }
          
          if (!allowedResolutions.includes(fileResolution)) {
            logger.debug(`⚠️ Pre-filtering out ${actualResolution} file (not in allowed resolutions: ${config.RES_TO_SHOW.join(', ')}): ${file.name}`);
            return false;
          }
        }

        // Also filter by codec if specified
        if (config.CODECS_TO_SHOW && config.CODECS_TO_SHOW.length > 0) {
          const { codec } = parseFileName(file.name);
          const { codec: torrentCodec } = parseFileName(torrent.name);
          
          // Use torrent codec if file doesn't have one (common for season packs)
          const actualCodec = codec !== '?' ? codec : torrentCodec;
          
          const allowedCodecs = config.CODECS_TO_SHOW.map(c => c.toLowerCase());
          let fileCodec = actualCodec.toLowerCase();
          
          // Normalize codec names: x265 and hevc are both h265
          if (fileCodec.includes('x265') || fileCodec.includes('hevc')) {
            fileCodec = 'h265';
          } else if (fileCodec.includes('x264') || fileCodec.includes('avc')) {
            fileCodec = 'h264';
          }
          
          if (!allowedCodecs.includes(fileCodec)) {
            logger.debug(`⚠️ Pre-filtering out ${actualCodec} file (not in allowed codecs: ${config.CODECS_TO_SHOW.join(', ')}): ${file.name}`);
            return false;
          }
        }

        // Also filter by language if specified
        if (config.LANG_TO_SHOW && config.LANG_TO_SHOW.length > 0) {
          const { language } = parseFileName(file.name);
          const { language: torrentLanguage } = parseFileName(torrent.name);
          
          // Use torrent language if file doesn't have one (common for season packs)
          const actualLanguage = language !== '?' ? language : torrentLanguage;
          
          const allowedLanguages = config.LANG_TO_SHOW.map(l => l.toLowerCase());
          const fileLanguage = actualLanguage.toLowerCase();
          
          if (!allowedLanguages.includes(fileLanguage)) {
            logger.debug(`⚠️ Pre-filtering out ${actualLanguage} file (not in allowed languages: ${config.LANG_TO_SHOW.join(', ')}): ${file.name}`);
            return false;
          }
        }

        logger.debug(`✅ File passed all filters: ${file.name}`);
        return true;
      });

      // Unlock filtered files
      for (const file of filteredFiles) {
        if (streams.length >= config.FILES_TO_SHOW) {
          logger.info(`🎯 Reached the maximum number of streams (${config.FILES_TO_SHOW}). Stopping.`);
          break;
        }

        const unlockedLink = await unlockFileLink(file.link, config);
        if (unlockedLink) {
          const fileMetadata = parseFileName(file.name);
          const torrentMetadata = parseFileName(torrent.name);
          
          // Use torrent metadata if file metadata is unknown
          const resolution = fileMetadata.resolution !== '?' ? fileMetadata.resolution : torrentMetadata.resolution;
          const codec = fileMetadata.codec !== '?' ? fileMetadata.codec : torrentMetadata.codec;
          const language = fileMetadata.language !== '?' ? fileMetadata.language : torrentMetadata.language;
          const languageEmoji = fileMetadata.languageEmoji !== '?' ? fileMetadata.languageEmoji : torrentMetadata.languageEmoji;
          const source = fileMetadata.source;
          
          // Filtering already done before unlocking - no need to filter again
          
          // Normalize and beautify the display
          const qualityBadge = resolution === '2160p' ? '🏆' : resolution === '1080p' ? '⭐' : resolution === '720p' ? '✨' : '📺';
          const codecBadge = codec.toLowerCase().includes('265') || codec.toLowerCase().includes('hevc') ? '🔥' : '🎬';
          
          // Determine source display
          const isCommonHash = torrent.sources && torrent.sources.length > 1;
          const sourceDisplay = isCommonHash 
            ? `YGG + SW` 
            : torrent.source === 'YGG' 
              ? 'YGG' 
              : 'SW';
          
          const randomName = names.length ? names[Math.floor(Math.random() * names.length)] : null;
          streams.push({
            name: randomName ? `😻 Miaou ${randomName}` : `😻 Miaou`,
            title: `🎭 ${tmdbData.title}${season && episode ? ` • S${season.padStart(2, '0')}E${episode.padStart(2, '0')}` : ''}\n📁 ${file.name}\n🏴 ${sourceDisplay} ${languageEmoji} ${language} 🎨 ${source}\n💾 ${formatSize(file.size)} ${qualityBadge} ${resolution} ${codecBadge} ${codec.toUpperCase()}`,
            url: unlockedLink
          });
          logger.info(`✅ Unlocked video: ${file.name} (${isCommonHash ? 'Common hash' : torrent.source}) - ${language}`);
        }
      }

      // Log a warning if no files were unlocked
      if (filteredFiles.length === 0) {
        logger.warn(`⚠️ No files matched the requested season/episode for torrent ${torrent.hash}`);
      }
    }
  };

  await unlockAndAddStreams(readyTorrents);

  const totalTime = Date.now() - startTime;
  logger.info(`🎉 ${streams.length} stream(s) obtained in ${totalTime}ms`);
  res.json({ streams });
});

module.exports = router;