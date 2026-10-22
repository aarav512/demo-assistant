export type VoiceResources = {
  tracks: Array<{ stop: () => void }>;
  dataChannel: { close: () => void } | null;
  peer: { close: () => void } | null;
  clearAudio: () => void;
  stopMeter?: () => void;
};

export function releaseVoiceSession(resources: VoiceResources): void {
  for (const track of resources.tracks) {
    try {
      track.stop();
    } catch {
      // The track may already have been stopped by the browser.
    }
  }
  try {
    resources.dataChannel?.close();
  } catch {
    // Closing a channel that is already closed is safe to ignore.
  }
  try {
    resources.peer?.close();
  } catch {
    // The peer connection may already be closed.
  }
  try {
    resources.clearAudio();
  } catch {
    // Audio cleanup should not block the rest of the teardown.
  }
  try {
    resources.stopMeter?.();
  } catch {
    // The meter is optional.
  }
}
