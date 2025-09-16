const { QueueStatus } = require('./queue-status');
const fs = require('fs').promises;
const path = require('path');

class StaticAPIGenerator {
  constructor() {
    this.queueStatus = new QueueStatus();
    this.apiDir = 'api';
  }

  async generate() {
    console.log('Generating static API files...');

    await fs.mkdir(this.apiDir, { recursive: true });
    await fs.mkdir(path.join(this.apiDir, 'video'), { recursive: true });
    await fs.mkdir(path.join(this.apiDir, 'search'), { recursive: true });

    await this.generateStats();
    await this.generateQueueStatus();
    await this.generateVideoEndpoints();
    await this.generateSearchIndex();
    await this.generateManifest();

    console.log('Static API generation complete!');
  }

  async generateStats() {
    try {
      const videoDir = path.join(this.apiDir, 'video');
      let totalVideos = 0;

      try {
        const files = await fs.readdir(videoDir);
        totalVideos = files.filter(f => f.endsWith('.json') && !f.includes('-')).length;
      } catch {
        totalVideos = 0;
      }

      const stats = {
        total_videos: totalVideos,
        generated_at: new Date().toISOString()
      };

      await fs.writeFile(
        path.join(this.apiDir, 'stats.json'),
        JSON.stringify(stats, null, 2)
      );
      console.log(`Generated stats.json (${totalVideos} videos)`);
    } catch (error) {
      console.error('Failed to generate stats:', error.message);
    }
  }

  async generateQueueStatus() {
    try {
      const queueStatus = await this.queueStatus.getStatus();

      await fs.writeFile(
        path.join(this.apiDir, 'queue.json'),
        JSON.stringify(queueStatus, null, 2)
      );
      console.log(`Generated queue.json`);
    } catch (error) {
      console.error('Failed to generate queue status:', error.message);
    }
  }

  async generateVideoEndpoints() {
    console.log('Video endpoints are now generated directly by scraper - skipping');
    return;
  }

  async generateSearchIndex() {
    try {
      const videoDir = path.join(this.apiDir, 'video');
      const searchIndex = {
        videos: [],
        authors: {},
        keywords: {},
        generated_at: new Date().toISOString()
      };

      try {
        const files = await fs.readdir(videoDir);
        const videoFiles = files.filter(f => f.endsWith('.json') && !f.includes('-'));

        for (const file of videoFiles) {
          try {
            const videoData = JSON.parse(await fs.readFile(path.join(videoDir, file), 'utf-8'));

            // Add to main index
            const videoEntry = {
              id: videoData.id,
              title: videoData.title,
              author: videoData.author,
              duration: videoData.duration,
              view_count: videoData.view_count,
              upload_date: videoData.upload_date,
              has_captions: videoData.has_captions,
              languages: videoData.languages || []
            };

            searchIndex.videos.push(videoEntry);

            // Index by author
            if (videoData.author) {
              if (!searchIndex.authors[videoData.author]) {
                searchIndex.authors[videoData.author] = [];
              }
              searchIndex.authors[videoData.author].push(videoData.id);
            }

            // Index keywords from title
            if (videoData.title) {
              const words = videoData.title.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(word => word.length > 2);

              for (const word of words) {
                if (!searchIndex.keywords[word]) {
                  searchIndex.keywords[word] = [];
                }
                if (!searchIndex.keywords[word].includes(videoData.id)) {
                  searchIndex.keywords[word].push(videoData.id);
                }
              }
            }
          } catch (error) {
            console.warn(`Failed to process video file ${file}:`, error.message);
          }
        }
      } catch (error) {
        console.warn('No video directory found, creating empty search index');
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

      console.log(`Generated search indexes (${searchIndex.videos.length} videos)`);
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
      base_url: "https://youtube-subtitles.github.io/api/",
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

}

if (require.main === module) {
  const generator = new StaticAPIGenerator();
  generator.generate().catch(console.error);
}

module.exports = { StaticAPIGenerator };