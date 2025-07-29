import { Header } from "../components/Header";
import { SessionSetup } from "../components/SessionSetup";
import { PerformanceMetrics } from "../components/PerformanceMetrics";
import { Notes } from "../components/Notes";
import { LivePreview } from "../components/LivePreview";
import { FigmaDesign } from "../components/FigmaDesign";

export default function Index() {
  return (
    <div className="min-h-screen bg-team-dark">
      <div className="flex gap-8 overflow-x-auto">
        {/* Original Implementation */}
        <div className="flex-shrink-0 w-1/2 min-w-[640px] border-r border-team-white-20 pr-8">
          <div className="text-center py-8">
            <h2 className="text-team-blue text-2xl font-semibold mb-2">Original Implementation</h2>
            <p className="text-team-white-60">Current responsive design</p>
          </div>

          <Header />

          <div className="flex flex-col lg:flex-row items-start max-w-[1216px] mx-auto px-4 sm:px-8 py-5 lg:py-10 gap-6 lg:gap-10">
            {/* Left Column - Session Form */}
            <div className="flex-1 w-full lg:max-w-[776px] py-8 lg:py-14 lg:pr-12 lg:border-r border-team-blue-10">
              <div className="space-y-12 lg:space-y-16">
                {/* Header */}
                <div className="text-center px-4 lg:px-24 space-y-6">
                  <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold leading-tight lg:leading-9">
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
            <div className="w-full lg:w-[413px] py-8 lg:py-14 px-4">
              <LivePreview />
            </div>
          </div>
        </div>

        {/* Figma Design Implementation */}
        <div className="flex-shrink-0 w-1/2 min-w-[640px] pl-8">
          <div className="text-center py-8">
            <h2 className="text-team-blue text-2xl font-semibold mb-2">Figma Design Implementation</h2>
            <p className="text-team-white-60">Pixel-perfect recreation from Figma</p>
          </div>

          <div className="flex justify-center overflow-x-auto">
            <div className="scale-50 origin-top">
              <FigmaDesign />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
