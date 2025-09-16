#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

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

  switch (command) {
    case 'get': {
      const videoId = args[1];
      try {
        const videoPath = path.join('api', 'video', `${videoId}.json`);
        const video = JSON.parse(await fs.readFile(videoPath, 'utf-8'));
        console.log(JSON.stringify(video, null, 2));
      } catch (error) {
        console.error(`Video ${videoId} not found`);
      }
      break;
    }

    case 'export': {
      const videoId = args[1];
      const outputDir = args[2] || 'exports';

      try {
        const videoPath = path.join('api', 'video', `${videoId}.json`);
        const video = JSON.parse(await fs.readFile(videoPath, 'utf-8'));

        const exportDir = path.join(outputDir, videoId);
        await fs.mkdir(exportDir, { recursive: true });

        // Copy main video file
        await fs.copyFile(videoPath, path.join(exportDir, `${videoId}.json`));

        // Copy caption files
        const apiVideoDir = path.join('api', 'video');
        const files = await fs.readdir(apiVideoDir);
        for (const file of files) {
          if (file.startsWith(`${videoId}-`) && (file.endsWith('.srt') || file.endsWith('.txt'))) {
            await fs.copyFile(
              path.join(apiVideoDir, file),
              path.join(exportDir, file.replace(`${videoId}-`, ''))
            );
          }
        }

        console.log(`Exported ${videoId} to ${exportDir}`);
      } catch (error) {
        console.error(`Failed to export ${videoId}:`, error.message);
      }
      break;
    }

    case 'stats': {
      try {
        const stats = JSON.parse(await fs.readFile('api/stats.json', 'utf-8'));
        console.log(`
Database Statistics:
- Total videos: ${stats.total_videos}
- Last updated: ${stats.generated_at}
        `);
      } catch (error) {
        console.error('No stats found. Database is empty.');
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