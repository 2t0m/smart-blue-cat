const axios = require('axios');
const httpClient = require('../utils/http');
const logger = require('../utils/logger');
const cache = require('../utils/cache');

// Retrieve TMDB data based on IMDB ID
async function getTmdbData(imdbId, config) {
  const cacheKey = cache.generateKey('tmdb', imdbId);
  
  // Check memory cache first (fastest)
  const cachedResult = cache.getTmdb(cacheKey);
  if (cachedResult) {
      logger.info(`[tmdb] TMDB memory cache hit for IMDB ID: ${imdbId}`);
    return cachedResult;
  }

  try {
    const response = await httpClient.get(`https://api.themoviedb.org/3/find/${imdbId}`, {
      source: 'TMDB',
      timeout: 8000,
      maxRetries: 2,
      params: {
        api_key: config.TMDB_API_KEY,
        external_source: "imdb_id"
      }
    });

    // Check if the result is a movie
    if (response.data.movie_results?.length > 0) {
      const title = response.data.movie_results[0].title;
      const frenchTitle = response.data.movie_results[0].original_title;
      const year = response.data.movie_results[0].release_date?.split('-')[0];

        logger.info(`[tmdb] Movie found: ${title} (${year}) (FR Title: ${frenchTitle})`);

      const result = { type: "movie", title, frenchTitle, year };
      
      // Store in memory cache
      cache.setTmdb(cacheKey, result);

      return result;
    }

    // Check if the result is a TV series
    if (response.data.tv_results?.length > 0) {
      const title = response.data.tv_results[0].name;
      const frenchTitle = response.data.tv_results[0].original_name;
      const year = response.data.tv_results[0].first_air_date?.split('-')[0];

        logger.info(`[tmdb] Series found: ${title} (${year}) (FR Title: ${frenchTitle})`);

      const result = { type: "series", title, frenchTitle, year };
      
      // Store in memory cache
      cache.setTmdb(cacheKey, result);

      return result;
    }
  } catch (error) {
      logger.error(`[tmdb] TMDB Error for IMDB ID: ${imdbId}`, error.response?.data || error.message);
  }

  // Return null if no data is found
    logger.warn(`[tmdb] No TMDB data found for IMDB ID: ${imdbId}`);
  return null;
}

module.exports = { getTmdbData };