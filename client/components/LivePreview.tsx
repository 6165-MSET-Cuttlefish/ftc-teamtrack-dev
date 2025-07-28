const DataCard = ({ value, label }: { value: string; label: string }) => (
  <div className="flex flex-col items-center gap-4 px-9 py-6 rounded-lg border border-team-blue-40 bg-team-dark-20">
    <div className="text-team-blue text-3xl font-medium leading-6">{value}</div>
    <div className="text-team-white-60 text-base leading-6">{label}</div>
  </div>
);

const OverviewCard = () => (
  <div className="w-full px-6 py-6 rounded-lg border border-team-blue-40 space-y-2.5">
    <h3 className="text-white text-base font-medium leading-6">
      Session Overview
    </h3>
    <div className="flex justify-between items-start">
      <div className="flex flex-col gap-2.5">
        <div className="text-team-white-60 text-xs leading-6">Driver</div>
        <div className="text-team-white-60 text-xs leading-6">Match Type</div>
        <div className="text-team-white-60 text-xs leading-6">Duration</div>
        <div className="text-team-white-60 text-xs leading-6">Score</div>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="text-team-blue text-xs leading-6">Ethan Yang</div>
        <div className="text-team-blue text-xs leading-6">Full Game</div>
        <div className="text-team-blue text-xs leading-6">2:30</div>
        <div className="text-team-blue text-xs leading-6">438</div>
      </div>
    </div>
  </div>
);

const InsightsCard = () => (
  <div className="w-full px-6 py-6 rounded-lg border border-team-blue-40 space-y-2.5">
    <h3 className="text-white text-base font-medium leading-6">
      Performance Insights
    </h3>
    <div className="text-team-white-60 text-xs leading-6">
      Improvements in XXX
    </div>
  </div>
);

export const LivePreview = () => {
  return (
    <div className="flex flex-col items-center gap-12 lg:gap-16">
      {/* Header Section */}
      <div className="flex flex-col items-center gap-8 lg:gap-12">
        <div className="text-center space-y-6">
          <h1 className="text-team-blue text-3xl lg:text-5xl font-semibold leading-tight lg:leading-9">
            Live Preview
          </h1>
          <p className="text-white text-base leading-6">Real time analysis</p>
        </div>

        <div className="text-team-blue text-4xl lg:text-5xl font-semibold leading-tight lg:leading-9">
          27:22
        </div>
      </div>

      {/* Data Section */}
      <div className="flex flex-col items-center gap-6 lg:gap-8 w-full">
        {/* Data Cards Row */}
        <div className="flex flex-col sm:flex-row gap-6 lg:gap-9 w-full justify-center">
          <DataCard value="438" label="Final Score" />
          <DataCard value="87%" label="Consistency" />
        </div>

        {/* Overview Card */}
        <OverviewCard />

        {/* Insights Card */}
        <InsightsCard />

        {/* CTA Button */}
        <button className="w-full sm:w-60 px-2.5 py-2.5 rounded-2xl border border-team-white-20 bg-team-blue text-team-dark text-base leading-6 font-normal">
          View Full Analysis Report
        </button>
      </div>
    </div>
  );
};
