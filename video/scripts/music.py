"""Banda sonora original do vídeo, sintetizada de raiz (sem amostras nem música de terceiros).

100 BPM, a mesma grelha das cenas (src/timeline.ts): cada cena tem a sua secção. Saída: public/audio/music.wav (44,1 kHz, estéreo).
Corre com: python scripts/music.py  (precisa de numpy e scipy)
"""

import re
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
BPM = 100
BEAT = 60 / BPM
BAR = BEAT * 4
ROOT = Path(__file__).resolve().parents[1]
rng = np.random.default_rng(7)

scenes = [(m[0], int(m[1])) for m in re.findall(r"id: '(\w+)', bars: (\d+)", (ROOT / "src/timeline.ts").read_text())]
start_bar = {}
acc = 0
for sid, bars in scenes:
    start_bar[sid] = acc
    acc += bars
TOTAL_BARS = acc
TAIL_S = 48 / 30
N = int((TOTAL_BARS * BAR + TAIL_S) * SR) + SR
L = np.zeros(N)
R = np.zeros(N)


def hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig: np.ndarray, t: float, gain: float = 1.0, pan: float = 0.0) -> None:
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    L[i : i + len(sig)] += sig * gain * np.sqrt(0.5 * (1 - pan))
    R[i : i + len(sig)] += sig * gain * np.sqrt(0.5 * (1 + pan))


def pluck(m: float, dur: float = 1.6, bright: float = 1.0) -> np.ndarray:
    t = np.arange(int(dur * SR)) / SR
    f = hz(m)
    out = np.zeros_like(t)
    for k in range(1, 9):
        if f * k > 9000:
            break
        out += (1 / k**1.3) * np.sin(2 * np.pi * f * k * t + k) * np.exp(-t * (2.2 + k * 1.6 / bright))
    att = np.minimum(1, t / 0.004)
    return out * att * 0.5


def bell(m: float, dur: float = 2.5) -> np.ndarray:
    t = np.arange(int(dur * SR)) / SR
    f = hz(m)
    out = np.sin(2 * np.pi * f * t) * np.exp(-t * 1.6) + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3.5) + 0.15 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 6)
    return out * np.minimum(1, t / 0.003) * 0.4


def pad(notes: list[int], dur: float, attack: float = 0.9, release: float = 1.2) -> np.ndarray:
    n = int((dur + release) * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        for det in (-0.07, 0.0, 0.07):
            f = hz(m + det)
            ph = rng.uniform(0, 2 * np.pi)
            for k in range(1, 7):
                if f * k > 3500:
                    break
                out += (1 / k**1.7) * np.sin(2 * np.pi * f * k * t + ph * k)
    env = np.minimum(1, t / attack) * np.where(t > dur, np.exp(-(t - dur) / (release / 3)), 1.0)
    return out * env / (len(notes) * 3) * 0.9


def bass(m: int, dur: float) -> np.ndarray:
    t = np.arange(int(dur * SR)) / SR
    f = hz(m)
    out = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    env = np.minimum(1, t / 0.01) * np.exp(-t * 2.2)
    return out * env * 0.55


def kick() -> np.ndarray:
    t = np.arange(int(0.45 * SR)) / SR
    f = 46 + 90 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9) * 0.9


HP = butter(2, 7000, "highpass", fs=SR, output="sos")


def hat(dur: float = 0.06) -> np.ndarray:
    t = np.arange(int(dur * SR)) / SR
    return sosfilt(HP, rng.standard_normal(len(t))) * np.exp(-t * 70) * 0.18


def riser(dur: float) -> np.ndarray:
    n = int(dur * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    chunk = 2048
    for i in range(0, n, chunk):
        fc = 300 + 6000 * (i / n) ** 2
        sos = butter(2, [fc * 0.7, fc * 1.3], "bandpass", fs=SR, output="sos")
        out[i : i + chunk] = sosfilt(sos, x[i : i + chunk])
    return out * np.linspace(0, 1, n) ** 2 * 0.5


# Acordes: Si menor (problema) → Ré maior (resposta). (graves MIDI, notas do pad)
Bm = (35, [62, 66, 71, 73])
G = (31, [59, 62, 67, 71])
D = (38, [62, 66, 69, 74])
A = (33, [61, 64, 69, 73])
Em = (40, [59, 64, 67, 71])
PROBLEM = [Bm, G, D, A]
ANSWER = [D, A, Bm, G]


def bar_t(b: float) -> float:
    return b * BAR


def chord_at(prog: list, b: int):
    return prog[b % len(prog)]


def arp(chord, b: int, density: int = 8, gain: float = 0.22, octave: int = 12, pan_swing: float = 0.35) -> None:
    _, notes = chord
    pattern = [0, 2, 3, 1, 2, 3, 1, 2]
    for i in range(density):
        step = BAR / density
        m = notes[pattern[i % len(pattern)] % len(notes)] + octave
        add(pluck(m, 1.4), bar_t(b) + i * step, gain * (1.0 if i % 2 == 0 else 0.75), pan=pan_swing * (1 if i % 2 else -1))


def groove(b: int, kick_on=True, hats=True, bass_on=True, chord=None) -> None:
    for beat in range(4):
        t = bar_t(b) + beat * BEAT
        if kick_on and beat in (0, 2):
            add(kick(), t, 0.55)
        if hats:
            add(hat(), t + BEAT / 2, 0.5, pan=0.25)
            if beat in (1, 3):
                add(hat(0.09), t, 0.3, pan=-0.2)
        if bass_on and chord is not None:
            add(bass(chord[0] + 12, BEAT * 0.95), t, 0.5)
            add(bass(chord[0] + 12, BEAT * 0.45), t + BEAT / 2, 0.28)


def section(sid: str) -> range:
    s = start_bar[sid]
    n = dict(scenes)[sid]
    return range(s, s + n)


# 1-2. Abertura e contador: pad grave em Si menor, um pulso que cresce.
for b in list(section("open")) + list(section("counter")):
    c = Bm if b % 2 == 0 else G
    add(pad(c[1], BAR), bar_t(b), 0.5)
    add(bass(c[0], BAR * 0.9), bar_t(b), 0.35)
    if b >= start_bar["counter"]:
        for beat in range(4):
            add(pluck(c[1][0] + 12, 0.9, 0.6), bar_t(b) + beat * BEAT, 0.16, pan=-0.2)
add(bell(78), bar_t(start_bar["counter"]), 0.25)

# 3-5. Problema e lei: progressão Si menor com arpejo; batida leve na lei.
for sid in ("waffle", "destination", "law"):
    for b in section(sid):
        c = chord_at(PROBLEM, b - start_bar["waffle"])
        add(pad(c[1], BAR), bar_t(b), 0.42)
        arp(c, b, 8, 0.17)
        add(bass(c[0] + 12, BAR * 0.9), bar_t(b), 0.3)
        if sid == "law":
            groove(b, kick_on=True, hats=False, bass_on=False)

# 6. Mapa: tensão em Mi menor/Si menor, arpejo em semicolcheias, subida para o corte.
for b in section("map"):
    c = Em if (b - start_bar["map"]) % 2 == 0 else Bm
    add(pad(c[1], BAR), bar_t(b), 0.45)
    arp(c, b, 16, 0.12)
    groove(b, kick_on=True, hats=True, bass_on=True, chord=c)
add(riser(BAR * 1.0), bar_t(start_bar["pivot"] - 1), 0.45)

# 7. Viragem: dois compassos quase em silêncio (contentores não; camião do lixo também não), depois a resposta abre.
p0 = start_bar["pivot"]
add(pad([59, 62, 66], BAR * 1.2, attack=0.3), bar_t(p0), 0.35)
add(bell(71), bar_t(p0) + BEAT * 2, 0.22)
add(pad([59, 64, 67], BAR * 1.2, attack=0.3), bar_t(p0 + 1), 0.35)
add(bell(69), bar_t(p0 + 1) + BEAT * 2, 0.22)
for i, b in enumerate(range(p0 + 2, p0 + 4)):
    c = [G, A][i]
    add(pad(c[1], BAR), bar_t(b), 0.5)
    arp(c, b, 8, 0.18)
    add(bass(c[0] + 12, BAR * 0.9), bar_t(b), 0.35)
add(riser(BAR * 0.5), bar_t(p0 + 3.5), 0.35)

# 8-11. Rede, resultados, produto e critérios: groove completo em Ré maior (I-V-vi-IV); melodia de sino no produto.
MELODY = [[78, None, 76, 74], [73, None, 76, None], [74, None, 71, 73], [74, None, None, None]]
for sid in ("network", "results", "montage", "criteria"):
    for b in section(sid):
        k = b - start_bar["network"]
        c = chord_at(ANSWER, k)
        add(pad(c[1], BAR), bar_t(b), 0.38)
        arp(c, b, 16 if sid in ("montage", "criteria") else 8, 0.12 if sid in ("montage", "criteria") else 0.16)
        groove(b, kick_on=True, hats=sid != "network" or k > 1, bass_on=True, chord=c)
        if sid == "montage":
            for i, m in enumerate(MELODY[(b - start_bar["montage"]) % 4]):
                if m:
                    add(bell(m + 12), bar_t(b) + i * BEAT, 0.14, pan=0.3)
add(bell(86), bar_t(start_bar["results"]), 0.2)

# 12. Rigor: respiração, só pad e arpejo.
for b in section("rigor"):
    c = chord_at([Bm, G], b)
    add(pad(c[1], BAR), bar_t(b), 0.45)
    arp(c, b, 8, 0.15)

# 13. Fecho: Ré maior, acorde final longo.
cl = start_bar["close"]
for i, b in enumerate(section("close")):
    c = [G, A, D, D][i] if i < 4 else D
    if i < 3:
        add(pad(c[1], BAR), bar_t(b), 0.45)
        arp(c, b, 8, 0.15)
        add(bass(c[0] + 12, BAR * 0.9), bar_t(b), 0.35)
        groove(b, kick_on=i < 2, hats=False, bass_on=False)
final_t = bar_t(cl + 2) + BAR * 0.0
add(pad([50, 57, 62, 66, 69, 74], BAR * 2.2, attack=0.4, release=2.5), final_t, 0.6)
add(bass(26, BAR * 2), final_t, 0.5)
for i, m in enumerate([74, 78, 81, 86]):
    add(bell(m, 4.0), final_t + i * BEAT / 2, 0.18, pan=(i - 1.5) * 0.2)

# Reverberação: resposta de impulso sintética (ruído com decaimento exponencial, filtrado).
ir_len = int(2.4 * SR)
ti = np.arange(ir_len) / SR
lp = butter(1, 5000, "lowpass", fs=SR, output="sos")
irL = sosfilt(lp, rng.standard_normal(ir_len)) * np.exp(-ti * 2.6)
irR = sosfilt(lp, rng.standard_normal(ir_len)) * np.exp(-ti * 2.6)
irL /= np.sqrt(np.sum(irL**2))
irR /= np.sqrt(np.sum(irR**2))
wetL = fftconvolve(L, irL)[:N]
wetR = fftconvolve(R, irR)[:N]
outL = L + 0.32 * wetL
outR = R + 0.32 * wetR

# Grave limpo, master suave.
hp = butter(2, 28, "highpass", fs=SR, output="sos")
outL = sosfilt(hp, outL)
outR = sosfilt(hp, outR)
end = int((TOTAL_BARS * BAR + TAIL_S) * SR)
fade = int(1.2 * SR)
outL = outL[:end]
outR = outR[:end]
outL[-fade:] *= np.linspace(1, 0, fade) ** 2
outR[-fade:] *= np.linspace(1, 0, fade) ** 2
rms = np.sqrt(np.mean(np.concatenate([outL, outR]) ** 2))
g = 0.1 / rms
outL = np.tanh(outL * g * 1.1) / 1.1
outR = np.tanh(outR * g * 1.1) / 1.1
peak = max(np.abs(outL).max(), np.abs(outR).max())
outL *= 0.89 / peak
outR *= 0.89 / peak

out = ROOT / "public/audio/music.wav"
out.parent.mkdir(parents=True, exist_ok=True)
data = (np.stack([outL, outR], axis=1) * 32767).astype("<i2")
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())
print(out, f"{len(outL) / SR:.1f} s", f"{TOTAL_BARS} compassos", "rms", round(float(np.sqrt(np.mean(outL**2))), 3))
