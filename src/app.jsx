// ============================================================================
// app.jsx — Act I host
// Mounts the CertificatesScene inside a scroll-driven Stage. The Stage's
// playhead is mapped to the user's scroll position through the #act-i
// section (defined in index.html). No autoplay, no playback bar.
// ============================================================================

const TWEAKS = {
  duration: 22,       // virtual seconds — phase boundaries derive from this
  peakCount: 36,      // total falling cards (cap 40)
  pattern: "scatter", // 'scatter' | 'pile' | 'grid'
  tone: "sepia",
  showCounter: false,
  stopMotion: true,
  fps: 16,
};

function App() {
  return (
    <Stage
      width={1920}
      height={1080}
      duration={TWEAKS.duration}
      background="#050302"
      autoplay={false}
      loop={false}
      hidePlaybackBar={true}
      scrollSection="act-i"
      persistKey="cheltenham-act1-v3"
    >
      <CertificatesScene tweaks={TWEAKS} />
    </Stage>
  );
}

const root = ReactDOM.createRoot(document.getElementById("act-i-root"));
root.render(<App />);
