import { useRef } from 'react';
import { useTheme } from '@/contexts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VIDEO_LIMITS } from '@/constants';
import { Upload, Loader2 } from 'lucide-react';
import type { UploadStage } from '@/hooks';

interface VideoUploadCardProps {
  stage: UploadStage;
  error: string | null;
  onFileSelected: (file: File) => void;
  onReset: () => void;
}

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: '',
  validating: 'Checking video…',
  uploading: 'Uploading video…',
  analyzing: 'Tracking robots with Gemini…',
  saving: 'Saving results…',
  done: 'Done!',
  error: 'Something went wrong',
};

export const VideoUploadCard = ({
  stage,
  error,
  onFileSelected,
  onReset,
}: VideoUploadCardProps) => {
  const { isDarkMode } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const isBusy = stage !== 'idle' && stage !== 'done' && stage !== 'error';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    e.target.value = '';
  };

  return (
    <Card
      className={
        isDarkMode
          ? 'border-team-blue-40 bg-team-dark'
          : 'border-gray-200 bg-white'
      }
    >
      <CardHeader>
        <CardTitle className={isDarkMode ? 'text-white' : 'text-team-blue'}>
          Analyze a robot video
        </CardTitle>
        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Upload a clip under {VIDEO_LIMITS.MAX_DURATION_SECONDS} seconds. Gemini will
          track your robot and suggest concrete design/gameplay improvements.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleChange}
          disabled={isBusy}
        />
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={isBusy}
          className={`bg-team-blue hover:bg-team-blue/90 disabled:opacity-60 ${isDarkMode ? 'text-black' : 'text-white'}`}
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {isBusy ? STAGE_LABELS[stage] : 'Choose video'}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={onReset}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
