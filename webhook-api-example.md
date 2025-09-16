# Webhook API Usage

Submit YouTube URLs for processing via webhook.site

## Submit URLs for scraping:

```javascript
// Submit single URL
fetch('https://webhook.site/YOUR-WEBHOOK-ID', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event_type: 'scrape_urls',
    client_payload: {
      urls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ']
    }
  })
});

// Submit multiple URLs
fetch('https://webhook.site/YOUR-WEBHOOK-ID', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event_type: 'scrape_urls',
    client_payload: {
      urls: [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://www.youtube.com/watch?v=9bZkp7q19f0'
      ]
    }
  })
});
```

## Setup webhook.site:

1. Go to https://webhook.site
2. Copy your unique URL
3. Configure webhook to forward to GitHub:
   - Method: POST
   - URL: `https://api.github.com/repos/youtube-subtitles/youtube-subtitles.github.io/dispatches`
   - Headers:
     - `Authorization: token YOUR_GITHUB_TOKEN`
     - `Accept: application/vnd.github.v3+json`
   - Forward request body as-is

## Response:
- Webhook will trigger GitHub Actions workflow
- URLs will be processed and added to the API
- Check workflow runs at: https://github.com/youtube-subtitles/youtube-subtitles.github.io/actions