import type { Session } from '@/types';

/**
 * Generate a shareable link for a session
 * Encodes complete session data in the URL for full analysis
 */
export const generateShareableLink = (session: Session): string => {
  try {
    // Include complete session data including all matches for full analysis
    const shareData = {
      sessionName: session.sessionName,
      sessionDuration: session.sessionDuration,
      matchType: session.matchType,
      selectedFeature: session.selectedFeature,
      notes: session.notes || '',
      matches: session.matches.map(match => ({
        id: match.id,
        matchNumber: match.matchNumber,
        matchType: match.matchType,
        finalScore: match.finalScore,
        autonomousScore: match.autonomousScore,
        teleopScore: match.teleopScore,
        endGameScore: match.endGameScore,
        autonClassifiedArtifact: match.autonClassifiedArtifact,
        autonOverflowArtifact: match.autonOverflowArtifact,
        autonMotif: match.autonMotif,
        autonLeave: match.autonLeave,
        autonBallsMissed: match.autonBallsMissed,
        teleClassifiedArtifact: match.teleClassifiedArtifact,
        teleOverflowArtifact: match.teleOverflowArtifact,
        teleMotif: match.teleMotif,
        teleBallsMissed: match.teleBallsMissed,
        robot1Park: match.robot1Park,
        robot2Park: match.robot2Park,
        cycleTimes: match.cycleTimes,
        autonShots: match.autonShots,
        teleopShots: match.teleopShots,
      })),
    };

    // Encode the data to base64
    const encodedData = btoa(JSON.stringify(shareData));
    
    // Generate the full URL
    const baseUrl = window.location.origin;
    return `${baseUrl}/shared/preview?data=${encodedData}`;
  } catch (error) {
    console.error('Error generating shareable link:', error);
    throw new Error('Failed to generate shareable link');
  }
};

/**
 * Copy text to clipboard with fallback for older browsers
 */
export const copyToClipboard = async (text: string): Promise<void> => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      textArea.remove();
    } catch (error) {
      textArea.remove();
      throw new Error('Failed to copy to clipboard');
    }
  }
};
