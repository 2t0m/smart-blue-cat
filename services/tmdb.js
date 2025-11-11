const axios = require('axios');
const logger = require('../utils/logger');
const { getCachedTmdb, storeTmdb } = require('../utils/db');

// Retrieve TMDB data based on IMDB ID
async function getTmdbData(imdbId, config) {
  try {
    const cachedData = await getCachedTmdb(imdbId);
    if (cachedData) {
      logger.info(`✅ TMDB cache hit for IMDB ID: ${imdbId}`);
      return {
        type: cachedData.type,
        title: cachedData.title,
        frenchTitle: cachedData.french_title,
        year: cachedData.year
      };
    }

    const response = await axios.get(`https://api.themoviedb.org/3/find/${imdbId}`, {
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

      logger.info(`✅ Movie found: ${title} (${year}) (FR Title: ${frenchTitle})`);

      // Stocker les données dans le cache
      await storeTmdb(imdbId, "movie", title, frenchTitle, year);

      return { type: "movie", title, frenchTitle, year };
    }

    // Check if the result is a TV series
    if (response.data.tv_results?.length > 0) {
      const title = response.data.tv_results[0].name;
      const frenchTitle = response.data.tv_results[0].original_name;
      const year = response.data.tv_results[0].first_air_date?.split('-')[0];

      logger.info(`✅ Series found: ${title} (${year}) (FR Title: ${frenchTitle})`);

      await storeTmdb(imdbId, "series", title, frenchTitle, year);

      return { type: "series", title, frenchTitle, year };
    }
  } catch (error) {
    logger.error(`❌ TMDB Error for IMDB ID: ${imdbId}`, error.response?.data || error.message);
  }

  // Return null if no data is found
  logger.warn(`⚠️ No TMDB data found for IMDB ID: ${imdbId}`);
  return null;
}

module.exports = { getTmdbData };