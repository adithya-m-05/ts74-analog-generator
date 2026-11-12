/**
 * THE PHYSICAL UI — MODEL TS-74 ANALOG GENERATOR & FOCUS TIMER
 * Real-Time Web Audio API Synthesis • Drag Physics • Skeuomorphic Hardware Logic
 * 
 * Strictly Modular Vanilla JavaScript • Zero External Dependencies or Audio Assets
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. Hardware State & Calibration Constants
  // =========================================================================
  const CONFIG = {
    // Potentiometer 1: Focus Timer (5 to 60 Minutes)
    TIMER_MIN_MINUTES: 5,
    TIMER_MAX_MINUTES: 60,
    TIMER_DEFAULT_MINUTES: 25,

    // Potentiometer 2: Noise / Harmonic Blend (0% to 100%)
    NOISE_DEFAULT_BLEND: 50,

    // Potentiometer Mechanical Angles (270° Sweep: -135° to +135°)
    POT_MIN_ANGLE: 0,
    POT_MAX_ANGLE: 270,
    POT_ANGLE_OFFSET: -135, // Visually maps 0° to -135° and 270° to +135°
    TICK_INTERVAL_DEG: 33.75, // 270 / 8 calibrated tick steps

    // Drag Physics Sensitivity (Degrees per vertical pixel movement)
    DRAG_SENSITIVITY: 1.25,
    WHEEL_SENSITIVITY: 0.25,

    // Keyboard Step Sizes
    KEY_FINE_STEP: 5,   // Degrees
    KEY_COARSE_STEP: 20 // Degrees
  };

  const state = {
    isPowered: false,
    
    // Potentiometer Angles (0 to 270 degrees)
    timerAngle: ((CONFIG.TIMER_DEFAULT_MINUTES - CONFIG.TIMER_MIN_MINUTES) / 
                (CONFIG.TIMER_MAX_MINUTES - CONFIG.TIMER_MIN_MINUTES)) * CONFIG.POT_MAX_ANGLE,
    noiseAngle: (CONFIG.NOISE_DEFAULT_BLEND / 100) * CONFIG.POT_MAX_ANGLE,

    // Timer Runtime Tracking
    timerSecondsRemaining: CONFIG.TIMER_DEFAULT_MINUTES * 60,
    timerTotalDurationSeconds: CONFIG.TIMER_DEFAULT_MINUTES * 60,
    lastTickTimestamp: 0,
    timerIntervalId: null,

    // Mechanical Detent Sound Tracker
    lastDetentTimerIndex: -1,
    lastDetentNoiseIndex: -1
  };

  // =========================================================================
  // 2. Real-Time Web Audio API Synthesizer Engine
  // =========================================================================
  class AnalogAudioEngine {
    constructor() {
      this.ctx = null;
      this.isInitialized = false;

      // Master Output Nodes
      this.masterGain = null;
      this.powerFilter = null;

      // 60Hz Transformer Hum Nodes
      this.humOsc60 = null;
      this.humOsc120 = null;
      this.humOsc180 = null;
      this.humGain = null;

      // Procedural Tape Noise Nodes
      this.noiseSource = null;
      this.noiseFilter = null;
      this.noiseGain = null;

      // Noise Buffer (Pre-computed procedural 4s loopable pink/brown buffer)
      this.noiseBuffer = null;
    }

    /**
     * Initializes the AudioContext upon first user interaction to honor browser autoplay policies.
     */
    init() {
      if (this.isInitialized) {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        return;
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('Web Audio API is not supported in this browser.');
        return;
      }

      this.ctx = new AudioContextClass();

      // Master output stage
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);

      // Lowpass output stage simulating analog transformer circuit response
      this.powerFilter = this.ctx.createBiquadFilter();
      this.powerFilter.type = 'lowpass';
      this.powerFilter.frequency.setValueAtTime(4500, this.ctx.currentTime);
      this.powerFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

      this.masterGain.connect(this.powerFilter);
      this.powerFilter.connect(this.ctx.destination);

      // Build Procedural Soundscape Engine
      this._buildTransformerHum();
      this._buildTapeNoise();

      this.isInitialized = true;
    }

    /**
     * Synthesizes 60Hz AC mains power transformer hum with rectified harmonics (120Hz & 180Hz).
     */
    _buildTransformerHum() {
      const now = this.ctx.currentTime;
      this.humGain = this.ctx.createGain();
      this.humGain.gain.setValueAtTime(0.35, now);

      // 60Hz Fundamental Sine
      this.humOsc60 = this.ctx.createOscillator();
      this.humOsc60.type = 'sine';
      this.humOsc60.frequency.setValueAtTime(60.0, now);

      // 120Hz Full-Wave Rectified Harmonic
      this.humOsc120 = this.ctx.createOscillator();
      this.humOsc120.type = 'sine';
      this.humOsc120.frequency.setValueAtTime(120.0, now);
      const gain120 = this.ctx.createGain();
      gain120.gain.setValueAtTime(0.45, now);
      this.humOsc120.connect(gain120);
      gain120.connect(this.humGain);

      // 180Hz Core Saturation Buzz
      this.humOsc180 = this.ctx.createOscillator();
      this.humOsc180.type = 'triangle';
      this.humOsc180.frequency.setValueAtTime(180.0, now);
      const gain180 = this.ctx.createGain();
      gain180.gain.setValueAtTime(0.08, now);
      this.humOsc180.connect(gain180);
      gain180.connect(this.humGain);

      // Connect Fundamental
      this.humOsc60.connect(this.humGain);
      this.humGain.connect(this.masterGain);

      // Start permanent oscillators
      this.humOsc60.start();
      this.humOsc120.start();
      this.humOsc180.start();
    }

    /**
     * Synthesizes continuous procedural pink/brown tape noise using custom AudioBuffer.
     */
    _buildTapeNoise() {
      const bufferSize = this.ctx.sampleRate * 4; // 4-second loop
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = this.noiseBuffer.getChannelData(0);

      // Leaky Brownian / Pink Noise integration math
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        
        // Paul Kellet's refined 1/f noise filter algorithm
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;

        output[i] = pink * 0.07; // Scaled to prevent digital clipping
      }

      this.noiseSource = this.ctx.createBufferSource();
      this.noiseSource.buffer = this.noiseBuffer;
      this.noiseSource.loop = true;

      // Vintage reel-to-reel tape lowpass roll-off filter
      this.noiseFilter = this.ctx.createBiquadFilter();
      this.noiseFilter.type = 'lowpass';
      this.noiseFilter.frequency.setValueAtTime(1800, this.ctx.currentTime);
      this.noiseFilter.Q.setValueAtTime(0.9, this.ctx.currentTime);

      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

      this.noiseSource.connect(this.noiseFilter);
      this.noiseFilter.connect(this.noiseGain);
      this.noiseGain.connect(this.masterGain);

      this.noiseSource.start();
    }

    /**
     * Smoothly transitions the master power state and soundscape gain.
     * @param {boolean} isPowered
     */
    setPower(isPowered) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      if (isPowered) {
        // Power rail ramp-up: smooth 180ms swell
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(0.42, now + 0.18);
      } else {
        // Capacitor discharge decay: pitch drop and fade-out over 320ms
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      }
    }

    /**
     * Crossfades dynamically between the 60Hz transformer hum and tape noise.
     * @param {number} blendRatio - Range [0.0 (Pure Hum) to 1.0 (Pure Noise)]
     */
    setBlend(blendRatio) {
      if (!this.ctx || !this.humGain || !this.noiseGain) return;
      const now = this.ctx.currentTime;

      // Equal-power crossfade math
      const humVol = Math.cos(blendRatio * 0.5 * Math.PI) * 0.45;
      const noiseVol = Math.sin(blendRatio * 0.5 * Math.PI) * 0.55;

      this.humGain.gain.setTargetAtTime(humVol, now, 0.035);
      this.noiseGain.gain.setTargetAtTime(noiseVol, now, 0.035);
    }

    /**
     * Synthesizes a heavy industrial toggle switch dual-transient impact.
     * (80Hz mechanical thud + 1.2kHz metallic snap + secondary spring clatter)
     * @param {boolean} turningOn
     */
    playToggleClunk(turningOn) {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // 1. Transient A: Low Mechanical Cast-Metal Thud (80Hz dropping to 40Hz)
      const thudOsc = this.ctx.createOscillator();
      const thudGain = this.ctx.createGain();
      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(turningOn ? 90 : 80, now);
      thudOsc.frequency.exponentialRampToValueAtTime(35, now + 0.038);

      thudGain.gain.setValueAtTime(0.7, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);

      thudOsc.connect(thudGain);
      thudGain.connect(this.ctx.destination);

      thudOsc.start(now);
      thudOsc.stop(now + 0.045);

      // 2. Transient B: Sharp Metallic Latch Click (1.2kHz - 1.6kHz Bandpass Burst)
      const clickLength = 0.025;
      const clickBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * clickLength), this.ctx.sampleRate);
      const clickData = clickBuffer.getChannelData(0);
      for (let i = 0; i < clickData.length; i++) {
        clickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (clickData.length * 0.25));
      }

      const clickSource = this.ctx.createBufferSource();
      clickSource.buffer = clickBuffer;

      const clickFilter = this.ctx.createBiquadFilter();
      clickFilter.type = 'bandpass';
      clickFilter.frequency.setValueAtTime(turningOn ? 1450 : 1200, now);
      clickFilter.Q.setValueAtTime(7.0, now);

      const clickGain = this.ctx.createGain();
      clickGain.gain.setValueAtTime(0.65, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

      clickSource.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(this.ctx.destination);

      clickSource.start(now);

      // 3. Transient C: Rebound Spring Micro-Tick (14ms delayed contact chatter)
      const reboundOsc = this.ctx.createOscillator();
      const reboundGain = this.ctx.createGain();
      reboundOsc.type = 'sine';
      reboundOsc.frequency.setValueAtTime(2400, now + 0.014);

      reboundGain.gain.setValueAtTime(0, now);
      reboundGain.gain.setValueAtTime(0.3, now + 0.014);
      reboundGain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

      reboundOsc.connect(reboundGain);
      reboundGain.connect(this.ctx.destination);

      reboundOsc.start(now + 0.014);
      reboundOsc.stop(now + 0.03);
    }

    /**
     * Synthesizes a crisp, subtle mechanical detent tick (<8ms duration)
     * triggered when rotary potentiometer passes calibrated tick marks.
     */
    playDetentClick() {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const tickLen = 0.007; // 7 milliseconds
      const tickBuffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * tickLen), this.ctx.sampleRate);
      const data = tickBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        // High-frequency damped acoustic impulse
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.2));
      }

      const source = this.ctx.createBufferSource();
      source.buffer = tickBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2800, now);
      filter.Q.setValueAtTime(4.0, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + tickLen);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      source.start(now);
    }

    /**
     * Synthesizes an electrical cutoff spark & relay pop when timer expires.
     */
    playCutoffPop() {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // High voltage spark arc burst
      const popOsc = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      popOsc.type = 'sawtooth';
      popOsc.frequency.setValueAtTime(420, now);
      popOsc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

      popGain.gain.setValueAtTime(0.85, now);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      popOsc.connect(popGain);
      popGain.connect(this.ctx.destination);

      popOsc.start(now);
      popOsc.stop(now + 0.1);
    }
  }

  const audio = new AnalogAudioEngine();

  // =========================================================================
  // 3. DOM Elements Cache
  // =========================================================================
  const DOM = {
    chassis: document.getElementById('instrument-chassis'),
    powerSwitch: document.getElementById('power-switch'),
    indicatorLamp: document.getElementById('indicator-lamp'),
    
    // Nixie Tube Readout
    tubeMinTens: document.getElementById('tube-min-tens'),
    tubeMinOnes: document.getElementById('tube-min-ones'),
    tubeSecTens: document.getElementById('tube-sec-tens'),
    tubeSecOnes: document.getElementById('tube-sec-ones'),
    nixieDisplay: document.getElementById('nixie-display'),

    // Rotary Potentiometers
    timerKnob: document.getElementById('timer-knob'),
    noiseKnob: document.getElementById('noise-knob')
  };

  // Cache glyph span references inside Nixie tubes for fast updates
  DOM.glyphMinTens = DOM.tubeMinTens.querySelector('.nixie-glyph');
  DOM.glyphMinOnes = DOM.tubeMinOnes.querySelector('.nixie-glyph');
  DOM.glyphSecTens = DOM.tubeSecTens.querySelector('.nixie-glyph');
  DOM.glyphSecOnes = DOM.tubeSecOnes.querySelector('.nixie-glyph');

  DOM.timerCap = DOM.timerKnob.querySelector('.knob-cap');
  DOM.noiseCap = DOM.noiseKnob.querySelector('.knob-cap');

  // =========================================================================
  // 4. Nixie Readout & Timer Engine
  // =========================================================================
  /**
   * Formats total seconds into MM:SS and updates the Nixie tube display.
   * @param {number} totalSeconds
   */
  function updateNixieDisplay(totalSeconds) {
    const clampedSecs = Math.max(0, Math.floor(totalSeconds));
    const mins = Math.floor(clampedSecs / 60);
    const secs = clampedSecs % 60;

    const minStr = String(mins).padStart(2, '0');
    const secStr = String(secs).padStart(2, '0');

    DOM.glyphMinTens.textContent = minStr[0];
    DOM.glyphMinOnes.textContent = minStr[1];
    DOM.glyphSecTens.textContent = secStr[0];
    DOM.glyphSecOnes.textContent = secStr[1];

    DOM.tubeMinTens.dataset.digit = minStr[0];
    DOM.tubeMinOnes.dataset.digit = minStr[1];
    DOM.tubeSecTens.dataset.digit = secStr[0];
    DOM.tubeSecOnes.dataset.digit = secStr[1];
  }

  /**
   * Starts high-precision countdown interval.
   */
  function startTimer() {
    stopTimer();
    state.lastTickTimestamp = performance.now();

    state.timerIntervalId = setInterval(() => {
      if (!state.isPowered) {
        stopTimer();
        return;
      }

      const currentNow = performance.now();
      const elapsedSeconds = (currentNow - state.lastTickTimestamp) / 1000;
      state.lastTickTimestamp = currentNow;

      state.timerSecondsRemaining -= elapsedSeconds;

      if (state.timerSecondsRemaining <= 0) {
        state.timerSecondsRemaining = 0;
        updateNixieDisplay(0);
        handleTimerExpiration();
      } else {
        updateNixieDisplay(state.timerSecondsRemaining);
      }
    }, 200);
  }

  /**
   * Pauses or stops countdown interval.
   */
  function stopTimer() {
    if (state.timerIntervalId) {
      clearInterval(state.timerIntervalId);
      state.timerIntervalId = null;
    }
  }

  /**
   * Handles timer completion: sounds cutoff pop and shuts down generator.
   */
  function handleTimerExpiration() {
    stopTimer();
    audio.playCutoffPop();
    setMachinePower(false);
  }

  // =========================================================================
  // 5. Hardware Controls Logic
  // =========================================================================

  /**
   * Sets the Master Power state, synchronizes UI, and audio engine.
   * @param {boolean} isPowered
   */
  function setMachinePower(isPowered) {
    if (state.isPowered === isPowered) return;
    state.isPowered = isPowered;

    // Audio toggle clunk
    audio.playToggleClunk(isPowered);
    audio.setPower(isPowered);

    // Update ARIA & Classes
    DOM.powerSwitch.setAttribute('aria-checked', String(isPowered));
    DOM.indicatorLamp.setAttribute('aria-label', `Main Power Indicator: ${isPowered ? 'Active' : 'Off'}`);

    if (isPowered) {
      DOM.chassis.classList.add('is-powered');
      DOM.indicatorLamp.classList.add('is-lit');
      // Sync soundscape blend parameter
      const blend = state.noiseAngle / CONFIG.POT_MAX_ANGLE;
      audio.setBlend(blend);
      startTimer();
    } else {
      DOM.chassis.classList.remove('is-powered');
      DOM.indicatorLamp.classList.remove('is-lit');
      stopTimer();
    }
  }

  /**
   * Converts Timer Potentiometer angle to minutes.
   * @param {number} angle - [0 to 270]
   * @returns {number} minutes
   */
  function angleToMinutes(angle) {
    const fraction = angle / CONFIG.POT_MAX_ANGLE;
    const mins = CONFIG.TIMER_MIN_MINUTES + fraction * (CONFIG.TIMER_MAX_MINUTES - CONFIG.TIMER_MIN_MINUTES);
    return Math.round(mins);
  }

  /**
   * Updates Timer Knob angle, ARIA slider attributes, and Nixie preview.
   * @param {number} newAngle
   */
  function setTimerAngle(newAngle) {
    const clamped = Math.max(CONFIG.POT_MIN_ANGLE, Math.min(CONFIG.POT_MAX_ANGLE, newAngle));
    state.timerAngle = clamped;

    // Check for mechanical detent click
    const tickIndex = Math.round(clamped / CONFIG.TICK_INTERVAL_DEG);
    if (tickIndex !== state.lastDetentTimerIndex) {
      state.lastDetentTimerIndex = tickIndex;
      audio.playDetentClick();
    }

    // Visual rotation (-135° to +135°)
    const visualRotation = clamped + CONFIG.POT_ANGLE_OFFSET;
    DOM.timerCap.style.transform = `rotate(${visualRotation}deg)`;

    // Calculate duration in minutes
    const minutes = angleToMinutes(clamped);
    state.timerTotalDurationSeconds = minutes * 60;

    // When off or resetting, update remaining seconds directly
    if (!state.isPowered) {
      state.timerSecondsRemaining = state.timerTotalDurationSeconds;
      updateNixieDisplay(state.timerSecondsRemaining);
    } else {
      // If machine is running, dynamically update remaining seconds
      state.timerSecondsRemaining = Math.min(state.timerSecondsRemaining, state.timerTotalDurationSeconds);
      updateNixieDisplay(state.timerSecondsRemaining);
    }

    DOM.timerKnob.setAttribute('aria-valuenow', String(minutes));
    DOM.timerKnob.setAttribute('aria-valuetext', `${minutes} Minutes Focus Session`);
  }

  /**
   * Updates Noise Blend Knob angle, ARIA slider attributes, and synthesizer balance.
   * @param {number} newAngle
   */
  function setNoiseAngle(newAngle) {
    const clamped = Math.max(CONFIG.POT_MIN_ANGLE, Math.min(CONFIG.POT_MAX_ANGLE, newAngle));
    state.noiseAngle = clamped;

    // Check for mechanical detent click
    const tickIndex = Math.round(clamped / CONFIG.TICK_INTERVAL_DEG);
    if (tickIndex !== state.lastDetentNoiseIndex) {
      state.lastDetentNoiseIndex = tickIndex;
      audio.playDetentClick();
    }

    // Visual rotation (-135° to +135°)
    const visualRotation = clamped + CONFIG.POT_ANGLE_OFFSET;
    DOM.noiseCap.style.transform = `rotate(${visualRotation}deg)`;

    const blendPercent = Math.round((clamped / CONFIG.POT_MAX_ANGLE) * 100);
    const blendRatio = clamped / CONFIG.POT_MAX_ANGLE;

    // Pass to Web Audio synthesizer
    audio.setBlend(blendRatio);

    DOM.noiseKnob.setAttribute('aria-valuenow', String(blendPercent));
    DOM.noiseKnob.setAttribute('aria-valuetext', `${blendPercent}% Blend: ${
      blendPercent < 30 ? 'Transformer Hum Dominant' :
      blendPercent > 70 ? 'Tape Noise Dominant' : 'Balanced Drone'
    }`);
  }

  // =========================================================================
  // 6. Knob Drag Physics & Interaction Binding
  // =========================================================================
  /**
   * Attaches pointer drag, mouse wheel, and keyboard listeners to a potentiometer knob.
   * @param {HTMLElement} knobEl
   * @param {Function} getAngleFn
   * @param {Function} setAngleFn
   */
  function bindKnobPhysics(knobEl, getAngleFn, setAngleFn) {
    let isDragging = false;
    let startY = 0;
    let startAngle = 0;

    // 1. Pointer Down (Initiates drag & captures pointer)
    knobEl.addEventListener('pointerdown', (e) => {
      audio.init();
      isDragging = true;
      startY = e.clientY;
      startAngle = getAngleFn();
      knobEl.setPointerCapture(e.pointerId);
      knobEl.focus();
      e.preventDefault();
    });

    // 2. Pointer Move (Calculates deltaY for vertical drag physics)
    knobEl.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const deltaY = startY - e.clientY; // Dragging UP increases value
      const targetAngle = startAngle + deltaY * CONFIG.DRAG_SENSITIVITY;
      setAngleFn(targetAngle);
    });

    // 3. Pointer Up / Cancel
    const endDrag = (e) => {
      if (isDragging) {
        isDragging = false;
        try {
          knobEl.releasePointerCapture(e.pointerId);
        } catch (_) {
          // Fallback if pointer capture was already lost
        }
      }
    };
    knobEl.addEventListener('pointerup', endDrag);
    knobEl.addEventListener('pointercancel', endDrag);

    // 4. Mouse Wheel Rotation
    knobEl.addEventListener('wheel', (e) => {
      audio.init();
      e.preventDefault();
      const current = getAngleFn();
      // Scrolling UP (deltaY < 0) increases value
      const step = e.deltaY < 0 ? CONFIG.KEY_FINE_STEP : -CONFIG.KEY_FINE_STEP;
      setAngleFn(current + step);
    }, { passive: false });

    // 5. Accessible Keyboard Navigation
    knobEl.addEventListener('keydown', (e) => {
      audio.init();
      const current = getAngleFn();
      let handled = false;

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          setAngleFn(current + CONFIG.KEY_FINE_STEP);
          handled = true;
          break;
        case 'ArrowDown':
        case 'ArrowLeft':
          setAngleFn(current - CONFIG.KEY_FINE_STEP);
          handled = true;
          break;
        case 'PageUp':
          setAngleFn(current + CONFIG.KEY_COARSE_STEP);
          handled = true;
          break;
        case 'PageDown':
          setAngleFn(current - CONFIG.KEY_COARSE_STEP);
          handled = true;
          break;
        case 'Home':
          setAngleFn(CONFIG.POT_MIN_ANGLE);
          handled = true;
          break;
        case 'End':
          setAngleFn(CONFIG.POT_MAX_ANGLE);
          handled = true;
          break;
      }

      if (handled) {
        e.preventDefault();
      }
    });
  }

  // =========================================================================
  // 7. Event Listeners & Hardware Scaffolding
  // =========================================================================

  // Power Assembly & Switch Click Handler
  const toggleAssembly = document.querySelector('.toggle-assembly');
  if (toggleAssembly) {
    toggleAssembly.addEventListener('click', (e) => {
      if (e.target !== DOM.powerSwitch && !DOM.powerSwitch.contains(e.target)) {
        audio.init();
        setMachinePower(!state.isPowered);
      }
    });
  }

  DOM.powerSwitch.addEventListener('click', () => {
    audio.init();
    setMachinePower(!state.isPowered);
  });

  DOM.powerSwitch.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      audio.init();
      setMachinePower(!state.isPowered);
    }
  });

  // Global Keyboard Shortcuts (Space / Enter toggles power when not focused on other controls)
  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && document.activeElement === document.body) {
      e.preventDefault();
      audio.init();
      setMachinePower(!state.isPowered);
    }
  });

  // First User Interaction Autoplay Unlock (Click or Keydown anywhere)
  const unlockAudio = () => {
    audio.init();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  // Bind Physics to Potentiometers
  bindKnobPhysics(
    DOM.timerKnob,
    () => state.timerAngle,
    (angle) => setTimerAngle(angle)
  );

  bindKnobPhysics(
    DOM.noiseKnob,
    () => state.noiseAngle,
    (angle) => setNoiseAngle(angle)
  );

  // =========================================================================
  // 8. Machine Calibration Initializer
  // =========================================================================
  function initMachine() {
    // Calibrate Knobs to initial positions
    setTimerAngle(state.timerAngle);
    setNoiseAngle(state.noiseAngle);

    // Initial Nixie Display (Default 25:00)
    updateNixieDisplay(state.timerSecondsRemaining);

    // Initial ARIA States
    DOM.powerSwitch.setAttribute('aria-checked', 'false');
    DOM.indicatorLamp.setAttribute('aria-label', 'Main Power Indicator: Off');
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMachine);
  } else {
    initMachine();
  }

})();
