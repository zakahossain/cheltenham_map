// app.jsx — Act I host

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "duration": 22,
  "peakCount": 36,
  "pattern": "scatter",
  "tone": "sepia",
  "showCounter": true,
  "stopMotion": true,
  "fps": 16
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  return (
    <>
      <Stage
        width={1920}
        height={1080}
        duration={t.duration}
        background="#050302"
        loop={true}
        autoplay={true}
        persistKey="cheltenham-act1-v2"
      >
        <CertificatesScene tweaks={t} />
      </Stage>

      <TweaksPanel title="Act I — Tweaks">
        <TweakSection label="Timing">
          <TweakSlider label="Duration" value={t.duration} min={10} max={60} step={1} unit="s"
                       onChange={(v) => setTweak('duration', v)} />
          <TweakSlider label="Peak count" value={t.peakCount} min={6} max={40} step={1}
                       onChange={(v) => setTweak('peakCount', v)} />
        </TweakSection>

        <TweakSection label="Layout">
          <TweakRadio label="Pattern" value={t.pattern}
                      options={['scatter', 'pile', 'grid']}
                      onChange={(v) => setTweak('pattern', v)} />
        </TweakSection>

        <TweakSection label="Tone">
          <TweakRadio label="Background" value={t.tone}
                      options={[
                        { value: 'sepia', label: 'Sepia' },
                        { value: 'cool', label: 'Cool' },
                        { value: 'mono', label: 'Mono' },
                      ]}
                      onChange={(v) => setTweak('tone', v)} />
        </TweakSection>

        <TweakSection label="Motion">
          <TweakToggle label="Stop-motion (VOX)" value={t.stopMotion}
                       onChange={(v) => setTweak('stopMotion', v)} />
          <TweakSlider label="FPS" value={t.fps} min={6} max={24} step={1}
                       onChange={(v) => setTweak('fps', v)} />
        </TweakSection>

        <TweakSection label="Display">
          <TweakToggle label="Counter" value={t.showCounter}
                       onChange={(v) => setTweak('showCounter', v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
