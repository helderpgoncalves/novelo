import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { DotWipe } from './components/DotWipe';
import { useBrandFonts } from './components/Fonts';
import { Close } from './scenes/Close';
import { Counter } from './scenes/Counter';
import { Criteria } from './scenes/Criteria';
import { Destination } from './scenes/Destination';
import { Law } from './scenes/Law';
import { MapScene } from './scenes/MapScene';
import { Montage, SHOTS } from './scenes/Montage';
import { Network } from './scenes/Network';
import { Open } from './scenes/Open';
import { Pivot } from './scenes/Pivot';
import { Results } from './scenes/Results';
import { Rigor } from './scenes/Rigor';
import { Waffle } from './scenes/Waffle';
import { C } from './theme';
import { TAIL, TIMELINE, type SceneId } from './timeline';

function render(id: SceneId, dur: number) {
  switch (id) {
    case 'open':
      return <Open dur={dur} />;
    case 'counter':
      return <Counter dur={dur} />;
    case 'waffle':
      return <Waffle dur={dur} />;
    case 'destination':
      return <Destination dur={dur} />;
    case 'law':
      return <Law dur={dur} />;
    case 'map':
      return <MapScene dur={dur} />;
    case 'pivot':
      return <Pivot dur={dur} />;
    case 'network':
      return <Network dur={dur} />;
    case 'results':
      return <Results dur={dur} />;
    case 'montage':
      return <Montage per={dur / SHOTS.length} />;
    case 'criteria':
      return <Criteria dur={dur} />;
    case 'rigor':
      return <Rigor dur={dur} />;
    case 'close':
      return <Close dur={dur + TAIL} />;
  }
}

// Cortes com meio-tom: só quando o fundo muda (claro ↔ escuro) ou para marcar um capítulo.
const WIPES: SceneId[] = ['waffle', 'map', 'pivot', 'network', 'results', 'criteria', 'rigor'];

export function Film({ music = true }: { music?: boolean }) {
  useBrandFonts();
  return (
    <AbsoluteFill style={{ background: C.noite }}>
      {TIMELINE.map((s, i) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.dur + (i === TIMELINE.length - 1 ? TAIL : 0)}>
          <AbsoluteFill style={{ background: s.bg === 'dark' ? C.noite : C.linho }}>{render(s.id, s.dur)}</AbsoluteFill>
        </Sequence>
      ))}
      {TIMELINE.filter((s) => WIPES.includes(s.id)).map((s) => (
        <DotWipe key={`w${s.id}`} at={s.from} color={s.bg === 'dark' ? C.noite : C.linho} />
      ))}
      {music && <Audio src={staticFile('audio/music.wav')} />}
    </AbsoluteFill>
  );
}
