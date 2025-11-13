const express = require('express');
const { getTmdbData } = require('../services/tmdb');
const { searchYgg, getTorrentHashFromYgg } = require('../services/yggapi');
const { searchSharewood } = require('../services/sharewoodapi');
const { uploadMagnets, getFilesFromMagnetId } = require('../services/alldebrid');
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
  const requestTime = new Date().toISOString();
  logger.request(`STREAM REQUEST: ID=${id} [${requestTime}]`);
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

  // Combine torrents based on type (series or movie) with NEW optimal priority order
  let allTorrents = [];
  if (type === "series") {
    const { completeSeriesTorrents, completeSeasonTorrents, episodeTorrents } = combinedResults;

    logger.debug(`📝 Episode torrents: ${episodeTorrents.map(t => `${t.title} (${t.source})`).join(', ')}`);
    logger.debug(`📝 Complete season torrents: ${completeSeasonTorrents.map(t => `${t.title} (${t.source})`).join(', ')}`);
    logger.debug(`📝 Complete series torrents: ${completeSeriesTorrents.map(t => `${t.title} (${t.source})`).join(', ')}`);

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
    
    // NEW OPTIMAL ORDER: Complete series → Complete season → Specific episode
    // This provides more choice and better cache hit rates
    const maxStreams = config.FILES_TO_SHOW || 2;
    const stopThreshold = maxStreams * 2; // Stop when we have 2x more torrents than needed
    
    let torrentsAdded = 0;
    allTorrents = [];
    
    // PRIORITÉ 1: Séries complètes (plus de choix, meilleur cache)
    const seriesToAdd = Math.min(completeSeriesTorrents.length, Math.max(0, stopThreshold - torrentsAdded));
    allTorrents.push(...completeSeriesTorrents.slice(0, seriesToAdd));
    torrentsAdded += seriesToAdd;
    logger.debug(`📦 Added ${seriesToAdd} complete series torrents (total: ${torrentsAdded}/${stopThreshold})`);
    
    if (torrentsAdded < stopThreshold) {
      // PRIORITÉ 2: Saisons complètes
      const seasonsToAdd = Math.min(completeSeasonTorrents.length, Math.max(0, stopThreshold - torrentsAdded));
      allTorrents.push(...completeSeasonTorrents.slice(0, seasonsToAdd));
      torrentsAdded += seasonsToAdd;
      logger.debug(`📦 Added ${seasonsToAdd} complete season torrents (total: ${torrentsAdded}/${stopThreshold})`);
    }
    
    if (torrentsAdded < stopThreshold) {
      // PRIORITÉ 3: Épisodes exacts (en dernier)
      const episodesToAdd = Math.min(filteredEpisodeTorrents.length, Math.max(0, stopThreshold - torrentsAdded));
      allTorrents.push(...filteredEpisodeTorrents.slice(0, episodesToAdd));
      torrentsAdded += episodesToAdd;
      logger.debug(`📦 Added ${episodesToAdd} specific episode torrents (total: ${torrentsAdded}/${stopThreshold})`);
    }
    
    logger.info(`🎯 NEW Priority order - Series: ${completeSeriesTorrents.length}, Seasons: ${completeSeasonTorrents.length}, Episodes: ${filteredEpisodeTorrents.length}`);
    logger.info(`⚡ Smart stopping: ${torrentsAdded} torrents selected (limit: ${stopThreshold}, target streams: ${maxStreams})`);
  } else if (type === "movie") {
    const { movieTorrents } = combinedResults;
    logger.debug(`📝 Movie torrents: ${movieTorrents.map(t => `${t.title} (${t.source})`).join(', ')}`);
    allTorrents = [...movieTorrents];
  }

  // Smart torrent processing with new priority system
  const maxTorrentsToProcess = Math.min(allTorrents.length, config.FILES_TO_SHOW * 2); // Use the smart stopping logic
  
  // FILTRAGE INTELLIGENT: Optimiser la qualité avant envoi à AllDebrid (MODE PERMISSIF)
  const intelligentFilter = (torrents) => {
    logger.debug(`🔍 Starting intelligent filter on ${torrents.length} torrents...`);
    
    return torrents
      // Trier par qualité (priorité aux 1080p, 720p, puis le reste) - PAS DE FILTRAGE PAR TAILLE
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
  logger.info(`🎯 Intelligent filter result: ${filteredTorrents.length}/${allTorrents.length} torrents kept after quality sorting`);
  
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
  const hashMap = new Map(); // Map: hash -> torrent object with combined sources
  
  for (const torrent of limitedTorrents) {
    let hash = torrent.hash;
    
    // Get hash if not already available
    if (!hash) {
      hash = await getTorrentHashFromYgg(torrent.id);
      if (!hash) {
        logger.warn(`❌ Skipping torrent: ${torrent.title} (no hash found)`);
        continue;
      }
      torrent.hash = hash;
    }
    
    // Check if we already have this hash
    if (hashMap.has(hash)) {
      // Merge sources for duplicate hash
      const existingTorrent = hashMap.get(hash);
      if (!existingTorrent.sources) {
        existingTorrent.sources = [existingTorrent.source];
      }
      if (!existingTorrent.sources.includes(torrent.source)) {
        existingTorrent.sources.push(torrent.source);
        logger.debug(`🔗 Hash collision detected: ${existingTorrent.title} (${existingTorrent.sources.join(' + ')})`);
      }
    } else {
      // New unique hash
      hashMap.set(hash, {
        hash,
        title: torrent.title,
        source: torrent.source || "Unknown",
        sources: null // Will be set to array only if there are duplicates
      });
    }
  }
  
  // Convert to magnets array (deduplicated)
  for (const torrent of hashMap.values()) {
    magnets.push(torrent);
  }

  logger.info(`✅ Processed ${magnets.length} unique torrents (${limitedTorrents.length} original, deduplicated by hash)`);
  if (limitedTorrents.length > magnets.length) {
    logger.info(`🎯 Deduplication saved ${limitedTorrents.length - magnets.length} duplicate hash(es)`);
  }

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
          // Support multiple episode patterns: s01e01, 1x01, s1e1, etc.
          const seasonNum = parseInt(season);
          const episodeNum = parseInt(episode);
          const seasonPadded = season.padStart(2, '0');
          const episodePadded = episode.padStart(2, '0');
          
          const episodePatterns = [
            `s${seasonPadded}e${episodePadded}`,  // s01e01
            `s${seasonNum}e${episodeNum}`,        // s1e1  
            `${seasonNum}x${episodePadded}`,      // 1x01
            `${seasonPadded}x${episodePadded}`,   // 01x01
            `s${seasonPadded}.e${episodePadded}`, // s01.e01
            `s${seasonPadded} e${episodePadded}`, // s01 e01
            `season ${seasonNum} episode ${episodeNum}`, // season 1 episode 1
            `saison ${seasonNum} episode ${episodeNum}`,  // saison 1 episode 1
          ];
          
          matchesContent = episodePatterns.some(pattern => fileName.includes(pattern));
          
          if (matchesContent) {
            const matchedPattern = episodePatterns.find(pattern => fileName.includes(pattern));
            logger.debug(`🔍 Episode pattern "${matchedPattern}" MATCHES file "${fileName}": ${matchesContent}`);
          } else {
            logger.debug(`🔍 No episode patterns match file "${fileName}" (tried: ${episodePatterns.slice(0, 3).join(', ')}...)`);
          }
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
      let foundMatchInSeasonPack = false;
      
      for (const file of filteredFiles) {
        if (streams.length >= config.FILES_TO_SHOW) {
          logger.info(`🎯 Reached the maximum number of streams (${config.FILES_TO_SHOW}). Stopping.`);
          break;
        }

        // 🚀 NEW: Create deferred unlock link instead of immediate unlocking
        const fileMetadata = parseFileName(file.name);
        const torrentMetadata = parseFileName(torrent.name);
        
        // Use torrent metadata if file metadata is unknown
        const resolution = fileMetadata.resolution !== '?' ? fileMetadata.resolution : torrentMetadata.resolution;
        const codec = fileMetadata.codec !== '?' ? fileMetadata.codec : torrentMetadata.codec;
        const language = fileMetadata.language !== '?' ? fileMetadata.language : torrentMetadata.language;
        const languageEmoji = fileMetadata.languageEmoji !== '?' ? fileMetadata.languageEmoji : torrentMetadata.languageEmoji;
        const source = fileMetadata.source;
        
        // Create deferred unlock data
        const unlockData = {
          fileName: file.name,
          allDebridLink: file.link,
          source: torrent.source || 'Unknown',
          size: file.size
        };
        
        // Encode data for URL (base64url safe)
        const encodedData = Buffer.from(JSON.stringify(unlockData))
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        
        // Create deferred unlock URL
        const serverUrl = `${req.protocol}://${req.get('host')}`;
        const deferredUnlockUrl = `${serverUrl}/${req.params.variables}/unlock/${encodedData}`;
        
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
          url: deferredUnlockUrl
        });
        logger.info(`🔗 Created deferred unlock link: ${file.name} (${isCommonHash ? 'Common hash' : torrent.source}) - ${language}`);
        
        // 🚀 OPTIMIZATION: If this is a season pack and we found our episode, no need to continue with other files
        const torrentTitle = torrent.name.toLowerCase();
        const isSeasonPack = torrentTitle.includes('season') || torrentTitle.includes('saison') || 
                           torrentTitle.includes('complete') || torrentTitle.includes('integral') ||
                           torrentTitle.match(/s\d+/i) && !torrentTitle.match(/s\d+e\d+/i);
        
        if (isSeasonPack) {
          foundMatchInSeasonPack = true;
          logger.debug(`🚀 Found episode in season pack, stopping further file processing for this torrent`);
          break;
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