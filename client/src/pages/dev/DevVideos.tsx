import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Film, RefreshCw, Check, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface DevVideo {
  file: string;
  /** Playable URL, or '' when a transcode is still needed. */
  url: string;
  caption: string;
  /** False when the source must be transcoded to MP4 before it can play. */
  ready: boolean;
  /** True for non-web-friendly sources (e.g. .mov) that get converted. */
  needsTranscode: boolean;
}

type SaveState = 'idle' | 'saving' | 'saved';

/**
 * Dev-only tool for captioning videos dropped into dev-videos/ at the repo root.
 * Captions are persisted to disk (captions.json) via the dev-videos Vite
 * middleware. This page is only registered when import.meta.env.DEV is true.
 */
const DevVideos = () => {
  const [videos, setVideos] = useState<DevVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/__dev-videos/api/list');
      if (!res.ok) throw new Error(`List failed (${res.status})`);
      const data = (await res.json()) as { videos: DevVideo[] };
      setVideos(data.videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const removeVideo = useCallback((file: string) => {
    setVideos(prev => prev.filter(v => v.file !== file));
  }, []);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Film className="h-7 w-7 text-team-blue" />
            Video Captioning
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Videos live in{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              dev-videos/
            </code>
            . Captions save to{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              captions.json
            </code>{' '}
            in that folder.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="mb-4 border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading && videos.length === 0 ? (
        <p className="text-muted-foreground">Loading videos…</p>
      ) : videos.length === 0 && !error ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No videos found. Drop video files into{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              dev-videos/
            </code>{' '}
            and click Refresh.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {videos.map(video => (
            <VideoRow key={video.file} video={video} onDeleted={removeVideo} />
          ))}
        </div>
      )}
    </div>
  );
};

const VideoRow = ({
  video,
  onDeleted,
}: {
  video: DevVideo;
  onDeleted: (file: string) => void;
}) => {
  const [caption, setCaption] = useState(video.caption);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [videoUrl, setVideoUrl] = useState(video.url);
  const [transcoding, setTranscoding] = useState(false);
  const [transcodeError, setTranscodeError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const runTranscode = useCallback(async () => {
    setTranscoding(true);
    setTranscodeError(null);
    try {
      const res = await fetch('/__dev-videos/api/transcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: video.file }),
      });
      if (!res.ok) throw new Error(`Convert failed (${res.status})`);
      const data = (await res.json()) as { url: string };
      setVideoUrl(data.url);
    } catch (err) {
      setTranscodeError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setTranscoding(false);
    }
  }, [video.file]);

  // Auto-convert non-web-friendly sources (e.g. .mov) to MP4 on first render.
  useEffect(() => {
    if (video.needsTranscode && !video.ready && !videoUrl) void runTranscode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const discard = useCallback(async () => {
    // First click arms the confirm; second click within 4s actually deletes.
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmingDelete(false), 4000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingDelete(false);
    setDeleting(true);
    try {
      const res = await fetch('/__dev-videos/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: video.file }),
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      toast.success(`Deleted ${video.file}`);
      onDeleted(video.file);
    } catch (err) {
      setDeleting(false);
      toast.error(err instanceof Error ? err.message : 'Failed to delete video');
    }
  }, [confirmingDelete, onDeleted, video.file]);

  const save = useCallback(async () => {
    setSaveState('saving');
    try {
      const res = await fetch('/__dev-videos/api/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: video.file, caption }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSaveState('saved');
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      setSaveState('idle');
      toast.error(err instanceof Error ? err.message : 'Failed to save caption');
    }
  }, [caption, video.file]);

  const dirty = caption !== video.caption;

  return (
    <Card>
      <CardContent className="grid gap-4 p-4 md:grid-cols-2">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            preload="metadata"
            className="w-full rounded-md bg-black"
          />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-md bg-black text-center text-sm text-white/70">
            {transcoding ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Converting to MP4…</span>
                <span className="text-xs text-white/50">
                  Large files can take a moment.
                </span>
              </>
            ) : transcodeError ? (
              <>
                <span className="text-destructive">{transcodeError}</span>
                <Button variant="outline" size="sm" onClick={() => void runTranscode()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => void runTranscode()}>
                <Film className="mr-2 h-4 w-4" />
                Convert to MP4
              </Button>
            )}
          </div>
        )}
        <div className="flex flex-col">
          <p className="mb-2 break-all font-mono text-sm font-medium">{video.file}</p>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void save();
            }}
            placeholder="Type a caption for this video…"
            className="min-h-[8rem] flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={!dirty || saveState === 'saving'}>
              {saveState === 'saving' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : saveState === 'saved' ? (
                <Check className="mr-2 h-4 w-4" />
              ) : null}
              {saveState === 'saved' ? 'Saved' : 'Save caption'}
            </Button>
            <Button
              variant={confirmingDelete ? 'destructive' : 'outline'}
              onClick={() => void discard()}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {confirmingDelete ? 'Click to confirm' : 'Discard'}
            </Button>
            <span className="text-xs text-muted-foreground">
              {dirty ? 'Unsaved changes · ⌘/Ctrl+Enter' : 'Saved to captions.json'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DevVideos;
