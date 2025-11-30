import * as THREE from "three";

export class Picker {
    public selectedObject: THREE.Object3D | null = null;

    constructor(_viewer: any) {
        // Viewer not used yet
    }

    public handleMouseMove(_event: MouseEvent): void {
        // Implement mouse move logic for picking
    }

    public handleClick(_event: MouseEvent): void {
        // Implement click logic for picking
    }

    public clearSelection(): void {
        if (this.selectedObject) {
            this.selectedObject.userData.selected = false;
            this.selectedObject = null;
        }
    }

    public setConnectionMode(_active: boolean): void {
        // Connection mode logic not implemented
    }
}
