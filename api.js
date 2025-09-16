const fastify = require('fastify')({ logger: true });
const { ShardReader } = require('./scraper');
const fs = require('fs').promises;
const path = require('path');

class YouTubeAPI {
  constructor() {
    this.reader = new ShardReader();
    this.setupRoutes();
  }

  async setupRoutes() {
    // CORS
    await fastify.register(require('@fastify/cors'), {
      origin: true
    });

    // Health check
    fastify.get('/health', async (request, reply) => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Get database stats
    fastify.get('/stats', async (request, reply) => {
      try {
        const index = JSON.parse(await fs.readFile('data/index/master.json', 'utf-8'));
        return {
          total_videos: index.total,
          shards: Object.keys(index.shards).length,
          last_updated: index.updated
        };
      } catch (error) {
        return reply.code(404).send({ error: 'Database not found' });
      }
    });

    // Get video by ID
    fastify.get('/video/:id', async (request, reply) => {
      const { id } = request.params;

      if (!this.isValidVideoId(id)) {
        return reply.code(400).send({ error: 'Invalid video ID format' });
      }

      const video = await this.reader.getVideo(id);
      if (!video) {
        return reply.code(404).send({ error: 'Video not found' });
      }

      return video;
    });

    // Get video metadata only (no captions)
    fastify.get('/video/:id/metadata', async (request, reply) => {
      const { id } = request.params;

      if (!this.isValidVideoId(id)) {
        return reply.code(400).send({ error: 'Invalid video ID format' });
      }

      const video = await this.reader.getVideo(id);
      if (!video) {
        return reply.code(404).send({ error: 'Video not found' });
      }

      const { captions, ...metadata } = video;
      return metadata;
    });

    // Get captions for a video
    fastify.get('/video/:id/captions', async (request, reply) => {
      const { id } = request.params;
      const { lang } = request.query;

      if (!this.isValidVideoId(id)) {
        return reply.code(400).send({ error: 'Invalid video ID format' });
      }

      const video = await this.reader.getVideo(id);
      if (!video) {
        return reply.code(404).send({ error: 'Video not found' });
      }

      const captions = video.captions || {};

      if (lang) {
        if (!captions[lang]) {
          return reply.code(404).send({ error: `Captions not found for language: ${lang}` });
        }
        return { [lang]: captions[lang] };
      }

      return captions;
    });

    // Get captions in SRT format
    fastify.get('/video/:id/captions/:lang/srt', async (request, reply) => {
      const { id, lang } = request.params;

      if (!this.isValidVideoId(id)) {
        return reply.code(400).send({ error: 'Invalid video ID format' });
      }

      const video = await this.reader.getVideo(id);
      if (!video || !video.captions || !video.captions[lang]) {
        return reply.code(404).send({ error: 'Captions not found' });
      }

      const srt = this.generateSRT(video.captions[lang].segments);

      reply.type('text/plain; charset=utf-8');
      return srt;
    });

    // Get captions in plain text format
    fastify.get('/video/:id/captions/:lang/txt', async (request, reply) => {
      const { id, lang } = request.params;

      if (!this.isValidVideoId(id)) {
        return reply.code(400).send({ error: 'Invalid video ID format' });
      }

      const video = await this.reader.getVideo(id);
      if (!video || !video.captions || !video.captions[lang]) {
        return reply.code(404).send({ error: 'Captions not found' });
      }

      const txt = video.captions[lang].segments.map(s => s.t).join(' ');

      reply.type('text/plain; charset=utf-8');
      return txt;
    });

    // Search videos
    fastify.get('/search', async (request, reply) => {
      const { q, limit = 50, offset = 0 } = request.query;

      if (!q) {
        return reply.code(400).send({ error: 'Query parameter "q" is required' });
      }

      try {
        const results = await this.searchVideos(q, parseInt(limit), parseInt(offset));
        return {
          query: q,
          results: results.videos,
          total: results.total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        };
      } catch (error) {
        return reply.code(500).send({ error: 'Search failed' });
      }
    });

    // List videos with pagination
    fastify.get('/videos', async (request, reply) => {
      const { limit = 50, offset = 0, author, min_views, max_duration } = request.query;

      try {
        const results = await this.listVideos({
          limit: parseInt(limit),
          offset: parseInt(offset),
          author,
          min_views: min_views ? parseInt(min_views) : null,
          max_duration: max_duration ? parseInt(max_duration) : null
        });

        return {
          videos: results.videos,
          total: results.total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        };
      } catch (error) {
        return reply.code(500).send({ error: 'Failed to list videos' });
      }
    });

    // Get random videos
    fastify.get('/random', async (request, reply) => {
      const { count = 10 } = request.query;

      try {
        const videos = await this.getRandomVideos(parseInt(count));
        return { videos, count: videos.length };
      } catch (error) {
        return reply.code(500).send({ error: 'Failed to get random videos' });
      }
    });

    // API documentation
    fastify.get('/', async (request, reply) => {
      return {
        name: 'YouTube Subtitles API',
        version: '1.0.0',
        endpoints: {
          'GET /health': 'Health check',
          'GET /stats': 'Database statistics',
          'GET /video/:id': 'Get video data with captions',
          'GET /video/:id/metadata': 'Get video metadata only',
          'GET /video/:id/captions': 'Get video captions (all languages)',
          'GET /video/:id/captions?lang=en': 'Get captions for specific language',
          'GET /video/:id/captions/:lang/srt': 'Get captions in SRT format',
          'GET /video/:id/captions/:lang/txt': 'Get captions in plain text',
          'GET /search?q=query': 'Search videos by title/author',
          'GET /videos?limit=50&offset=0': 'List videos with pagination',
          'GET /videos?author=username': 'Filter videos by author',
          'GET /videos?min_views=1000': 'Filter by minimum view count',
          'GET /videos?max_duration=300': 'Filter by maximum duration (seconds)',
          'GET /random?count=10': 'Get random videos'
        }
      };
    });
  }

  isValidVideoId(id) {
    return /^[a-zA-Z0-9_-]{11}$/.test(id);
  }

  generateSRT(segments) {
    return segments.map((segment, index) => {
      const start = this.formatTime(segment.s);
      const end = this.formatTime(segment.e);
      return `${index + 1}\n${start} --> ${end}\n${segment.t}\n`;
    }).join('\n');
  }

  formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
  }

  async searchVideos(query, limit, offset) {
    const index = JSON.parse(await fs.readFile('data/index/master.json', 'utf-8'));
    const searchTerm = query.toLowerCase();
    const results = [];

    // Simple search through video IDs (could be optimized with proper indexing)
    let checked = 0;
    let found = 0;

    for (const [shardPath, videoIds] of Object.entries(index.shards)) {
      if (found >= offset + limit) break;

      const videos = await this.getVideosFromShard(shardPath);

      for (const video of videos) {
        if (checked < offset) {
          checked++;
          continue;
        }

        if (video.title?.toLowerCase().includes(searchTerm) ||
            video.author?.toLowerCase().includes(searchTerm)) {
          if (found >= offset && results.length < limit) {
            results.push(video);
          }
          found++;
        }
        checked++;
      }
    }

    return { videos: results, total: found };
  }

  async listVideos(options) {
    const { limit, offset, author, min_views, max_duration } = options;
    const index = JSON.parse(await fs.readFile('data/index/master.json', 'utf-8'));
    const results = [];

    let checked = 0;
    let found = 0;

    for (const [shardPath, videoIds] of Object.entries(index.shards)) {
      if (results.length >= limit) break;

      const videos = await this.getVideosFromShard(shardPath);

      for (const video of videos) {
        // Apply filters
        if (author && video.author !== author) continue;
        if (min_views && video.view_count < min_views) continue;
        if (max_duration && video.duration > max_duration) continue;

        if (found >= offset && results.length < limit) {
          results.push(video);
        }
        found++;
      }
    }

    return { videos: results, total: index.total };
  }

  async getRandomVideos(count) {
    const index = JSON.parse(await fs.readFile('data/index/master.json', 'utf-8'));
    const allVideoIds = index.processed;

    const randomIds = [];
    const used = new Set();

    while (randomIds.length < count && randomIds.length < allVideoIds.length) {
      const randomIndex = Math.floor(Math.random() * allVideoIds.length);
      const videoId = allVideoIds[randomIndex];

      if (!used.has(videoId)) {
        used.add(videoId);
        randomIds.push(videoId);
      }
    }

    const videos = [];
    for (const id of randomIds) {
      const video = await this.reader.getVideo(id);
      if (video) videos.push(video);
    }

    return videos;
  }

  async getVideosFromShard(shardPath) {
    try {
      const compressed = await fs.readFile(shardPath);
      const zlib = require('zlib');
      const { promisify } = require('util');
      const gunzip = promisify(zlib.gunzip);

      const decompressed = await gunzip(compressed);
      const lines = decompressed.toString().split('\n');

      return lines
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }

  async start(port = 3000) {
    try {
      await fastify.listen({ port, host: '0.0.0.0' });
      console.log(`API server running on http://localhost:${port}`);
    } catch (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  const api = new YouTubeAPI();
  api.start(port);
}

module.exports = { YouTubeAPI };