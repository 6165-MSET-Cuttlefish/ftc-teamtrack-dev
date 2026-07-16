import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useTheme, useTeam } from '@/contexts';
import { useVideoAnalysisUpload } from '@/hooks';
import { videoAnalysisService } from '@/services';
import { TeamManager, VideoUploadCard, VideoAnalysisResult, VideoAnalysisList } from '@/components';
import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/constants';
import type { VideoAnalysis as VideoAnalysisType } from '@/types';
import { Video } from 'lucide-react';
import { toast } from 'sonner';

const VideoAnalysisPage = () => {
  const { user, isGuest } = useAuth();
  const { isDarkMode } = useTheme();
  const { team } = useTeam();
  const [analyses, setAnalyses] = useState<VideoAnalysisType[]>([]);
  const [selected, setSelected] = useState<VideoAnalysisType | null>(null);

  const { stage, error, upload, reset } = useVideoAnalysisUpload({
    teamId: team?.id ?? '',
    uploaderId: user?.uid ?? '',
    uploaderName: user?.displayName ?? user?.email ?? undefined,
  });

  useEffect(() => {
    document.title = `Video Analysis - ${APP_CONFIG.name}`;
  }, []);

  useEffect(() => {
    if (!team) {
      setAnalyses([]);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    videoAnalysisService
      .subscribeTeamVideoAnalyses(
        team.id,
        (teamAnalyses) => setAnalyses(teamAnalyses),
        (err) => toast.error(`Sync error: ${err.message}`)
      )
      .then((unsub) => {
        unsubscribe = unsub;
      });

    return () => unsubscribe?.();
  }, [team]);

  const handleFileSelected = useCallback(
    async (file: File) => {
      const saved = await upload(file);
      if (saved) {
        setSelected(saved);
        toast.success('Analysis complete');
      }
    },
    [upload]
  );

  const handleDelete = useCallback(
    async (analysisId: string) => {
      const ok = await videoAnalysisService.deleteVideoAnalysis(analysisId);
      if (ok) {
        setAnalyses((prev) => prev.filter((a) => a.id !== analysisId));
        setSelected((prev) => (prev?.id === analysisId ? null : prev));
        toast.success('Analysis deleted');
      } else {
        toast.error('Failed to delete analysis');
      }
    },
    []
  );

  return (
    <div className={`min-h-screen page-transition ${isDarkMode ? 'bg-team-dark' : 'bg-[#FEFEFE]'}`}>
      <div className="max-w-[1152px] mx-auto px-2 sm:px-3 md:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 md:py-8 lg:py-12">
        <div className="mb-6 flex flex-col gap-3">
          <h1 className={`text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-team-blue'}`}>
            <Video className="h-6 w-6 sm:h-7 sm:w-7" />
            Robot Video Analysis
          </h1>
          {!isGuest && team && <TeamManager onTeamChange={() => setAnalyses([])} />}
        </div>

        {isGuest ? (
          <div className="text-center py-16">
            <p className={`mb-4 ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>
              Sign up and join a team to analyze robot videos.
            </p>
            <Button asChild className={`bg-team-blue hover:bg-team-blue/90 ${isDarkMode ? 'text-black' : 'text-white'}`}>
              <Link to="/signup">Sign Up</Link>
            </Button>
          </div>
        ) : !team ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className={`text-center ${isDarkMode ? 'text-team-white-60' : 'text-team-blue-40'}`}>
              Video analyses are shared with your team. Join or create a team to get started.
            </p>
            <TeamManager onTeamChange={() => setAnalyses([])} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
            <div className="flex flex-col gap-6">
              <VideoUploadCard
                stage={stage}
                error={error}
                onFileSelected={handleFileSelected}
                onReset={reset}
              />
              {selected && <VideoAnalysisResult analysis={selected} />}
            </div>
            <VideoAnalysisList
              analyses={analyses}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoAnalysisPage;
