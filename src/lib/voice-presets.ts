export type CharacterPreset = {
  id: string;
  label: string;
  description: string;
};

export const CHARACTER_PRESETS: CharacterPreset[] = [
  { id: "anime-girl", label: "Anime Girl", description: "Bright, high-pitched, expressive." },
  { id: "deep-villain", label: "Deep Villain", description: "Low, gravelly, menacing." },
  { id: "robotic", label: "Robotic", description: "Flat, vocoded, synthetic timbre." },
  { id: "child", label: "Child", description: "Small, youthful resonance." },
  { id: "elderly", label: "Elderly", description: "Soft, breathy, slower cadence." },
  { id: "narrator", label: "Movie Narrator", description: "Warm, theatrical baritone." },
  { id: "newscaster", label: "Newscaster", description: "Crisp, neutral, broadcast-ready." },
  { id: "custom", label: "Custom / None", description: "Free-form — train purely from samples." },
];

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "ru", label: "Russian" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
];
