#!/usr/bin/env node

const { ShardReader } = require('../scraper');

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log(`
Usage:
  node reader.js get <videoId>              - Get video data
  node reader.js export <videoId> [dir]     - Export video to directory
  node reader.js stats                      - Show database statistics
    `);
    process.exit(1);
  }

  const command = args[0];
  const reader = new ShardReader();

  switch (command) {
    case 'get': {
      const videoId = args[1];
      const video = await reader.getVideo(videoId);
      console.log(JSON.stringify(video, null, 2));
      break;
    }

    case 'export': {
      const videoId = args[1];
      const outputDir = args[2] || 'exports';
      await reader.exportVideoData(videoId, outputDir);
      break;
    }

    case 'stats': {
      const fs = require('fs').promises;
      try {
        const index = JSON.parse(await fs.readFile('data/index/master.json', 'utf-8'));
        console.log(`
Database Statistics:
- Total videos: ${index.total}
- Shards: ${Object.keys(index.shards).length}
- Last updated: ${index.updated}
        `);
      } catch (error) {
        console.error('No index found. Database is empty.');
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}