import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

/**
 * Dev-only middleware for the video-captioning UI (see /dev/videos).
 *
 * - GET    /__dev-videos/api/list     → lists videos in client/public/dev-videos
 *                                        plus their saved captions.
 * - POST   /__dev-videos/api/caption  → { file, caption } persisted to
 *                                        client/public/dev-videos/captions.json
 * - POST   /__dev-videos/api/delete   → { file } removes the video file from
 *                                        disk and drops its caption.
 * - POST   /__dev-videos/api/transcode → { file } transcodes a non-web-friendly
 *                                        source (e.g. .mov) to H.264/AAC MP4,
 *                                        caches it under _transcoded/, and
 *                                        returns { url } for the cached MP4.
 *
 * Everything is stored in the repo (video files + captions.json), no database.
 * Videos are served statically by Vite from the public dir (with HTTP range
 * support, so seeking works). Formats browsers can't reliably decode are
 * transcoded to MP4 on demand via a bundled ffmpeg (ffmpeg-static) and cached
 * to disk. This plugin is not applied in production builds.
 */
const devVideosPlugin = (): Plugin => {
  const videosDir = path.resolve(__dirname, './client/public/dev-videos');
  const captionsPath = path.join(videosDir, 'captions.json');
  // Transcoded MP4s are cached here (served statically at /dev-videos/_transcoded).
  const cacheDir = path.join(videosDir, '_transcoded');
  const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v', '.ogg', '.avi', '.mkv'];
  // Extensions browsers can generally play directly — served as-is, no transcode.
  const NATIVE_EXTENSIONS = new Set(['.mp4', '.webm', '.m4v', '.ogg']);

  const cachedNameFor = (file: string) => `${file}.mp4`;
  const cachedUrlFor = (file: string) =>
    `/dev-videos/_transcoded/${encodeURIComponent(cachedNameFor(file))}`;

  /** True when a fresh transcoded MP4 already exists for `file`. */
  const isCacheFresh = (file: string): boolean => {
    try {
      const src = fs.statSync(path.join(videosDir, file));
      const out = fs.statSync(path.join(cacheDir, cachedNameFor(file)));
      return out.mtimeMs >= src.mtimeMs;
    } catch {
      return false;
    }
  };

  // De-dupe concurrent transcodes of the same file.
  const inFlight = new Map<string, Promise<string>>();

  /** Ensure a cached MP4 exists for `file`; resolves to its served URL. */
  const ensureTranscoded = (file: string): Promise<string> => {
    if (isCacheFresh(file)) return Promise.resolve(cachedUrlFor(file));
    const existing = inFlight.get(file);
    if (existing) return existing;
    const job = new Promise<string>((resolve, reject) => {
      if (!ffmpegPath) {
        reject(new Error('ffmpeg binary unavailable'));
        return;
      }
      fs.mkdirSync(cacheDir, { recursive: true });
      const src = path.join(videosDir, file);
      const outPath = path.join(cacheDir, cachedNameFor(file));
      const tmpPath = `${outPath}.tmp-${Date.now()}.mp4`;
      execFile(
        ffmpegPath,
        [
          '-i', src,
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '23',
          '-pix_fmt', 'yuv420p', // required for broad browser support
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart', // enable progressive streaming
          '-y', tmpPath,
        ],
        { maxBuffer: 1024 * 1024 * 16 },
        err => {
          if (err) {
            try {
              fs.rmSync(tmpPath, { force: true });
            } catch {
              /* ignore */
            }
            reject(err);
            return;
          }
          try {
            fs.renameSync(tmpPath, outPath); // atomic swap-in
          } catch (renameErr) {
            reject(renameErr as Error);
            return;
          }
          resolve(cachedUrlFor(file));
        }
      );
    }).finally(() => inFlight.delete(file));
    inFlight.set(file, job);
    return job;
  };

  const readCaptions = (): Record<string, string> => {
    try {
      return JSON.parse(fs.readFileSync(captionsPath, 'utf-8')) as Record<string, string>;
    } catch {
      return {};
    }
  };

  const writeCaptions = (captions: Record<string, string>): void => {
    fs.mkdirSync(videosDir, { recursive: true });
    fs.writeFileSync(captionsPath, `${JSON.stringify(captions, null, 2)}\n`, 'utf-8');
  };

  /** Only allow bare filenames — reject anything that could escape the dir. */
  const isValidFileName = (file: unknown): file is string =>
    typeof file === 'string' &&
    file.length > 0 &&
    !file.includes('/') &&
    !file.includes('\\') &&
    !file.includes('..');

  const readJsonBody = (
    req: import('http').IncomingMessage
  ): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}') as Record<string, unknown>);
        } catch {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });

  return {
    name: 'dev-videos-middleware',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev-videos/api/list', (_req, res) => {
        const captions = readCaptions();
        let files: string[] = [];
        try {
          files = fs
            .readdirSync(videosDir)
            .filter(f => VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        } catch {
          files = [];
        }
        const videos = files.map(file => {
          const ext = path.extname(file).toLowerCase();
          const caption = captions[file] ?? '';
          if (NATIVE_EXTENSIONS.has(ext)) {
            return {
              file,
              url: `/dev-videos/${encodeURIComponent(file)}`,
              caption,
              ready: true,
              needsTranscode: false,
            };
          }
          // Non-web-friendly source: play the cached MP4 if it's already built,
          // otherwise flag it so the client can request a transcode.
          const ready = isCacheFresh(file);
          return {
            file,
            url: ready ? cachedUrlFor(file) : '',
            caption,
            ready,
            needsTranscode: true,
          };
        });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ videos }));
      });

      server.middlewares.use('/__dev-videos/api/caption', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        readJsonBody(req)
          .then(({ file, caption }) => {
            if (!isValidFileName(file) || typeof caption !== 'string') {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Expected { file, caption }' }));
              return;
            }
            const captions = readCaptions();
            if (caption.trim() === '') {
              delete captions[file];
            } else {
              captions[file] = caption;
            }
            writeCaptions(captions);
            res.end(JSON.stringify({ ok: true, file, caption }));
          })
          .catch(() => {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          });
      });

      server.middlewares.use('/__dev-videos/api/delete', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        readJsonBody(req)
          .then(({ file }) => {
            if (!isValidFileName(file)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid file name' }));
              return;
            }
            const target = path.join(videosDir, file);
            // Extra guard: resolved path must stay inside videosDir.
            if (path.dirname(target) !== videosDir) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid file name' }));
              return;
            }
            try {
              fs.rmSync(target, { force: true });
              // Also drop any cached transcode for this source.
              fs.rmSync(path.join(cacheDir, cachedNameFor(file)), { force: true });
            } catch {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to delete file' }));
              return;
            }
            const captions = readCaptions();
            if (file in captions) {
              delete captions[file];
              writeCaptions(captions);
            }
            res.end(JSON.stringify({ ok: true, file }));
          })
          .catch(() => {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          });
      });

      server.middlewares.use('/__dev-videos/api/transcode', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }
        readJsonBody(req)
          .then(({ file }) => {
            if (!isValidFileName(file)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid file name' }));
              return;
            }
            if (!fs.existsSync(path.join(videosDir, file))) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'File not found' }));
              return;
            }
            ensureTranscoded(file)
              .then(url => res.end(JSON.stringify({ ok: true, file, url })))
              .catch(() => {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Transcode failed' }));
              });
          })
          .catch(() => {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          });
      });
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig(() => ({
  root: './client',
  envDir: '../',
  server: {
    host: 'localhost', // Use localhost instead of IPv6
    port: 8080,
    hmr: {
      // Use polling instead of WebSocket to avoid compression issues
      port: 24678,
      // Disable overlay for errors
      overlay: false,
      clientPort: 24678,
    },
    watch: {
      // Use polling for file watching (more reliable)
      usePolling: process.env.USE_POLLING !== 'false',
      interval: parseInt(process.env.WATCH_INTERVAL || '2000', 10),
    },
    fs: {
      allow: ['.', '../', './src'],
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**'],
    },
  },
  build: {
    outDir: '../dist/spa',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
          ],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
  plugins: [react(), devVideosPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src/'),
    },
  },
}));
