# Flyverax explainer v1.1: v1 with placeholder audio

Adds narration, a music bed and sound effects to the v1 explainer
(`../marketing-mockups/exports/mp4/flyverax-explainer-{16x9,9x16}.mp4`, which are not changed).

**All audio here is a placeholder, generated locally:** the narration is the built-in Windows
voice (Microsoft Zira), the music is a pad synthesised with ffmpeg, and the whoosh/ping are
synthesised too. Replace the narration with a recorded voiceover and the music with a licensed
track before publishing (the v2 project in `../explainer-v2/` is built to take real recordings).

```sh
node make.mjs   # needs ../explainer-v2 installed (npm install there): it reuses its mixer and ffmpeg
```

Output: `exports/flyverax-explainer-v1.1-placeholder-audio-{16x9,9x16}.mp4`, -14 LUFS.

- Narration lines and timings: `lines.mjs` (a line that runs long is sped up, at most 1.3x).
- Voice and speed: `tts.ps1` (`-Voice "Microsoft David Desktop"` for the male voice).
- Mix levels (music under the voice and ducked, effects, fades, loudness): `../explainer-v2/config.mjs` (`AUDIO`).
