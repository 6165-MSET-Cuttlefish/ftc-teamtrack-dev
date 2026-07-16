import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { VideoAnalysis } from '@/types';
import { Lightbulb } from 'lucide-react';

interface VideoAnalysisResultProps {
  analysis: VideoAnalysis;
}

/** Finds the tracking frame whose timestamp is closest to `tSec` (within 1s) */
function nearestFrame(analysis: VideoAnalysis, tSec: number) {
  let best = null;
  let bestDiff = Infinity;
  for (const frame of analysis.tracking) {
    const diff = Math.abs(frame.tSec - tSec);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = frame;
    }
  }
  return bestDiff <= 1 ? best : null;
}

export const VideoAnalysisResult = ({ analysis }: VideoAnalysisResultProps) => {
  const { isDarkMode } = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = video.clientWidth;
      const height = video.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.clearRect(0, 0, width, height);

      const frame = nearestFrame(analysis, video.currentTime);
      if (!frame) return;

      ctx.strokeStyle = '#00E0FF';
      ctx.lineWidth = 3;
      ctx.font = '14px sans-serif';
      ctx.textBaseline = 'top';

      for (const box of frame.boxes) {
        const [ymin, xmin, ymax, xmax] = box.box_2d;
        const x = (xmin / 1000) * width;
        const y = (ymin / 1000) * height;
        const w = ((xmax - xmin) / 1000) * width;
        const h = ((ymax - ymin) / 1000) * height;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#00E0FF';
        const labelWidth = ctx.measureText(box.label).width + 8;
        ctx.fillRect(x, Math.max(0, y - 18), labelWidth, 18);
        ctx.fillStyle = '#001014';
        ctx.fillText(box.label, x + 4, Math.max(0, y - 18) + 2);
      }
    };

    video.addEventListener('timeupdate', draw);
    video.addEventListener('loadedmetadata', draw);
    window.addEventListener('resize', draw);
    return () => {
      video.removeEventListener('timeupdate', draw);
      video.removeEventListener('loadedmetadata', draw);
      window.removeEventListener('resize', draw);
    };
  }, [analysis]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full max-w-2xl mx-auto rounded-lg overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={analysis.cloudinaryUrl}
          controls
          playsInline
          className="w-full block"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
        />
      </div>
      <p className={`text-xs text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        Boxes are AI-estimated per frame, not guaranteed frame-to-frame identity tracking.
      </p>

      <Card
        className={
          isDarkMode
            ? 'border-team-blue-40 bg-team-dark'
            : 'border-gray-200 bg-white'
        }
      >
        <CardHeader>
          <CardTitle className={`text-lg ${isDarkMode ? 'text-white' : 'text-team-blue'}`}>
            Coaching report
          </CardTitle>
          <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {analysis.report.summary}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {analysis.report.findings.map((finding, i) => (
            <div key={i} className="flex gap-3">
              <Lightbulb className="h-5 w-5 flex-shrink-0 text-team-blue mt-0.5" />
              <div>
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {finding.observation}
                </p>
                <p className={`text-sm font-medium mt-1 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}>
                  {finding.suggestion}
                </p>
              </div>
            </div>
          ))}
          <p className={`text-xs pt-2 border-t ${isDarkMode ? 'text-gray-500 border-gray-700' : 'text-gray-400 border-gray-200'}`}>
            AI-generated starting point for human review — not authoritative engineering advice.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
