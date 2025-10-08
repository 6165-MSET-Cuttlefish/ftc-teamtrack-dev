import { SessionSetup } from '../components/SessionSetup';
import { PerformanceMetrics } from '../components/PerformanceMetrics';
import { Notes } from '../components/Notes';
import { LivePreview } from '../components/LivePreview';

const OriginalContent = () => {

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Session Form */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <header className="text-center space-y-4">
              <h1 className="text-team-blue text-3xl lg:text-4xl font-bold">
                Active Practice Session
              </h1>
              <p className="text-lg text-muted-foreground">
                6165 MSET Cuttlefish
              </p>
            </header>

            {/* Session Components */}
            <div className="space-y-8">
              <SessionSetup />
              <PerformanceMetrics />
              <Notes />
            </div>
          </div>

          {/* Sidebar - Live Preview */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <LivePreview />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Original() {
  return <OriginalContent />;
}
