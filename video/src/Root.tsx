import { Composition } from 'remotion';
import { Film } from './Film';
import { FPS } from './theme';
import { TOTAL_FRAMES } from './timeline';

export function RemotionRoot() {
  return (
    <>
      <Composition id="Landscape" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ music: true }} />
      <Composition id="Portrait" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ music: true }} />
    </>
  );
}
