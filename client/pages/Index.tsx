import { Header } from "../components/Header";
import { SessionSetup } from "../components/SessionSetup";
import { PerformanceMetrics } from "../components/PerformanceMetrics";
import { Notes } from "../components/Notes";
import { LivePreview } from "../components/LivePreview";

export default function Index() {
  return (
    <div className="min-h-screen bg-team-dark">
      <Header />
      
      <div className="flex items-start max-w-[1216px] mx-auto px-8 py-10 gap-10">
        {/* Left Column - Session Form */}
        <div className="flex-1 max-w-[776px] py-14 pr-12 border-r border-team-blue-10">
          <div className="space-y-16">
            {/* Header */}
            <div className="text-center px-24 space-y-6">
              <h1 className="text-team-blue text-5xl font-semibold leading-9">
                Active Practice Session
              </h1>
              <p className="text-white text-base leading-6">
                6165 Mset Cuttlefish
              </p>
            </div>

            {/* Session Setup */}
            <SessionSetup />

            {/* Performance Metrics */}
            <PerformanceMetrics />

            {/* Notes */}
            <Notes />
          </div>
        </div>

        {/* Right Column - Live Preview */}
        <div className="w-[413px] py-14 px-4">
          <LivePreview />
        </div>
      </div>
    </div>
  );
}
