import * as Slider from "@radix-ui/react-slider";

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style_exaggeration: number;
  speed: number;
}

interface VoiceSettingsSlidersProps {
  settings: VoiceSettings;
  onChange: (key: keyof VoiceSettings, value: number) => void;
  onPreview?: () => void;
}

const SLIDERS: {
  key: keyof VoiceSettings;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
}[] = [
  {
    key: "stability",
    label: "Stability",
    description: "Higher = more consistent. Lower = more expressive.",
    min: 0, max: 1, step: 0.01,
  },
  {
    key: "similarity_boost",
    label: "Clarity and similarity",
    description: "How closely the output matches the original voice.",
    min: 0, max: 1, step: 0.01,
  },
  {
    key: "style_exaggeration",
    label: "Style exaggeration",
    description: "Amplifies the speaking style. May reduce stability.",
    min: 0, max: 1, step: 0.01,
  },
  {
    key: "speed",
    label: "Speed",
    description: "Speaking pace.",
    min: 0.5, max: 2, step: 0.1,
  },
];

export function VoiceSettingsSliders({
  settings,
  onChange,
  onPreview,
}: VoiceSettingsSlidersProps) {
  return (
    <div className="flex flex-col gap-5">
      {SLIDERS.map(({ key, label, description, min, max, step }) => (
        <div key={key} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{label}</span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {settings[key].toFixed(key === "speed" ? 1 : 2)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
          <Slider.Root
            min={min}
            max={max}
            step={step}
            value={[settings[key]]}
            onValueChange={([val]) => onChange(key, val)}
            onValueCommit={onPreview}
            className="relative flex items-center select-none touch-none w-full h-5"
          >
            <Slider.Track className="bg-secondary relative grow rounded-full h-1">
              <Slider.Range className="absolute bg-primary rounded-full h-full" />
            </Slider.Track>
            <Slider.Thumb
              className="block w-4 h-4 bg-background border-2 border-primary rounded-full shadow focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label={label}
            />
          </Slider.Root>
        </div>
      ))}
    </div>
  );
}
