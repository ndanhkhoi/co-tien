import { Container, Graphics, Sprite, Texture, type Application } from 'pixi.js';
import { ballStyle } from '../core/ball-styles';
import { paintNumberAtlas } from './art';
import { BallMesh } from './ball-mesh';

/**
 * Render one ball, one sprite and one shape off screen so WebGL links every program a match
 * uses (ball shader, sprite and graphics batchers) while the player is still on the title screen.
 */
export function warmBallShader(app: Application) {
  const numbers = paintNumberAtlas();
  const mesh = new BallMesh(ballStyle('pool', 9), numbers, 0x2f4a6a, () => 0.5);
  mesh.mesh.scale.set(8);
  mesh.setPixelRadius(8);
  const sprite = new Sprite(Texture.WHITE);
  sprite.width = sprite.height = 4;
  const shape = new Graphics().circle(8, 8, 4).fill(0xffffff).moveTo(0, 0).lineTo(16, 16).stroke({ width: 1, color: 0 });
  const holder = new Container();
  holder.addChild(sprite, shape, mesh.mesh);
  const target = app.renderer.generateTexture({ target: holder, resolution: 1 });
  target.destroy(true);
  holder.destroy({ children: true });
  numbers.destroy(true);
}
