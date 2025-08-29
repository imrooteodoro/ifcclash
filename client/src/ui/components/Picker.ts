import * as THREE from "three";

export class Picker {
    private viewer: any;
    public selectedObject: THREE.Object3D | null = null;
    private isConnectionMode: boolean = false;

    constructor(viewer: any) {
        this.viewer = viewer;
    }

    public handleMouseMove(event: MouseEvent): void {
        // Implement mouse move logic for picking
    }

    public handleClick(event: MouseEvent): void {
        // Implement click logic for picking
    }

    public clearSelection(): void {
        if (this.selectedObject) {
            this.selectedObject.userData.selected = false;
            this.selectedObject = null;
        }
    }

    public setConnectionMode(active: boolean): void {
        this.isConnectionMode = active;
    }
}
