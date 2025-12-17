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
  const startTime = Date.now();
  logger.info('[stream] IN: /:variables/stream/:type/:id.json');
  let config;
  try {
    config = getConfig(req);
  } catch (e) {
    logger.error('[stream] Invalid configuration in request:', e.message);
    return res.status(400).json({ error: e.message });
  }
  const names = (config.NAMES || '').split(',').map(s => s.trim()).filter(Boolean);
  const { type, id } = req.params;
  const requestTime = new Date().toISOString();
  logger.info(`[stream] 📥 STREAM REQUEST: ID=${id} [${requestTime}]`);
  logger.debug(`[stream] Request details - Type: ${type}, Full ID: ${id}`);
  const parts = id.split(':');
  const imdbId = parts[0];
  const season = parts[1];
  const episode = parts[2];
  logger.debug(`[stream] Parsed ID components - IMDB: ${imdbId}, Season: ${season || 'N/A'}, Episode: ${episode || 'N/A'}`);
  logger.verbose(`[stream] 🔍 Retrieving TMDB info for IMDB ID: ${imdbId}`);
  const tmdbData = await getTmdbData(imdbId, config);
  if (!tmdbData) {
    logger.warn(`[stream] Unable to retrieve TMDB info for ${imdbId}`);
    const totalTime = Date.now() - startTime;
    logger.info(`[stream] Request failed in ${totalTime}ms (no TMDB data)`);
    return res.json({ streams: [] });
  }
  logger.verbose(`[stream] TMDB Data - Title: "${tmdbData.title}", French: "${tmdbData.frenchTitle}", Type: ${tmdbData.type}`);
  const searchKey = cache.generateKey('search', [tmdbData.title, tmdbData.type, season, episode, tmdbData.year]);
  let combinedResults = cache.getSearch(searchKey);
  if (!combinedResults) {
    const searchStartTime = Date.now();
    logger.verbose(`[stream] 🔍 Starting parallel search on YGG and Sharewood for "${tmdbData.title}"${tmdbData.year ? ` (${tmdbData.year})` : ''}`);
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
        logger.error('[stream] YGG search failed:', err.message);
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
        logger.error('[stream] Sharewood search failed:', err.message);
        return { completeSeriesTorrents: [], completeSeasonTorrents: [], episodeTorrents: [], movieTorrents: [] };
      })
    ];
    const [yggResults, sharewoodResults] = await Promise.allSettled(searchPromises);
    const yggData = yggResults.status === 'fulfilled' ? yggResults.value : { completeSeriesTorrents: [], completeSeasonTorrents: [], episodeTorrents: [], movieTorrents: [] };
    const sharewoodData = sharewoodResults.status === 'fulfilled' ? sharewoodResults.value : { completeSeriesTorrents: [], completeSeasonTorrents: [], episodeTorrents: [], movieTorrents: [] };
    logger.verbose(`[stream] YGG Results - Complete Series: ${yggData.completeSeriesTorrents.length}, Seasons: ${yggData.completeSeasonTorrents.length}, Episodes: ${yggData.episodeTorrents.length}, Movies: ${yggData.movieTorrents.length}`);
    logger.verbose(`[stream] Sharewood Results - Complete Series: ${sharewoodData.completeSeriesTorrents.length}, Seasons: ${sharewoodData.completeSeasonTorrents.length}, Episodes: ${sharewoodData.episodeTorrents.length}, Movies: ${sharewoodData.movieTorrents.length}`);
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
    logger.info(`[stream] Search completed in ${searchTime}ms`);
    const hasResults =
      (combinedResults.completeSeriesTorrents && combinedResults.completeSeriesTorrents.length > 0) ||
      (combinedResults.completeSeasonTorrents && combinedResults.completeSeasonTorrents.length > 0) ||
      (combinedResults.episodeTorrents && combinedResults.episodeTorrents.length > 0) ||
      (combinedResults.movieTorrents && combinedResults.movieTorrents.length > 0);
    if (hasResults) {
      cache.setSearch(searchKey, combinedResults);
    } else {
      logger.warn(`[stream] No results to cache for key: ${searchKey}`);
    }
  } else {
    logger.info(`[stream] Search cache hit for "${tmdbData.title}"`);
  }
  // logger.debug(`[stream] Combined Results: ${JSON.stringify(combinedResults, null, 2)}`); // Suppressed: too verbose
  if (!combinedResults || (
    combinedResults.completeSeriesTorrents.length === 0 &&
    combinedResults.completeSeasonTorrents.length === 0 &&
    combinedResults.episodeTorrents.length === 0 &&
    combinedResults.movieTorrents.length === 0
  )) {
    logger.warn('[stream] No torrents found for the requested content.');
    return res.json({ streams: [] });
  }
  let allTorrents = [];
  if (type === 'series') {
    const { completeSeriesTorrents, completeSeasonTorrents, episodeTorrents } = combinedResults;
    logger.debug(`[stream] Episode torrents: ${episodeTorrents.map(t => `${t.title} (${t.source})`).join(', ')}`);
    logger.debug(`[stream] Complete season torrents: ${completeSeasonTorrents.map(t => `${t.title} (${t.source})`).join(', ')}`);
    logger.debug(`[stream] Complete series torrents: ${completeSeriesTorrents.map(t => `${t.title} (${t.source})`).join(', ')}`);
    const seasonEpisodePattern1 = `s${season.padStart(2, '0')}e${episode.padStart(2, '0')}`;
    const seasonEpisodePattern2 = `s${season.padStart(2, '0')}.e${episode.padStart(2, '0')}`;
    logger.debug(`[stream] 🎯 Final filtering of episodes with patterns: "${seasonEpisodePattern1}" and "${seasonEpisodePattern2}"`);
    const filteredEpisodeTorrents = episodeTorrents.filter(torrent => {
      const torrentTitle = torrent.title.toLowerCase();
      const matches = torrentTitle.includes(seasonEpisodePattern1) || torrentTitle.includes(seasonEpisodePattern2);
      logger.debug(`[stream] Final episode filter "${torrent.title}": ${matches ? '✅ MATCH' : '❌ SKIP'}`);
      return matches;
    });
    logger.verbose(`[stream] Final filtered episodes: ${filteredEpisodeTorrents.length}/${episodeTorrents.length} torrents match S${season.padStart(2, '0')}E${episode.padStart(2, '0')}`);
    const maxStreams = config.FILES_TO_SHOW || 2;
    const stopThreshold = maxStreams * 2;
    let torrentsAdded = 0;
    allTorrents = [];
    const seriesToAdd = Math.min(completeSeriesTorrents.length, Math.max(0, stopThreshold - torrentsAdded));
    allTorrents.push(...completeSeriesTorrents.slice(0, seriesToAdd));
    torrentsAdded += seriesToAdd;
    logger.debug(`[stream] Added ${seriesToAdd} complete series torrents (total: ${torrentsAdded}/${stopThreshold})`);
    if (torrentsAdded < stopThreshold) {
      const seasonsToAdd = Math.min(completeSeasonTorrents.length, Math.max(0, stopThreshold - torrentsAdded));
      allTorrents.push(...completeSeasonTorrents.slice(0, seasonsToAdd));
      torrentsAdded += seasonsToAdd;
      logger.debug(`[stream] Added ${seasonsToAdd} complete season torrents (total: ${torrentsAdded}/${stopThreshold})`);
    }
    if (torrentsAdded < stopThreshold) {
      const episodesToAdd = Math.min(filteredEpisodeTorrents.length, Math.max(0, stopThreshold - torrentsAdded));
      allTorrents.push(...filteredEpisodeTorrents.slice(0, episodesToAdd));
      torrentsAdded += episodesToAdd;
      logger.debug(`[stream] Added ${episodesToAdd} specific episode torrents (total: ${torrentsAdded}/${stopThreshold})`);
    }
    logger.info(`[stream] NEW Priority order - Series: ${completeSeriesTorrents.length}, Seasons: ${completeSeasonTorrents.length}, Episodes: ${filteredEpisodeTorrents.length}`);
    logger.info(`[stream] Smart stopping: ${torrentsAdded} torrents selected (limit: ${stopThreshold}, target streams: ${maxStreams})`);
  } else if (type === 'movie') {
    const { movieTorrents } = combinedResults;
    logger.debug(`[stream] Movie torrents: ${movieTorrents.map(t => `${t.title} (${t.source})`).join(', ')}`);
    allTorrents = [...movieTorrents];
  }
  const maxTorrentsToProcess = Math.min(allTorrents.length, config.FILES_TO_SHOW * 2);
  const intelligentFilter = (torrents) => {
    logger.debug(`[stream] Starting intelligent filter on ${torrents.length} torrents...`);
    return torrents
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
        logger.debug(`[stream] Quality sort "${a.title}" (${scoreA}) vs "${b.title}" (${scoreB})`);
        return scoreB - scoreA;
      });
  };
  logger.info(`[stream] Applying intelligent filtering to ${allTorrents.length} torrents...`);
  const filteredTorrents = intelligentFilter(allTorrents);
  logger.info(`[stream] Intelligent filter result: ${filteredTorrents.length}/${allTorrents.length} torrents kept after quality sorting`);
  if (filteredTorrents.length < allTorrents.length) {
    logger.debug(`[stream] Filtered out ${allTorrents.length - filteredTorrents.length} torrents:`);
    const removed = allTorrents.filter(t => !filteredTorrents.includes(t));
    removed.slice(0, 3).forEach(t => {
      logger.debug(`[stream] Removed: "${t.title}" (size: ${t.size})`);
    });
  }
  const limitedTorrents = filteredTorrents.slice(0, maxTorrentsToProcess);
  logger.info(`[stream] Processing ${limitedTorrents.length} high-quality torrents (limit: ${maxTorrentsToProcess})`);
  const magnets = [];
  const hashMap = new Map();
  for (const torrent of limitedTorrents) {
    let hash = torrent.hash;
    if (!hash) {
      hash = await getTorrentHashFromYgg(torrent.id);
      if (!hash) {
        logger.warn(`[stream] Skipping torrent: ${torrent.title} (no hash found)`);
        continue;
      }
      torrent.hash = hash;
    }
    if (hashMap.has(hash)) {
      const existingTorrent = hashMap.get(hash);
      if (!existingTorrent.sources) {
        existingTorrent.sources = [existingTorrent.source];
      }
      if (!existingTorrent.sources.includes(torrent.source)) {
        existingTorrent.sources.push(torrent.source);
        logger.debug(`[stream] Hash collision detected: ${existingTorrent.title} (${existingTorrent.sources.join(' + ')})`);
      }
    } else {
      hashMap.set(hash, {
        hash,
        title: torrent.title,
        source: torrent.source || 'Unknown',
        sources: null
      });
    }
  }
  for (const torrent of hashMap.values()) {
    magnets.push(torrent);
  }
  logger.info(`[stream] Processed ${magnets.length} unique torrents (${limitedTorrents.length} original, deduplicated by hash)`);
  if (limitedTorrents.length > magnets.length) {
    logger.info(`[stream] Deduplication saved ${limitedTorrents.length - magnets.length} duplicate hash(es)`);
  }
  if (magnets.length === 0) {
    logger.warn('[stream] No magnets available for upload.');
    return res.json({ streams: [] });
  }
  const allDebridStartTime = Date.now();
  logger.info(`[stream] Uploading ${magnets.length} magnets to AllDebrid`);
  const uploadedStatuses = await uploadMagnets(magnets, config);
  const allDebridTime = Date.now() - allDebridStartTime;
  logger.info(`[stream] AllDebrid processing completed in ${allDebridTime}ms`);
  const readyTorrents = uploadedStatuses.filter(file => file.ready === '✅ Ready');
  logger.info(`[stream] ${readyTorrents.length} ready torrents found.`);
  readyTorrents.forEach(torrent => {
    logger.debug(`[stream] Ready torrent: ${torrent.hash} (Torrent: ${torrent.name})`);
  });
  const streams = [];
  const unlockAndAddStreams = async (readyTorrents) => {
    for (const torrent of readyTorrents) {
      if (streams.length >= config.FILES_TO_SHOW) {
        logger.info(`[stream] Reached the maximum number of streams (${config.FILES_TO_SHOW}). Stopping.`);
        break;
      }
      const videoFiles = await getFilesFromMagnetId(torrent.id, torrent.source, config);
      const filteredFiles = videoFiles.filter(file => {
        const fileName = file.name.toLowerCase();
        let matchesContent = false;
        if (type === 'series') {
          const seasonNum = parseInt(season);
          const episodeNum = parseInt(episode);
          const seasonPadded = season.padStart(2, '0');
          const episodePadded = episode.padStart(2, '0');
          const episodePatterns = [
            `s${seasonPadded}e${episodePadded}`,
            `s${seasonNum}e${episodeNum}`,
            `${seasonNum}x${episodePadded}`,
            `${seasonPadded}x${episodePadded}`,
            `s${seasonPadded}.e${episodePadded}`,
            `s${seasonPadded} e${episodePadded}`,
            `season ${seasonNum} episode ${episodeNum}`,
            `saison ${seasonNum} episode ${episodeNum}`
          ];
          matchesContent = episodePatterns.some(pattern => fileName.includes(pattern));
          if (matchesContent) {
            const matchedPattern = episodePatterns.find(pattern => fileName.includes(pattern));
            logger.debug(`[stream] Episode pattern "${matchedPattern}" MATCHES file "${fileName}": ${matchesContent}`);
          } else {
            logger.debug(`[stream] No episode patterns match file "${fileName}" (tried: ${episodePatterns.slice(0, 3).join(', ')}...)`);
          }
        } else if (type === 'movie') {
          matchesContent = true;
          logger.debug(`[stream] File matches movie content: ${file.name}`);
        }
        if (!matchesContent) {
          logger.debug(`[stream] File excluded (content mismatch): ${file.name}`);
          return false;
        }
        if (config.RES_TO_SHOW && config.RES_TO_SHOW.length > 0) {
          const { resolution } = parseFileName(file.name);
          const { resolution: torrentResolution } = parseFileName(torrent.name);
          const actualResolution = resolution !== '?' ? resolution : torrentResolution;
          const allowedResolutions = config.RES_TO_SHOW.map(r => r.toLowerCase());
          let fileResolution = actualResolution.toLowerCase();
          if (fileResolution === '4k') {
            fileResolution = '2160p';
          }
          if (!allowedResolutions.includes(fileResolution)) {
            logger.debug(`[stream] Pre-filtering out ${actualResolution} file (not in allowed resolutions: ${config.RES_TO_SHOW.join(', ')}): ${file.name}`);
            return false;
          }
        }
        if (config.CODECS_TO_SHOW && config.CODECS_TO_SHOW.length > 0) {
          const { codec } = parseFileName(file.name);
          const { codec: torrentCodec } = parseFileName(torrent.name);
          const actualCodec = codec !== '?' ? codec : torrentCodec;
          const allowedCodecs = config.CODECS_TO_SHOW.map(c => c.toLowerCase());
          let fileCodec = actualCodec.toLowerCase();
          if (fileCodec.includes('x265') || fileCodec.includes('hevc')) {
            fileCodec = 'h265';
          } else if (fileCodec.includes('x264') || fileCodec.includes('avc')) {
            fileCodec = 'h264';
          }
          if (!allowedCodecs.includes(fileCodec)) {
            logger.debug(`[stream] Pre-filtering out ${actualCodec} file (not in allowed codecs: ${config.CODECS_TO_SHOW.join(', ')}): ${file.name}`);
            return false;
          }
        }
        if (config.LANG_TO_SHOW && config.LANG_TO_SHOW.length > 0) {
          const { language } = parseFileName(file.name);
          const { language: torrentLanguage } = parseFileName(torrent.name);
          const actualLanguage = language !== '?' ? language : torrentLanguage;
          const allowedLanguages = config.LANG_TO_SHOW.map(l => l.toLowerCase());
          const fileLanguage = actualLanguage.toLowerCase();
          if (!allowedLanguages.includes(fileLanguage)) {
            logger.debug(`[stream] Pre-filtering out ${actualLanguage} file (not in allowed languages: ${config.LANG_TO_SHOW.join(', ')}): ${file.name}`);
            return false;
          }
        }
        logger.debug(`[stream] File passed all filters: ${file.name}`);
        return true;
      });
      let foundMatchInSeasonPack = false;
      for (const file of filteredFiles) {
        if (streams.length >= config.FILES_TO_SHOW) {
          logger.info(`[stream] Reached the maximum number of streams (${config.FILES_TO_SHOW}). Stopping.`);
          break;
        }
        const fileMetadata = parseFileName(file.name);
        const torrentMetadata = parseFileName(torrent.name);
        const resolution = fileMetadata.resolution !== '?' ? fileMetadata.resolution : torrentMetadata.resolution;
        const codec = fileMetadata.codec !== '?' ? fileMetadata.codec : torrentMetadata.codec;
        const language = fileMetadata.language !== '?' ? fileMetadata.language : torrentMetadata.language;
        const languageEmoji = fileMetadata.languageEmoji !== '?' ? fileMetadata.languageEmoji : torrentMetadata.languageEmoji;
        const source = fileMetadata.source;
        const unlockData = {
          fileName: file.name,
          allDebridLink: file.link,
          source: torrent.source || 'Unknown',
          size: file.size
        };
        const encodedData = Buffer.from(JSON.stringify(unlockData))
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        const serverUrl = `${req.protocol}://${req.get('host')}`;
        const deferredUnlockUrl = `${serverUrl}/${req.params.variables}/unlock/${encodedData}`;
        const qualityBadge = resolution === '2160p' ? '🏆' : resolution === '1080p' ? '⭐' : resolution === '720p' ? '✨' : '📺';
        const codecBadge = codec.toLowerCase().includes('265') || codec.toLowerCase().includes('hevc') ? '🔥' : '🎬';
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
        logger.info(`[stream] Created deferred unlock link: ${file.name} (${isCommonHash ? 'Common hash' : torrent.source}) - ${language}`);
        const torrentTitle = torrent.name.toLowerCase();
        const isSeasonPack = torrentTitle.includes('season') || torrentTitle.includes('saison') || 
                           torrentTitle.includes('complete') || torrentTitle.includes('integral') ||
                           torrentTitle.match(/s\d+/i) && !torrentTitle.match(/s\d+e\d+/i);
        if (isSeasonPack) {
          foundMatchInSeasonPack = true;
          logger.debug(`[stream] Found episode in season pack, stopping further file processing for this torrent`);
          break;
        }
      }
      if (filteredFiles.length === 0) {
        logger.warn(`[stream] No files matched the requested season/episode for torrent ${torrent.hash}`);
      }
    }
  };
  await unlockAndAddStreams(readyTorrents);
  const totalTime = Date.now() - startTime;
  logger.info(`[stream] ${streams.length} stream(s) obtained in ${totalTime}ms`);
  logger.info('[stream] OUT: /:variables/stream/:type/:id.json');
  res.json({ streams });
});

module.exports = router;