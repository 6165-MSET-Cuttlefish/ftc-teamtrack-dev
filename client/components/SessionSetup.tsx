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
    <div className="px-2.5 py-2.5 rounded border border-team-blue-40 bg-team-dark text-team-white-40 text-base font-normal leading-6">
      {value || placeholder}
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
