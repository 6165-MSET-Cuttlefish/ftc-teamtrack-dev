import {
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Search,
  Sun,
  Settings,
} from 'lucide-react';

const TeamTrackLogo = () => (
  <div className="flex items-center gap-6">
    <div className="flex items-center gap-2.5">
      <svg
        width="12"
        height="20"
        viewBox="0 0 8 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-2 h-5"
      >
        <path
          d="M3.99953 0.645596L7.60721 6.46935H0.464355L3.99953 0.645596Z"
          fill="#B0E5FE"
        />
        <path
          d="M3.99993 9.38123L0.392787 7.23372H7.53564L3.99993 9.38123Z"
          fill="#B0E5FE"
        />
        <path
          d="M0.321429 2.31992L3.28571 0.5L0 6.06897L0.321429 2.31992Z"
          fill="#B0E5FE"
        />
        <path
          d="M7.67857 2.31992L4.71429 0.5L8 6.06897L7.67857 2.31992Z"
          fill="#B0E5FE"
        />
        <path
          d="M0.392822 9.24855C0.392822 8.74891 0.92601 8.43006 1.36618 8.66649C1.58053 8.78162 1.71425 9.00524 1.71425 9.24855V18.3817C1.71425 18.6225 1.58325 18.8442 1.37235 18.9604C0.932001 19.203 0.392822 18.8844 0.392822 18.3817V9.24855Z"
          fill="#B0E5FE"
        />
        <path
          d="M2.36822 10.2849C2.37124 9.76044 2.94644 9.44078 3.39345 9.71519C3.59286 9.83762 3.71439 10.0548 3.71439 10.2888V17.1858C3.71439 17.4334 3.58228 17.6622 3.36783 17.786C2.90432 18.0535 2.32541 17.717 2.32849 17.1818L2.36822 10.2849Z"
          fill="#B0E5FE"
        />
        <path
          d="M7.53564 9.26287C7.53564 8.75993 6.99608 8.4414 6.55573 8.68437C6.34504 8.80063 6.21422 9.02223 6.21422 9.26287V18.4077C6.21422 18.6534 6.35056 18.8788 6.56818 18.9929C7.00811 19.2235 7.53564 18.9044 7.53564 18.4077V9.26287Z"
          fill="#B0E5FE"
        />
        <path
          d="M5.63178 10.2849C5.62876 9.76044 5.05356 9.44078 4.60655 9.71519C4.40714 9.83762 4.28561 10.0548 4.28561 10.2888V17.1858C4.28561 17.4334 4.41772 17.6622 4.63217 17.786C5.09568 18.0535 5.67459 17.717 5.67151 17.1818L5.63178 10.2849Z"
          fill="#B0E5FE"
        />
      </svg>
      <span className="text-white font-montserrat italic text-xs leading-6 relative -top-1.5">
        TeamTrack
      </span>
    </div>
  </div>
);

const SearchBox = () => (
  <div className="flex items-center gap-2.5 px-12 py-3.5 rounded-2xl bg-transparent">
    <Search className="w-4 h-4 text-team-blue-40" />
    <span className="text-team-blue-40 text-base font-medium">Search</span>
  </div>
);

const NavigationMenu = () => (
  <div className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-2xl border border-team-white-20 bg-team-dark-20">
    <span className="text-white text-base leading-6">Learn</span>
    <span className="text-white text-base leading-6">Community</span>
    <span className="text-white text-base leading-6">About Us</span>
    <div className="w-4 h-4 flex items-center justify-center">
      <div className="w-4 h-4 bg-white rounded-full"></div>
    </div>
    <Sun className="w-4 h-4 text-white" />
    <Settings className="w-4 h-4 text-white" />
  </div>
);

const StandardField = ({
  label,
  placeholder,
  hasChevronRight = false,
  hasSpecialContent = false,
}: {
  label: string;
  placeholder: string;
  hasChevronRight?: boolean;
  hasSpecialContent?: boolean;
}) => (
  <div className="flex flex-col gap-2 w-[296px]">
    <div className="flex items-center gap-2">
      <span className="text-white text-base font-normal leading-6">
        {label}
      </span>
      {hasChevronRight && <ChevronRight className="w-4 h-4 text-white" />}
    </div>
    <div className="flex justify-between items-center px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark">
      <span className="text-team-white-40 text-base font-light leading-6">
        {placeholder}
      </span>
      <div className="flex items-center gap-1">
        {hasSpecialContent && (
          <div className="flex items-center justify-center px-1 py-1 rounded">
            <span className="text-team-white-40 text-2xl font-medium leading-[18px]">
              H
            </span>
          </div>
        )}
        <div className="flex flex-col gap-0.5 p-0.5 rounded bg-team-white-10">
          <ChevronUp className="w-2.5 h-2.5 text-team-white-40" />
          <ChevronDown className="w-2.5 h-2.5 text-team-white-40" />
        </div>
      </div>
    </div>
  </div>
);

const AnalysisField = ({ value, label }: { value: string; label: string }) => (
  <div className="flex flex-col items-center gap-4 px-9 py-6 rounded-lg border border-team-blue-40 bg-team-dark-20">
    <div className="text-team-blue text-[32px] font-medium leading-6">
      {value}
    </div>
    <div className="text-team-white-60 text-base font-normal leading-6">
      {label}
    </div>
  </div>
);

export const FigmaDesign = () => {
  return (
    <div className="flex flex-col w-[1280px] h-[1378px] px-8 py-2 items-center gap-10 bg-team-dark">
      {/* Top Bar */}
      <div className="flex w-[1280px] px-9 py-4 justify-between items-center border-b border-team-white-20 bg-transparent">
        <div className="flex w-[338px] px-2.5 items-start gap-2.5">
          <TeamTrackLogo />
        </div>
        <div className="flex w-[338px] px-12 py-3.5 items-start gap-2.5 rounded-2xl">
          <SearchBox />
        </div>
        <div className="flex w-[338px] px-2.5 justify-center items-start gap-2.5 rounded-2xl border border-team-white-20 bg-team-dark-20">
          <NavigationMenu />
        </div>
      </div>

      {/* Content */}
      <div className="flex w-[1189px] items-start">
        {/* Left Content */}
        <div className="flex w-[776px] h-[1172px] px-0 py-14 flex-col items-start gap-16 border-r border-team-blue-10">
          {/* Header */}
          <div className="flex px-[94px] flex-col items-center gap-6">
            <h1 className="text-team-blue text-[48px] font-semibold leading-10">
              Active Practice Session
            </h1>
            <p className="text-white text-base font-normal leading-6">
              6165 Mset Cuttlefish
            </p>
          </div>

          {/* Session Setup */}
          <div className="flex flex-col items-start gap-8">
            <h2 className="text-team-blue text-2xl font-semibold leading-6">
              Session Setup
            </h2>
            <div className="flex items-start gap-6">
              <StandardField label="Session Name" placeholder="ex. practice" />
              <StandardField label="Driver Name" placeholder="Ethan Yang" />
            </div>
            <div className="flex items-start gap-6">
              <StandardField label="Session Duration" placeholder="minutes" />
              <StandardField label="Match Types" placeholder="Autonomous" />
            </div>
          </div>

          {/* Performance Metrics and TeleOp Score */}
          <div className="flex items-start gap-16">
            {/* Performance Metrics */}
            <div className="flex flex-col items-start gap-8">
              <h2 className="text-team-blue text-2xl font-semibold leading-6">
                Performance Metrics
              </h2>
              <div className="flex flex-col items-start gap-8">
                <StandardField
                  label="Final Score"
                  placeholder="ex. 438" 
                  hasChevronRight
                />
                <StandardField
                  label="Autonomous Score"
                  placeholder="ex. 200"
                  hasChevronRight
                />
                <StandardField label="TeleOp Score" placeholder="ex. 208" />
                <StandardField
                  label="End Game Score"
                  placeholder="ex. 208"
                  hasChevronRight
                />
              </div>
            </div>

            {/* TeleOp Score */}
            <div className="flex flex-col items-start gap-8">
              <h2 className="text-team-blue text-2xl font-semibold leading-4">
                TeleOp Score
              </h2>
              <div className="flex flex-col items-start gap-8">
                <StandardField
                  label="Samples"
                  placeholder="ex. 438"
                  hasChevronRight
                  hasSpecialContent
                />
                <StandardField
                  label="Specimen"
                  placeholder="ex. 200"
                  hasChevronRight
                />
                <StandardField
                  label="Floor mark"
                  placeholder="ex. 208"
                  hasChevronRight
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col items-start gap-6">
            <h2 className="text-team-blue text-2xl font-semibold leading-6">
              Notes
            </h2>
            <div className="flex items-start gap-6">
              <div className="flex w-[519px] flex-col items-start gap-2">
                <span className="text-white text-base font-normal leading-6">
                  Performance Notes & Observations
                </span>
                <div className="flex w-[519px] px-2.5 py-2.5 justify-between items-start rounded border border-team-blue-40 bg-team-dark">
                  <span className="text-team-white-40 text-base font-normal leading-6">
                    Describe any major mistakes
                  </span>
                  <div className="flex flex-col gap-0.5 p-0.5 rounded bg-team-white-10">
                    <ChevronUp className="w-2.5 h-2.5 text-team-white-40" />
                    <ChevronDown className="w-2.5 h-2.5 text-team-white-40" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Content - Live Preview */}
        <div className="flex w-[413px] h-[1116px] px-0 py-14 flex-col items-center gap-16">
          {/* Top Section */}
          <div className="flex flex-col items-center gap-12">
            <div className="flex flex-col items-center gap-6">
              <h1 className="text-team-blue text-[48px] font-semibold leading-9">
                Live Preview
              </h1>
              <p className="text-white text-base font-normal leading-6">
                Real time analysis
              </p>
            </div>
            <div className="text-team-blue text-[48px] font-semibold leading-9">
              27:22
            </div>
          </div>

          {/* Data Section */}
          <div className="flex flex-col justify-end items-center gap-8">
            {/* Data Cards */}
            <div className="flex items-start gap-9">
              <AnalysisField value="438" label="Final Score" />
              <AnalysisField value="87%" label="Consistency" />
            </div>

            {/* Session Overview */}
            <div className="flex w-[358px] px-6 py-6 flex-col items-start gap-2.5 rounded-lg border border-team-blue-40">
              <h3 className="text-white text-base font-medium leading-6">
                Session Overview
              </h3>
              <div className="flex justify-between items-start self-stretch">
                <div className="flex flex-col justify-center items-start gap-2.5">
                  <span className="text-team-white-60 text-xs font-normal leading-6">
                    Driver
                  </span>
                  <span className="text-team-white-60 text-xs font-normal leading-6">
                    Match Type
                  </span>
                  <span className="text-team-white-60 text-xs font-normal leading-6">
                    Duration
                  </span>
                  <span className="text-team-white-60 text-xs font-normal leading-6">
                    Score
                  </span>
                </div>
                <div className="flex flex-col justify-center items-start gap-2.5">
                  <span className="text-team-blue text-xs font-normal leading-6">
                    Ethan Yang
                  </span>
                  <span className="text-team-blue text-xs font-normal leading-6">
                    Full Game
                  </span>
                  <span className="text-team-blue text-xs font-normal leading-6">
                    2:30
                  </span>
                  <span className="text-team-blue text-xs font-normal leading-6">
                    438
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Insights */}
            <div className="flex w-[358px] px-6 py-6 flex-col items-start gap-2.5 rounded-lg border border-team-blue-40">
              <h3 className="text-white text-base font-medium leading-6">
                Performance Insights
              </h3>
              <span className="text-team-white-60 text-xs font-normal leading-6">
                Improvements in XXX
              </span>
            </div>

            {/* CTA Button */}
            <button className="flex w-60 px-2.5 py-2.5 justify-center items-start gap-2.5 rounded-2xl border border-team-white-20 bg-team-blue">
              <span className="text-team-dark text-base font-normal leading-6">
                View Full Analysis Report
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
