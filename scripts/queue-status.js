const fs = require('fs').promises;
const path = require('path');

class QueueStatus {
  async getStatus() {
    try {
      // Get queued URLs from urls.txt
      let queuedUrls = [];
      try {
        const urlsContent = await fs.readFile('urls.txt', 'utf-8');
        queuedUrls = urlsContent.split('\n').filter(url => url.trim());
      } catch {
        // urls.txt doesn't exist or is empty
      }

      // Get processed video IDs from master index
      let processedVideos = [];
      try {
        const masterIndex = JSON.parse(await fs.readFile('data/index/master.json', 'utf-8'));
        processedVideos = masterIndex.processed || [];
      } catch {
        // No processed videos yet
      }

      // Extract video IDs from queued URLs
      const queuedVideoIds = queuedUrls.map(url => this.extractVideoId(url)).filter(Boolean);

      // Find URLs that are queued but not yet processed
      const pendingUrls = queuedVideoIds.filter(id => !processedVideos.includes(id));

      return {
        queue: {
          total_queued: queuedVideoIds.length,
          pending_processing: pendingUrls.length,
          already_processed: queuedVideoIds.length - pendingUrls.length
        },
        processed: {
          total_videos: processedVideos.length,
          last_updated: new Date().toISOString()
        },
        pending_video_ids: pendingUrls
      };
    } catch (error) {
      console.error('Error getting queue status:', error);
      return {
        queue: { total_queued: 0, pending_processing: 0, already_processed: 0 },
        processed: { total_videos: 0, last_updated: new Date().toISOString() },
        pending_video_ids: []
      };
    }
  }

  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
}

// CLI usage
if (require.main === module) {
  const queueStatus = new QueueStatus();
  queueStatus.getStatus().then(status => {
    console.log(JSON.stringify(status, null, 2));
  });
}

module.exports = { QueueStatus };