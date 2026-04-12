export class PuzzleBase {
  constructor(scene, camera, socket, layout, playerController, doors) {
    this.scene = scene;
    this.camera = camera;
    this.socket = socket;
    this.layout = layout;
    this.player = playerController;
    this.doors = doors;
    this.objects = [];
    this.disposed = false;
  }

  update(dt) {}

  onEvent(event) {}

  dispose() {
    this.disposed = true;
    for (const obj of this.objects) {
      this.scene.remove(obj);
    }
    this.objects = [];
  }
}
