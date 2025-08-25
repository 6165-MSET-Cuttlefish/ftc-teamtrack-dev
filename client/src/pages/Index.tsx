import { Link } from "react-router-dom";

export default function Index() {
  return (
    <div className="min-h-screen bg-team-dark flex flex-col items-center justify-center">
      <div className="text-center space-y-12">
        <div className="space-y-6">
          <h1 className="text-team-blue text-5xl font-semibold">TeamTrack Implementations</h1>
          <p className="text-white text-xl">Choose which implementation to view</p>
        </div>

        <div className="flex gap-12">
          <Link
            to="/original"
            className="flex flex-col items-center gap-6 p-8 rounded-2xl border border-team-blue-40 bg-team-dark-20 hover:bg-team-blue-10 transition-colors"
          >
            <div className="w-16 h-16 rounded-full bg-team-blue flex items-center justify-center">
              <span className="text-team-dark text-2xl font-bold">O</span>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-team-blue text-2xl font-semibold">Original Implementation</h2>
              <p className="text-team-white-60">Current responsive design</p>
            </div>
          </Link>

          <Link
            to="/figma"
            className="flex flex-col items-center gap-6 p-8 rounded-2xl border border-team-blue-40 bg-team-dark-20 hover:bg-team-blue-10 transition-colors"
          >
            <div className="w-16 h-16 rounded-full bg-team-blue flex items-center justify-center">
              <span className="text-team-dark text-2xl font-bold">F</span>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-team-blue text-2xl font-semibold">Figma Implementation</h2>
              <p className="text-team-white-60">Pixel-perfect recreation</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}