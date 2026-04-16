export class PuzzleBase {
  constructor(scene, camera, socket, layout, playerController, doors, soloMode = false) {
    this.scene = scene;
    this.camera = camera;
    this.socket = socket;
    this.layout = layout;
    this.player = playerController;
    this.doors = doors;
    this.soloMode = !!soloMode;
    this.objects = [];
    this.disposed = false;
  }

  update(dt) {}

  onEvent(event) {}

  dispose() {
    this.disposed = true;
    for (const obj of this.objects) {
      this.scene.remove(obj);
      obj.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
    }
    this.objects = [];
  }
}
