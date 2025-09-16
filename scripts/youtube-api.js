/**
 * YouTube Subtitles Static API Client
 * Access YouTube video data and captions from GitHub static files
 */
class YouTubeSubtitlesAPI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  }

  /**
   * Get database statistics
   */
  async getStats() {
    return this.fetch('stats.json');
  }

  /**
   * Get complete video data with captions
   */
  async getVideo(videoId) {
    return this.fetch(`video/${videoId}.json`);
  }

  /**
   * Get video metadata only (no captions)
   */
  async getVideoMetadata(videoId) {
    return this.fetch(`video/${videoId}-metadata.json`);
  }

  /**
   * Get captions for specific language as JSON
   */
  async getCaptions(videoId, language) {
    return this.fetch(`video/${videoId}-${language}.json`);
  }

  /**
   * Get captions in SRT format
   */
  async getCaptionsSRT(videoId, language) {
    return this.fetchText(`video/${videoId}-${language}.srt`);
  }

  /**
   * Get captions as plain text
   */
  async getCaptionsText(videoId, language) {
    return this.fetchText(`video/${videoId}-${language}.txt`);
  }

  /**
   * Get all videos list
   */
  async getAllVideos() {
    return this.fetch('search/videos.json');
  }

  /**
   * Get videos grouped by author
   */
  async getVideosByAuthor() {
    return this.fetch('search/authors.json');
  }

  /**
   * Get full search index with keywords
   */
  async getSearchIndex() {
    return this.fetch('search/index.json');
  }

  /**
   * Search videos by keyword (client-side)
   */
  async searchVideos(query) {
    const searchIndex = await this.getSearchIndex();
    const keywords = query.toLowerCase().split(/\s+/);
    const matchingIds = new Set();

    // Find videos matching keywords
    for (const keyword of keywords) {
      if (searchIndex.keywords[keyword]) {
        searchIndex.keywords[keyword].forEach(id => matchingIds.add(id));
      }
    }

    // Return matching videos
    return searchIndex.videos.filter(video =>
      matchingIds.has(video.id) ||
      video.title.toLowerCase().includes(query.toLowerCase()) ||
      video.author.toLowerCase().includes(query.toLowerCase())
    );
  }

  /**
   * Get videos by specific author
   */
  async getAuthorVideos(authorName) {
    const authors = await this.getVideosByAuthor();
    const videoIds = authors[authorName] || [];

    const videos = [];
    for (const id of videoIds) {
      try {
        const video = await this.getVideoMetadata(id);
        videos.push(video);
      } catch (error) {
        console.warn(`Failed to load video ${id}:`, error);
      }
    }

    return videos;
  }

  /**
   * Get random videos
   */
  async getRandomVideos(count = 10) {
    const allVideos = await this.getAllVideos();
    const shuffled = allVideos.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Filter videos by criteria
   */
  async filterVideos(criteria = {}) {
    const allVideos = await this.getAllVideos();

    return allVideos.filter(video => {
      if (criteria.author && video.author !== criteria.author) return false;
      if (criteria.minViews && video.view_count < criteria.minViews) return false;
      if (criteria.maxDuration && video.duration > criteria.maxDuration) return false;
      if (criteria.hasCaption && !video.has_captions) return false;
      if (criteria.language && !video.languages.includes(criteria.language)) return false;
      return true;
    });
  }

  /**
   * Utility: Fetch JSON
   */
  async fetch(endpoint) {
    const response = await fetch(this.baseUrl + endpoint);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Utility: Fetch text
   */
  async fetchText(endpoint) {
    const response = await fetch(this.baseUrl + endpoint);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.text();
  }
}

// Usage examples:
/*
// Initialize with your GitHub Pages URL
const api = new YouTubeSubtitlesAPI('https://username.github.io/repo-name/api/');

// Get video data
const video = await api.getVideo('dQw4w9WgXcQ');

// Search videos
const rickVideos = await api.searchVideos('rick astley');

// Get captions
const captions = await api.getCaptionsSRT('dQw4w9WgXcQ', 'en');

// Filter videos
const shortVideos = await api.filterVideos({ maxDuration: 300 });

// Get random videos
const random = await api.getRandomVideos(5);
*/

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { YouTubeSubtitlesAPI };
} else if (typeof window !== 'undefined') {
  window.YouTubeSubtitlesAPI = YouTubeSubtitlesAPI;
}