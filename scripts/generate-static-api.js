const { ShardReader } = require('../scraper');
const fs = require('fs').promises;
const path = require('path');

class StaticAPIGenerator {
  constructor() {
    this.reader = new ShardReader();
    this.apiDir = 'api';
  }

  async generate() {
    console.log('Generating static API files...');

    await fs.mkdir(this.apiDir, { recursive: true });
    await fs.mkdir(path.join(this.apiDir, 'video'), { recursive: true });
    await fs.mkdir(path.join(this.apiDir, 'search'), { recursive: true });

    await this.generateStats();
    await this.generateVideoEndpoints();
    await this.generateSearchIndex();
    await this.generateManifest();

    console.log('Static API generation complete!');
  }

  async generateStats() {
    try {
      const index = JSON.parse(await fs.readFile('data/index/master.json', 'utf-8'));
      const stats = {
        total_videos: index.total,
        shards: Object.keys(index.shards).length,
        last_updated: index.updated,
        generated_at: new Date().toISOString()
      };

      await fs.writeFile(
        path.join(this.apiDir, 'stats.json'),
        JSON.stringify(stats, null, 2)
      );
      console.log(`Generated stats.json`);
    } catch (error) {
      console.error('Failed to generate stats:', error.message);
    }
  }

  async generateVideoEndpoints() {
    try {
      const index = JSON.parse(await fs.readFile('data/index/master.json', 'utf-8'));
      let processed = 0;

      for (const [shardPath, videoIds] of Object.entries(index.shards)) {
        const videos = await this.getVideosFromShard(shardPath);

        for (const video of videos) {
          // Full video data
          await fs.writeFile(
            path.join(this.apiDir, 'video', `${video.id}.json`),
            JSON.stringify(video, null, 2)
          );

          // Metadata only
          const { captions, ...metadata } = video;
          await fs.writeFile(
            path.join(this.apiDir, 'video', `${video.id}-metadata.json`),
            JSON.stringify(metadata, null, 2)
          );

          // Generate caption files for each language
          if (video.captions) {
            for (const [lang, captionData] of Object.entries(video.captions)) {
              // SRT format
              const srt = this.generateSRT(captionData.segments);
              await fs.writeFile(
                path.join(this.apiDir, 'video', `${video.id}-${lang}.srt`),
                srt
              );

              // TXT format
              const txt = captionData.segments.map(s => s.t).join(' ');
              await fs.writeFile(
                path.join(this.apiDir, 'video', `${video.id}-${lang}.txt`),
                txt
              );

              // JSON captions
              await fs.writeFile(
                path.join(this.apiDir, 'video', `${video.id}-${lang}.json`),
                JSON.stringify(captionData, null, 2)
              );
            }
          }

          processed++;
          if (processed % 100 === 0) {
            console.log(`Generated ${processed} video endpoints`);
          }
        }
      }

      console.log(`Generated ${processed} total video endpoints`);
    } catch (error) {
      console.error('Failed to generate video endpoints:', error.message);
    }
  }

  async generateSearchIndex() {
    try {
      const index = JSON.parse(await fs.readFile('data/index/master.json', 'utf-8'));
      const searchIndex = {
        videos: [],
        authors: {},
        keywords: {},
        generated_at: new Date().toISOString()
      };

      for (const [shardPath, videoIds] of Object.entries(index.shards)) {
        const videos = await this.getVideosFromShard(shardPath);

        for (const video of videos) {
          // Add to main index
          const videoEntry = {
            id: video.id,
            title: video.title,
            author: video.author,
            duration: video.duration,
            view_count: video.view_count,
            upload_date: video.upload_date,
            has_captions: Object.keys(video.captions || {}).length > 0,
            languages: Object.keys(video.captions || {})
          };

          searchIndex.videos.push(videoEntry);

          // Index by author
          if (video.author) {
            if (!searchIndex.authors[video.author]) {
              searchIndex.authors[video.author] = [];
            }
            searchIndex.authors[video.author].push(video.id);
          }

          // Index keywords from title
          if (video.title) {
            const words = video.title.toLowerCase()
              .replace(/[^\w\s]/g, '')
              .split(/\s+/)
              .filter(word => word.length > 2);

            for (const word of words) {
              if (!searchIndex.keywords[word]) {
                searchIndex.keywords[word] = [];
              }
              if (!searchIndex.keywords[word].includes(video.id)) {
                searchIndex.keywords[word].push(video.id);
              }
            }
          }
        }
      }

      // Write main search index
      await fs.writeFile(
        path.join(this.apiDir, 'search', 'index.json'),
        JSON.stringify(searchIndex, null, 2)
      );

      // Write separate files for large datasets
      await fs.writeFile(
        path.join(this.apiDir, 'search', 'videos.json'),
        JSON.stringify(searchIndex.videos, null, 2)
      );

      await fs.writeFile(
        path.join(this.apiDir, 'search', 'authors.json'),
        JSON.stringify(searchIndex.authors, null, 2)
      );

      console.log('Generated search indexes');
    } catch (error) {
      console.error('Failed to generate search index:', error.message);
    }
  }

  async generateManifest() {
    const manifest = {
      name: "YouTube Subtitles Static API",
      version: "1.0.0",
      description: "Static JSON API for YouTube video data and captions",
      generated_at: new Date().toISOString(),
      base_url: "https://youtube-subtitles.github.io/youtube-subtitles/api/",
      endpoints: {
        "GET /stats.json": "Database statistics",
        "GET /video/{id}.json": "Complete video data with captions",
        "GET /video/{id}-metadata.json": "Video metadata only",
        "GET /video/{id}-{lang}.json": "Captions for specific language",
        "GET /video/{id}-{lang}.srt": "Captions in SRT format",
        "GET /video/{id}-{lang}.txt": "Captions in plain text",
        "GET /search/index.json": "Full search index",
        "GET /search/videos.json": "All videos list",
        "GET /search/authors.json": "Videos grouped by author"
      },
      usage: {
        "Search by keyword": "Fetch /search/index.json and filter by keywords object",
        "Get video": "Fetch /video/{videoId}.json",
        "List by author": "Fetch /search/authors.json and access author key",
        "Get captions": "Fetch /video/{videoId}-{lang}.srt"
      }
    };

    await fs.writeFile(
      path.join(this.apiDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    console.log('Generated API manifest');
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
}

if (require.main === module) {
  const generator = new StaticAPIGenerator();
  generator.generate().catch(console.error);
}

module.exports = { StaticAPIGenerator };