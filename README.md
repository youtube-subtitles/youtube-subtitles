# YouTube Subtitles

Automated YouTube caption scraper with static API generation. Scrapes video metadata and captions at massive scale, then generates a static API hosted directly on GitHub Pages.

## Features

- 🔄 **Automated scraping** via GitHub Actions
- 🗂️ **Sharded storage** for 100k+ videos
- 🌐 **Static API** hosted on GitHub Pages (no server needed)
- 🔍 **Search & filtering** with client-side JavaScript
- 📊 **Multiple formats** (JSON, SRT, TXT)
- 🚀 **Zero infrastructure costs**

## Quick Start

### 1. Scraping Videos

**Via GitHub Issues:**
- Create issues with label `youtube-url`
- Include YouTube URLs in issue body
- GitHub Actions processes them automatically

**Local testing:**
```bash
echo "https://www.youtube.com/watch?v=dQw4w9WgXcQ" > urls.txt
pnpm scrape
```

### 2. Using the Static API

After GitHub Actions builds the API, access it at:
`https://youtube-subtitles.github.io/api/`

```javascript
// Get video data
const video = await fetch('https://youtube-subtitles.github.io/api/video/dQw4w9WgXcQ.json')
  .then(r => r.json());

// Get captions as SRT
const srt = await fetch('https://youtube-subtitles.github.io/api/video/dQw4w9WgXcQ-en.srt')
  .then(r => r.text());

// Search all videos
const videos = await fetch('https://youtube-subtitles.github.io/api/search/videos.json')
  .then(r => r.json());
```

### 3. Using the JavaScript Client

```html
<script src="https://youtube-subtitles.github.io/scripts/youtube-api.js"></script>
<script>
const api = new YouTubeSubtitlesAPI('https://youtube-subtitles.github.io/api/');

// Search videos
const results = await api.searchVideos('rick astley');

// Get captions
const captions = await api.getCaptionsSRT('dQw4w9WgXcQ', 'en');

// Filter videos
const shortVideos = await api.filterVideos({ maxDuration: 300 });
</script>
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
| `pnpm build` | Generate static API files |
| `pnpm read stats` | Show database statistics |
| `pnpm read get <videoId>` | Get specific video data |
| `pnpm read export <videoId>` | Export to traditional file structure |

## Project Structure

```
├── scraper.js              # Main scraper
├── scripts/
│   ├── generate-static-api.js   # Static API generator
│   ├── reader.js                # Data access utility
│   └── youtube-api.js           # Client library
├── .github/workflows/
│   ├── scrape.yml              # Data scraping pipeline
│   └── build-api.yml           # API generation & deployment
├── data/                   # Sharded video data (auto-generated)
└── api/                    # Static API files (auto-generated)
```

## Automated Pipelines

### Data Scraping (`scrape.yml`)
- **Triggers**: Every 6 hours, new issues, manual
- **Process**: Scrapes YouTube URLs → Stores in `data/`
- **Output**: Compressed sharded data files

### API Building (`build-api.yml`)
- **Triggers**: When `data/` changes, every 12 hours, manual
- **Process**: Reads `data/` → Generates `api/` → Deploys to Pages
- **Output**: Static JSON/SRT/TXT files + GitHub Pages deployment

## Static API Endpoints

### Core Data
- `GET /api/stats.json` - Database statistics
- `GET /api/video/{id}.json` - Complete video data with captions
- `GET /api/video/{id}-metadata.json` - Video metadata only

### Caption Formats
- `GET /api/video/{id}-{lang}.json` - Captions as JSON
- `GET /api/video/{id}-{lang}.srt` - SubRip format
- `GET /api/video/{id}-{lang}.txt` - Plain text

### Search & Discovery
- `GET /api/search/videos.json` - All videos list
- `GET /api/search/authors.json` - Videos grouped by channel
- `GET /api/search/index.json` - Full search index with keywords

## Data Format

Videos stored in compressed shards:

```
data/
├── shards/
│   ├── ab/
│   │   ├── 0.jsonl.gz    # ~1000 videos per file
│   │   └── 1.jsonl.gz
│   └── ac/
└── index/
    ├── master.json       # Main index
    └── 2024-01-15.json   # Daily indexes
```

### Video Data Structure

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
        {"s": 0, "e": 3000, "t": "We're no strangers to love"}
      ]
    }
  }
}
```

## GitHub Pages Setup

1. **Enable Pages**: Repository Settings → Pages → Source: "Deploy from a branch" → Branch: `main`
2. **Wait for build**: `build-api.yml` runs automatically
3. **Access API**: `https://username.github.io/repo-name/api/`

## Usage Examples

### curl
```bash
# Get video metadata
curl https://youtube-subtitles.github.io/api/video/dQw4w9WgXcQ-metadata.json

# Download captions
curl -o captions.srt https://youtube-subtitles.github.io/api/video/dQw4w9WgXcQ-en.srt

# Search by author
curl https://youtube-subtitles.github.io/api/search/authors.json | jq '.["Rick Astley"]'
```

### JavaScript/Node.js
```javascript
import { YouTubeSubtitlesAPI } from './scripts/youtube-api.js';

const api = new YouTubeSubtitlesAPI('https://youtube-subtitles.github.io/api/');

// Get random videos
const random = await api.getRandomVideos(10);

// Search videos
const results = await api.searchVideos('music video');

// Filter by criteria
const recentShorts = await api.filterVideos({
  maxDuration: 60,
  minViews: 100000
});
```

### Python
```python
import requests

# Get video data
video = requests.get('https://youtube-subtitles.github.io/api/video/dQw4w9WgXcQ.json').json()

# Get all videos by author
authors = requests.get('https://youtube-subtitles.github.io/api/search/authors.json').json()
rick_videos = authors.get('Rick Astley', [])
```

## Scaling

**Designed for massive scale:**
- ✅ 1M+ videos supported
- ✅ Git-friendly sharded storage
- ✅ Efficient GitHub Actions workflows
- ✅ CDN delivery via GitHub Pages
- ✅ Client-side search capabilities
- ✅ Zero server maintenance

## Configuration

### Environment Variables
```bash
GITHUB_TOKEN=<token>     # For GitHub Actions (auto-provided)
```

### Workflow Schedules
- **Data scraping**: Every 6 hours
- **API building**: Every 12 hours + on data changes
- **Manual triggers**: Available for both workflows

## Direct Repository Access

Since everything is stored in git:

```bash
# Clone for offline access
git clone https://github.com/youtube-subtitles/youtube-subtitles.git

# Access raw files directly
curl https://raw.githubusercontent.com/youtube-subtitles/youtube-subtitles/main/data/index/master.json

# Use as submodule
git submodule add https://github.com/youtube-subtitles/youtube-subtitles.git youtube-data
```

## Contributing

1. Fork repository
2. Create feature branch
3. Test with `pnpm scrape` and `pnpm build`
4. Submit pull request

## License

ISC License

## Limitations

- YouTube API rate limits apply
- Caption availability depends on video settings
- Processing speed limited by YouTube response times
- GitHub Actions has 6-hour time limits

## Troubleshooting

### Common Issues

**No captions found**: Not all videos have accessible captions

**Build fails**: Check GitHub Actions logs and data directory permissions

**API not updating**: Verify GitHub Pages is enabled and build pipeline succeeded

### Debug Commands

```bash
# Check scraped data
pnpm read stats

# Inspect specific video
pnpm read get dQw4w9WgXcQ

# Rebuild API locally
pnpm build

# Export for debugging
pnpm read export dQw4w9WgXcQ ./debug
```