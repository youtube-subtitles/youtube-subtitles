const { Innertube } = require('youtubei.js');

async function testTranscript() {
  try {
    const youtube = await Innertube.create();

    let argId = process.argv[2];
    let argLang = process.argv[3];
    const looksLikeId = (s) => typeof s === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(s);
    if (argId && !looksLikeId(argId) && !argLang) {
      // Called as: node script.js en
      argLang = argId;
      argId = undefined;
    }
    const videoId = (argId && argId.trim()) || 'WUvTyaaNkzM';

    console.log(`Fetching info for ${videoId}...`);
    const info = await youtube.getInfo(videoId);
    console.log('Title:', info?.basic_info?.title || 'Unknown');

    const tracks = info.captions?.caption_tracks || [];
    console.log(`Found ${tracks.length} caption tracks`);
    for (const t of tracks) {
      console.log(`- ${t.language_code}${t.kind === 'asr' ? ' (auto)' : ''} | base_url: ${t.base_url ? 'yes' : 'no'} | translatable: ${t.is_translatable ? 'yes' : 'no'}`);
    }

    if (tracks.length === 0) {
      console.log('No caption tracks available.');
      return;
    }

    // Try preferred languages first, then fall back to first available
    const preferred = argLang ? [argLang] : ['en', 'en-US', 'en-GB'];
    // Build language -> [tracks] map to avoid overwriting duplicates (e.g., en + en asr)
    const langToTracks = new Map();
    for (const t of tracks) {
      const arr = langToTracks.get(t.language_code) || [];
      arr.push(t);
      langToTracks.set(t.language_code, arr);
    }

    let chosenLang = preferred.find(code => langToTracks.has(code));
    if (!chosenLang) chosenLang = tracks[0].language_code;

    const candidates = langToTracks.get(chosenLang) || [tracks[0]];
    // Prefer human-created first (kind !== 'asr') and URLs without caps=asr
    let chosenTrack = candidates.find(t => t.kind !== 'asr' && t.base_url && !/caps=asr/.test(t.base_url))
      || candidates.find(t => t.kind !== 'asr')
      || candidates[0];
    if (!chosenTrack) {
      // Fallback: any non-asr in all tracks
      chosenTrack = tracks.find(t => t.kind !== 'asr') || tracks[0];
    }

    console.log(`\nAttempting to fetch transcript for language: ${chosenLang}`);
    console.log(`Chosen track: ${chosenTrack.language_code}${chosenTrack.kind === 'asr' ? ' (auto)' : ''}`);

    let transcript;
    try {
      const tinfo = await info.getTranscript();
      if (tinfo) {
        if (argLang && tinfo.languages?.includes(argLang)) {
          const selected = await tinfo.selectLanguage(argLang);
          transcript = selected.transcript;
        } else {
          transcript = tinfo.transcript;
        }
      }
    } catch (e) {
      console.warn(`info.getTranscript failed: ${e.message}`);
    }

    if (!transcript && chosenTrack?.base_url) {
      console.log('Falling back to fetching caption track URL...');
      const baseUrl = chosenTrack.base_url;
      const urlsToTry = [];
      const hasFmt = /[?&]fmt=/.test(baseUrl);
      if (hasFmt) {
        urlsToTry.push(baseUrl);
      } else {
        // Try exact base URL first (YouTube decides best format)
        urlsToTry.push(baseUrl);
        urlsToTry.push(`${baseUrl}&fmt=json3`);
        urlsToTry.push(`${baseUrl}&fmt=json3&xorb=2&xobt=3&xovt=3`);
        urlsToTry.push(`${baseUrl}&fmt=srv3`);
        urlsToTry.push(`${baseUrl}&fmt=vtt`);
        urlsToTry.push(`${baseUrl}&fmt=ttml`);
      }
      // Also try a constructed URL independent of base_url
      const constructed = (fmt, asr) => `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(chosenLang)}${asr ? '&kind=asr&caps=asr' : ''}&fmt=${fmt}&xorb=2&xobt=3&xovt=3`;
      urlsToTry.push(constructed('json3', chosenTrack.kind === 'asr'));
      urlsToTry.push(constructed('vtt', chosenTrack.kind === 'asr'));
      urlsToTry.push(constructed('srv3', chosenTrack.kind === 'asr'));
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.youtube.com',
        'Referer': `https://www.youtube.com/watch?v=${videoId}`
      };
      try {
        for (let url of urlsToTry) {
          // If track is translatable and chosenLang is not the track language, try adding tlang
          if (chosenTrack.is_translatable && chosenLang !== chosenTrack.language_code && !/[?&]tlang=/.test(url)) {
            url = `${url}${url.includes('?') ? '&' : '?'}tlang=${encodeURIComponent(chosenLang)}`;
          }
          const res = await fetch(url, { headers });
          const body = await res.text();
          console.log(`Tried: ${url} -> HTTP ${res.status}, length ${body.length}`);
          if (res.ok && body && body.length > 10) {
            if (/[?&]fmt=json3/.test(url)) {
              try {
                const json = JSON.parse(body);
                const texts = [];
                if (Array.isArray(json.events)) {
                  for (const ev of json.events) {
                    if (Array.isArray(ev.segs)) {
                      texts.push(ev.segs.map(s => s.utf8).join(''));
                    }
                    if (texts.length >= 5) break;
                  }
                }
                if (texts.length) {
                  console.log('Preview (json3):', texts.join(' '));
                  return;
                }
              } catch {
                // fallthrough
              }
            }
            if (/[?&]fmt=vtt/.test(url)) {
              const lines = body.split(/\r?\n/);
              const cues = [];
              let i = 0;
              while (i < lines.length) {
                const timeIdx = lines[i].includes('-->') ? i : (lines[i + 1] && lines[i + 1].includes('-->') ? i + 1 : -1);
                if (timeIdx === -1) { i++; continue; }
                const textIdx = timeIdx + 1;
                const text = (lines[textIdx] || '').trim();
                if (text) cues.push(text);
                if (cues.length >= 5) break;
                i = textIdx + 1;
              }
              if (cues.length) {
                console.log('Preview (vtt):', cues.join(' '));
                return;
              }
            }
            // As last resort, print head of body
            console.log('Preview (raw):', body.slice(0, 300) + '...');
            return;
          }
        }
        console.error('All caption URL attempts returned empty or error.');
        return;
      } catch (e) {
        console.error('Failed to fetch caption XML:', e.message);
        return;
      }
    }

    if (!transcript) {
      console.log('No transcript data available.');
      return;
    }

    // youtubei.js transcript structure: Transcript -> content (TranscriptSearchPanel) -> body (TranscriptSegmentList)
    const segments = transcript?.content?.body?.initial_segments || [];
    console.log(`Transcript segments: ${segments.length}`);
    if (segments.length > 0) {
      const preview = segments.slice(0, 5).map(s => s.snippet ? s.snippet.text : (s.text || '')).join(' ');
      console.log('Preview:', preview);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testTranscript();