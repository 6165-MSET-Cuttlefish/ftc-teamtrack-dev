import { ChevronUp, ChevronDown } from "lucide-react";

const FormField = ({
  label,
  placeholder,
  value,
}: {
  label: string;
  placeholder: string;
  value?: string;
}) => (
  <div className="flex flex-col gap-2 w-full sm:max-w-[296px]">
    <label className="text-white text-base leading-6">{label}</label>
    <div className="flex justify-between items-center px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark">
      <span className="text-team-white-40 text-base font-light leading-6">
        {value || placeholder}
      </span>
      <div className="flex flex-col gap-0.5 p-0.5 rounded bg-team-white-10">
        <ChevronUp className="w-2.5 h-2.5 text-team-white-40" />
        <ChevronDown className="w-2.5 h-2.5 text-team-white-40" />
      </div>
    </div>
  </div>
);

export const SessionSetup = () => {
  return (
    <div className="space-y-8">
      <h2 className="text-team-blue text-2xl font-semibold leading-6">
        Session Setup
      </h2>

      <div className="space-y-6">
        {/* First Row */}
        <div className="flex flex-col sm:flex-row gap-6">
          <FormField label="Session Name" placeholder="ex. practice" />
          <FormField
            label="Driver Name"
            placeholder="Ethan Yang"
            value="Ethan Yang"
          />
        </div>

        {/* Second Row */}
        <div className="flex flex-col sm:flex-row gap-6">
          <FormField label="Session Duration" placeholder="minutes" />
          <FormField
            label="Match Type"
            placeholder="Autonomous"
            value="Autonomous"
          />
        </div>
      </div>
    </div>
  );
};
