import * as THREE from "three";

export interface GeometryData {
    GetVertexData(): any;
    GetVertexDataSize(): number;
    GetIndexData(): any;
    GetIndexDataSize(): number;
    delete(): void;
}

export interface PlacedGeometry {
    geometryExpressID: number;
    flatTransformation: number[];
    color: THREE.Vector4;
}

export interface IFCModel extends THREE.Group {
    name: string;
    modelID: number;
    userData: {
        viewerModel: boolean;
        hasPDF?: boolean;
        pdfPreviewImage?: string;
        pdfPreviewImageIndex?: number;
        guid?: string;
        [key: string]: any;
    };
}
