import { ChevronRight, ChevronUp, ChevronDown } from "lucide-react";

const MetricField = ({
  label,
  placeholder,
  hasDropdown = true
}: {
  label: string;
  placeholder: string;
  hasDropdown?: boolean;
}) => (
  <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
    <div className="flex items-center gap-2">
      <label className="text-white text-base leading-6">{label}</label>
      {hasDropdown && <ChevronRight className="w-4 h-4 text-white" />}
    </div>
    <div className="flex justify-between items-center px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark">
      <span className="text-team-white-40 text-base font-light leading-6">
        {placeholder}
      </span>
      <div className="flex flex-col gap-0.5 p-0.5 rounded bg-team-white-10">
        <ChevronUp className="w-2.5 h-2.5 text-team-white-40" />
        <ChevronDown className="w-2.5 h-2.5 text-team-white-40" />
      </div>
    </div>
  </div>
);

export const PerformanceMetrics = () => {
  return (
    <div className="space-y-8">
      <h2 className="text-team-blue text-2xl font-semibold leading-6">
        Performance Metrics
      </h2>
      
      <div className="space-y-6">
        {/* First Row */}
        <div className="flex flex-col gap-6">
          <MetricField 
            label="Final Score" 
            placeholder="ex. 438" 
          />
          <MetricField 
            label="Autonomous Score" 
            placeholder="ex. 200" 
          />
        </div>
        
        {/* Second Row */}
        <div className="flex flex-col gap-6">
          <MetricField 
            label="TeleOp Score" 
            placeholder="ex. 208" 
          />
        </div>
        
        {/* Third Row */}
        <div className="flex flex-col gap-6">
          <MetricField 
            label="End Game Score" 
            placeholder="ex. 208" 
          />
        </div>
      </div>
    </div>
  );
};
