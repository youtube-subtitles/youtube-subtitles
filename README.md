# YouTube Subtitles

Automated YouTube caption scraper and API that extracts video metadata and captions at scale. The repository itself serves as both the data storage and API endpoint.

## Features

- 🔄 Automated scraping via GitHub Actions
- 🗂️ Sharded data storage for massive scale (100k+ videos)
- 🔍 Full-text search across videos and captions
- 📊 REST API with multiple output formats
- 💾 Git-based database (no external dependencies)
- 🚀 Ready for millions of videos

## Quick Start

### Scraping Videos

1. **Add URLs via GitHub Issues**
   - Create issues labeled `youtube-url`
   - Include YouTube URLs in the issue body
   - GitHub Actions will process them automatically

2. **Local scraping**
   ```bash
   echo "https://www.youtube.com/watch?v=dQw4w9WgXcQ" > urls.txt
   pnpm scrape
   ```

### API Usage

```bash
# Start local API server
pnpm api

# Check database stats
curl http://localhost:3000/stats

# Get video data
curl http://localhost:3000/video/dQw4w9WgXcQ

# Get captions in SRT format
curl http://localhost:3000/video/dQw4w9WgXcQ/captions/en/srt

# Search videos
curl "http://localhost:3000/search?q=rick+astley"
```

## Installation

```bash
git clone <repository>
cd youtube-subtitles
pnpm install
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm scrape` | Scrape URLs from urls.txt or GitHub issues |
| `pnpm api` | Start REST API server (port 3000) |
| `pnpm read stats` | Show database statistics |
| `pnpm read get <videoId>` | Get video data |
| `pnpm read export <videoId>` | Export to traditional file structure |

## API Endpoints

### Core Endpoints

- `GET /` - API documentation
- `GET /health` - Health check
- `GET /stats` - Database statistics

### Video Data

- `GET /video/:id` - Complete video data with captions
- `GET /video/:id/metadata` - Video metadata only
- `GET /video/:id/captions` - All captions for video
- `GET /video/:id/captions?lang=en` - Specific language captions

### Caption Formats

- `GET /video/:id/captions/:lang/srt` - SubRip format
- `GET /video/:id/captions/:lang/txt` - Plain text

### Search & Discovery

- `GET /search?q=query` - Search by title/author
- `GET /videos?limit=50&offset=0` - Paginated video list
- `GET /videos?author=username` - Filter by channel
- `GET /videos?min_views=1000` - Filter by view count
- `GET /videos?max_duration=300` - Filter by duration
- `GET /random?count=10` - Random videos

## Data Structure

Videos are stored in a sharded, compressed format optimized for git:

```
data/
├── shards/
│   ├── ab/
│   │   ├── 0.jsonl.gz    # Compressed video data
│   │   └── 1.jsonl.gz
│   └── ac/
│       └── 0.jsonl.gz
└── index/
    ├── master.json       # Main index
    └── 2024-01-15.json   # Daily indexes
```

### Video Data Format

```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "author": "Rick Astley",
  "duration": 213,
  "view_count": 1693950587,
  "upload_date": "Oct 25, 2009",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "scraped_at": "2025-01-15T10:30:00.000Z",
  "captions": {
    "en": {
      "auto": false,
      "segments": [
        {"s": 0, "e": 3000, "t": "We're no strangers to love"},
        {"s": 3000, "e": 6000, "t": "You know the rules and so do I"}
      ]
    }
  }
}
```

## GitHub Actions Automation

The scraper runs automatically:

- **Schedule**: Every 6 hours
- **Triggers**: New issues labeled `youtube-url`
- **Manual**: Via workflow dispatch

### Configuration

1. Enable Actions in repository settings
2. Create issues with label `youtube-url`
3. Include YouTube URLs in issue body
4. Actions will close issues after processing

## Scaling

The system is designed for massive scale:

- **Storage**: Sharded data prevents git performance issues
- **Processing**: Batch commits every 50 videos
- **Time limits**: Respects GitHub Actions 60-minute limit
- **Rate limiting**: Built-in delays to respect YouTube's limits
- **Resume capability**: Can continue from interruptions

## Development

### Local Development

```bash
# Run scraper locally
echo "https://youtube.com/watch?v=VIDEO_ID" > urls.txt
pnpm scrape

# Start API server
pnpm api

# Test API endpoints
curl http://localhost:3000/stats
```

### Environment Variables

```bash
PORT=3000                # API server port
GITHUB_TOKEN=<token>     # For GitHub Actions
NODE_ENV=production      # Production mode
```

## Direct Repository Access

Since data is stored in git, you can access it directly:

```bash
# Clone repository
git clone <repository>

# Access raw data files
curl https://raw.githubusercontent.com/user/repo/main/data/index/master.json

# Use repository as submodule
git submodule add <repository> youtube-data
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit pull request

## License

ISC License

## Limitations

- YouTube API rate limits apply
- Caption availability depends on video uploader
- Some parsing errors may occur with newer YouTube layouts
- Processing speed limited by YouTube response times

## Troubleshooting

### Common Issues

**No captions extracted**: Some videos don't have captions or they're not accessible via the API

**API errors**: Ensure data directory exists and contains valid index files

**GitHub Actions failures**: Check repository permissions and secrets configuration

### Debug Commands

```bash
# Check if video was processed
pnpm read get <videoId>

# View database statistics
pnpm read stats

# Export video for inspection
pnpm read export <videoId> ./debug
```