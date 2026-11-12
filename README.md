# The Physical UI — Model TS-74

The Physical UI is a self-contained, retro laboratory instrument interface built as an interactive focus timer. The page recreates a 1970s analog signal generator with a dark metal chassis, illuminated Nixie-style countdown display, a power switch, and tactile rotary controls.

When powered on, the timer counts down and the browser synthesizes a layered soundscape from transformer hum and filtered tape noise. The controls, indicator lamp, display, and sound respond together to give the interface the feel of physical hardware.

## Features

- Focus countdown adjustable from **5 to 60 minutes** (default: 25 minutes).
- Procedural audio generated with the **Web Audio API**; no external audio files or libraries.
- Adjustable balance between simulated 60 Hz transformer hum and tape noise.
- Synthesized switch clunks, knob detents, and a timer-completion pop.
- Responsive layout for desktop and smaller screens.
- Keyboard-accessible switch and sliders, with ARIA state and value text.

## Run locally

There is no build step, package manager, or server-side component. Open `index.html` in a modern browser, or serve the project directory with any static file server. The page loads `style.css` and `app.js` from the same directory.

Audio starts after a user interaction, as required by browser autoplay policies. Use a browser with Web Audio API support for the synthesized sound; the visual timer interface can still be used if audio is unavailable.

## Controls

| Control | Mouse / touch | Keyboard |
| --- | --- | --- |
| Main power | Click the toggle assembly | **Space** or **Enter** while the switch or page body is focused |
| Focus duration | Drag vertically or use the mouse wheel | **Up/Right** to increase, **Down/Left** to decrease; **Page Up/Down** for larger changes; **Home/End** for min/max |
| Noise blend | Drag vertically or use the mouse wheel | Same slider keys as above |

Dragging a knob upward or scrolling up increases its value. The timer knob selects the session duration. The noise knob moves from transformer hum at 0% to tape noise at 100%, with a balanced blend around 50%.

Turning power off pauses the countdown while retaining the remaining time. Turning power back on resumes it. Adjusting the duration while powered off resets the displayed countdown to the selected duration; adjusting it during a session can shorten the remaining time.

## Project files

- `index.html` — instrument markup, labels, and accessible controls.
- `style.css` — chassis appearance, simulated hardware details, powered states, and responsive layout.
- `app.js` — timer state, knob interaction, accessibility updates, and procedural audio synthesis.

## Browser notes

The app uses pointer events for dragging and `AudioContext` (or `webkitAudioContext`) for sound. Audio initialization is deferred until user interaction. There are no external dependencies, network requests, or audio assets.
