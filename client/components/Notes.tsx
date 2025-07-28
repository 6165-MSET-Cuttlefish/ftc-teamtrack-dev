import { ChevronUp, ChevronDown } from "lucide-react";

export const Notes = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-team-blue text-2xl font-semibold leading-6">Notes</h2>

      <div className="flex gap-6">
        <div className="flex flex-col gap-2 w-full sm:max-w-[519px]">
          <label className="text-white text-base leading-6">
            Performance Notes & Observations
          </label>
          <div className="flex justify-between items-center px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark">
            <span className="text-team-white-40 text-base leading-6">
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
  );
};
