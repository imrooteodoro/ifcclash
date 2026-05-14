import * as THREE from "three";
import CameraControls from "camera-controls";
import { IfcAPI } from "web-ifc";
import { Picker } from "./components/Picker";
import { ViewCube } from "./ViewCube";
import { GeometryData, IFCModel, PlacedGeometry } from "./types";

// Install CameraControls
CameraControls.install({ THREE: THREE });

export class IFCViewer {
    private container: HTMLElement;
    private loadingOverlay: HTMLElement | null;
    private models: Map<number, IFCModel>;
    private modelCounter: number;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: CameraControls;
    private clock: THREE.Clock;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private ifcAPI: IfcAPI;
    private grid: THREE.GridHelper;
    private axes: THREE.AxesHelper;
    private picker: Picker;
    private meshCounter: number;
    private sectionBoxHelper: THREE.LineSegments | null;
    private isConnectionMode: boolean = false;
    private pdfImagePaths: string[];
    private pdfPreviewWindow: HTMLDivElement;
    private lastHoveredModel: IFCModel | null = null;
    private viewCube: ViewCube | null = null;

    // Clash isolation state
    private guidIndex: Map<string, THREE.Object3D[]> = new Map();
    private lastIsolatedGuids: Set<string> = new Set();
    private isWasmInitialized: boolean = false;
    private currentZoomAnimation: number | null = null;
    private initialCameraPosition: THREE.Vector3 | null = null;
    private initialCameraTarget: THREE.Vector3 | null = null;
    public readonly ready: Promise<void>;



    constructor(container: HTMLElement) {
        this.container = container;
        this.loadingOverlay = null;
        this.models = new Map();
        this.modelCounter = 0;
        this.meshCounter = 0;
        this.sectionBoxHelper = null;

        // Initialize Three.js components
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true,
        });
        this.controls = new CameraControls(this.camera, this.renderer.domElement);
        this.clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Initialize IFC API
        this.ifcAPI = new IfcAPI();

        // Initialize scene helpers
        this.grid = new THREE.GridHelper(50, 50);
        this.axes = new THREE.AxesHelper(5);

        // Initialize UI components
        this.picker = new Picker(this);

        // Initialize PDF preview window and PNG image paths.
        this.pdfImagePaths = ["/page_4_name_IW 3.1.png", "/page_3_name_AW 1.1.png"];
        this.pdfPreviewWindow = document.createElement("div");
        this.pdfPreviewWindow.style.position = "absolute";
        this.pdfPreviewWindow.style.background = "rgba(255, 255, 255, 0.9)";
        this.pdfPreviewWindow.style.border = "1px solid #ccc";
        this.pdfPreviewWindow.style.padding = "10px";
        this.pdfPreviewWindow.style.display = "none";
        this.pdfPreviewWindow.style.zIndex = "1000";
        this.pdfPreviewWindow.style.maxWidth = "400px";
        this.pdfPreviewWindow.style.boxShadow = "2px 2px 6px rgba(0,0,0,0.3)";
        this.container.appendChild(this.pdfPreviewWindow);

        // Start initialization
        this.ready = this.init();
    }

    private showLoading(): void {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.add("active");
        }
    }

    private hideLoading(): void {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.remove("active");
        }
    }

    private async init(): Promise<void> {
        if (document.readyState === "loading") {
            await new Promise<void>(resolve => document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
        }
        await this.setup();
    }

    private async setup(): Promise<void> {
        try {
            this.loadingOverlay = document.querySelector(".loading-overlay");
            this.showLoading();

            // Initialize scene
            this.scene.background = new THREE.Color(0xf0f0f0);

            // Setup camera
            this.camera.position.set(10, 10, 10);
            this.camera.lookAt(0, 0, 0);

            // Setup renderer
            // Use container dimensions instead of window dimensions
            const containerWidth = this.container.clientWidth || 800;
            const containerHeight = this.container.clientHeight || 600;


            this.renderer.setSize(containerWidth, containerHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.shadowMap.enabled = false;
            this.container.appendChild(this.renderer.domElement);

            // Setup controls with CameraControls API
            this.controls.enabled = true;

            // Enhanced zoom/dolly controls
            this.controls.dollySpeed = 0.8;
            this.controls.minDistance = 0.01;  // Very small minimum to allow close zoom
            this.controls.maxDistance = Infinity;  // No maximum limit

            // Pan (truck) and rotate settings
            this.controls.truckSpeed = 0.8;
            this.controls.azimuthRotateSpeed = 0.5;
            this.controls.polarRotateSpeed = 0.5;

            // Smooth transitions
            this.controls.smoothTime = 0.25;
            this.controls.draggingSmoothTime = 0.125;

            // Enhanced keyboard controls for additional navigation
            this.setupKeyboardNavigation();

            // Setup grid and axes
            this.grid.visible = false;
            this.scene.add(this.grid);

            this.axes.visible = false;
            this.scene.add(this.axes);

            // Setup lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(5, 10, 5);
            directionalLight.castShadow = true;
            this.scene.add(directionalLight);

            // Initialize IFC API with proper WASM path
            this.ifcAPI.SetWasmPath('/');
            await this.ifcAPI.Init(undefined, true);
            this.isWasmInitialized = true;

            // Setup UI components
            this.setupPicking();
            this.setupKeyboardShortcuts();
            this.setupClashEventListeners();
            this.setupViewCube();

            // Prevent browser zoom on canvas
            this.setupZoomPrevention();

            // Setup cursor-based orbit center
            this.setupCursorBasedOrbit();

            // Setup window resize handler
            window.addEventListener("resize", () => this.onWindowResize());

            // Start animation loop
            this.animate();


        } catch (error) {
            console.error("Error initializing IFC viewer:", error);
            if (error instanceof Error) {
                console.error("Error details:", error.stack);
            }
        } finally {
            this.hideLoading();
        }
    }

    private onWindowResize(): void {
        const containerWidth = this.container.clientWidth || 800;
        const containerHeight = this.container.clientHeight || 600;

        // Don't resize if container has zero dimensions (e.g., display: none)
        if (containerWidth === 0 || containerHeight === 0) {
            return;
        }

        this.camera.aspect = containerWidth / containerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(containerWidth, containerHeight);
    }

    public resize(): void {
        this.onWindowResize();
    }

    public refreshViewer(): void {
        // Force a resize to ensure proper dimensions
        this.onWindowResize();

        // Force a render
        this.renderer.render(this.scene, this.camera);
    }

    private animate(): void {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        const hasControlsUpdated = this.controls.update(delta);

        // Only render if controls updated or always render for smooth animation
        if (hasControlsUpdated || true) {
            this.renderer.render(this.scene, this.camera);
        }

        // Update view cube orientation to match main camera
        if (this.viewCube) {
            this.viewCube.updateCubeOrientation();
        }
    }

    public async loadIFC(file: File): Promise<void> {
        try {
            this.showLoading();

            // Ensure WASM is fully initialized before proceeding
            if (!this.isWasmInitialized) {

                await this.ifcAPI.Init(undefined, true);
                this.isWasmInitialized = true;

            }

            const data = await file.arrayBuffer();

            const modelID = this.ifcAPI.OpenModel(new Uint8Array(data), {
                COORDINATE_TO_ORIGIN: false,
            });

            const model = new THREE.Group() as IFCModel;
            model.name = file.name;
            model.modelID = modelID;
            model.userData.viewerModel = true;

            let elementCount = 0;
            let geometryCount = 0;

            this.ifcAPI.StreamAllMeshes(modelID, (mesh: any) => {
                const placedGeometries = mesh.geometries;
                const expressID = mesh.expressID;

                // Get the IFC type name
                const typeCode = this.ifcAPI.GetLineType(modelID, expressID);
                const ifcType = this.ifcAPI.GetNameFromTypeCode(typeCode);


                const elementGroup = this.createElementGroup(
                    expressID,
                    modelID,
                    ifcType
                );

                // Index GUID for clash isolation
                this.indexElementGuid(elementGroup, modelID, expressID);

                for (let i = 0; i < placedGeometries.size(); i++) {
                    const placedGeometry = placedGeometries.get(i) as PlacedGeometry;

                    try {
                        const geometry = this.getBufferGeometry(modelID, placedGeometry);
                        geometryCount++;

                        const matrix = new THREE.Matrix4();
                        matrix.fromArray(placedGeometry.flatTransformation);
                        geometry.applyMatrix4(matrix);

                        const color = placedGeometry.color;
                        const material = new THREE.MeshPhongMaterial({
                            color: new THREE.Color(color.x, color.y, color.z),
                            opacity: color.w,
                            transparent: color.w !== 1,
                            side: THREE.DoubleSide,
                        });

                        const mesh = this.createMesh(
                            geometry,
                            material,
                            expressID,
                            modelID
                        );

                        elementGroup.add(mesh);
                    } catch (error) {
                        console.error(
                            `Error processing geometry ${i} for element ${expressID}:`,
                            error
                        );
                    }
                }

                model.add(elementGroup);
                elementCount++;
            });

            this.scene.add(model);
            const modelId = ++this.modelCounter;
            this.models.set(modelId, model);

            // Find and align IFC origin
            const ifcOrigin = await this.findIFCOrigin(modelID, model);
            this.alignModelToWorldOrigin(model, ifcOrigin);

            this.createModelListItem(modelId, file.name, model);

            // Position camera based on all models
            this.updateCameraForAllModels();

            // Update ViewCube model center for proper rotation axis
            if (this.viewCube) {
                this.viewCube.updateModelCenterFromViewer();
            }

        } catch (error) {
            console.error("Error loading IFC file:", error);
        } finally {
            this.hideLoading();
        }
    }

    private indexElementGuid(elementGroup: THREE.Group, modelID: number, expressID: number): void {
        try {
            const line = this.ifcAPI.GetLine(modelID, expressID);
            const guid = this.extractGuid(line);

            if (guid) {
                const normalizedGuid = this.normalizeGuid(guid);
                elementGroup.userData.guid = normalizedGuid;
                const arr = this.guidIndex.get(normalizedGuid) || [];
                arr.push(elementGroup);
                this.guidIndex.set(normalizedGuid, arr);

            } else {
                console.warn(`No GUID found for element ${expressID}`);
            }
        } catch (e) {
            console.warn("Could not read line for expressID", expressID, e);
        }
    }

    private extractGuid(line: any): string | null {
        // web-ifc typically exposes GlobalId as a string, but be defensive
        // Common shapes: "GlobalId": "xxxxx" OR "GlobalId": { value: "xxxxx" }
        const raw = line?.GlobalId ?? line?.GlobalID ?? line?.mGlobalId;
        if (!raw) return null;
        if (typeof raw === "string") return raw;
        if (typeof raw?.value === "string") return raw.value;
        if (typeof raw?.value?.value === "string") return raw.value.value;
        return null;
    }

    private normalizeGuid(guid: string): string {
        return guid.replace(/[{}]/g, "").trim().toLowerCase();
    }

    private getBufferGeometry(
        modelID: number,
        placedGeometry: PlacedGeometry
    ): THREE.BufferGeometry {
        const geometry = this.ifcAPI.GetGeometry(
            modelID,
            placedGeometry.geometryExpressID
        ) as GeometryData;

        const verts = this.ifcAPI.GetVertexArray(
            geometry.GetVertexData(),
            geometry.GetVertexDataSize()
        );
        const indices = this.ifcAPI.GetIndexArray(
            geometry.GetIndexData(),
            geometry.GetIndexDataSize()
        );

        const bufferGeometry = new THREE.BufferGeometry();
        const posFloats = new Float32Array(verts.length / 2);
        const normFloats = new Float32Array(verts.length / 2);

        for (let i = 0; i < verts.length; i += 6) {
            posFloats[i / 2] = verts[i];
            posFloats[i / 2 + 1] = verts[i + 1];
            posFloats[i / 2 + 2] = verts[i + 2];

            normFloats[i / 2] = verts[i + 3];
            normFloats[i / 2 + 1] = verts[i + 4];
            normFloats[i / 2 + 2] = verts[i + 5];
        }

        bufferGeometry.setAttribute(
            "position",
            new THREE.BufferAttribute(posFloats, 3)
        );
        bufferGeometry.setAttribute(
            "normal",
            new THREE.BufferAttribute(normFloats, 3)
        );
        bufferGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

        geometry.delete();
        return bufferGeometry;
    }

    private setupKeyboardShortcuts(): void {
        document.addEventListener("keydown", (event: KeyboardEvent) => {
            if (
                event.code === "Space" &&
                this.picker.selectedObject &&
                !(event.target as HTMLElement).closest("input, textarea")
            ) {
                event.preventDefault();
                this.toggleSelectedVisibility();
            }
        });
    }

    private setupKeyboardNavigation(): void {
        document.addEventListener("keydown", (event: KeyboardEvent) => {
            // Only handle keyboard navigation when not typing in input fields
            if ((event.target as HTMLElement).closest("input, textarea")) {
                return;
            }

            const panSpeed = 5;
            const rotateSpeed = 0.05;

            const delta = this.clock.getDelta();

            switch (event.code) {
                case "ArrowLeft":
                    event.preventDefault();
                    this.controls.truck(-panSpeed, 0, false);
                    break;
                case "ArrowRight":
                    event.preventDefault();
                    this.controls.truck(panSpeed, 0, false);
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    if (event.shiftKey) {
                        // Shift + Up: pan up
                        this.controls.truck(0, panSpeed, false);
                    } else {
                        // Up: rotate up
                        this.controls.rotate(0, -rotateSpeed, false);
                    }
                    break;
                case "ArrowDown":
                    event.preventDefault();
                    if (event.shiftKey) {
                        // Shift + Down: pan down
                        this.controls.truck(0, -panSpeed, false);
                    } else {
                        // Down: rotate down
                        this.controls.rotate(0, rotateSpeed, false);
                    }
                    break;
                case "KeyQ":
                    event.preventDefault();
                    this.zoomIn();
                    break;
                case "KeyE":
                    event.preventDefault();
                    this.zoomOut();
                    break;
                case "KeyF":
                    event.preventDefault();
                    this.zoomToFit();
                    break;
            }

            this.controls.update(delta);
        });
    }

    public toggleSelectedVisibility(): void {
        if (!this.picker.selectedObject) return;

        const isVisible = this.picker.selectedObject.visible;
        this.picker.selectedObject.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
                child.visible = !isVisible;
            }
        });
    }

    public isolateSelected(): void {
        if (!this.picker.selectedObject) return;

        this.models.forEach((model) => {
            model.traverse((child: THREE.Object3D) => {
                if ((child as THREE.Mesh).isMesh) {
                    child.visible = false;
                }
            });
        });

        this.picker.selectedObject.traverse((child: THREE.Object3D) => {
            if ((child as THREE.Mesh).isMesh) {
                child.visible = true;
            }
        });
    }

    public showAll(): void {
        this.models.forEach((model) => {
            model.traverse((child: THREE.Object3D) => {
                if ((child as THREE.Mesh).isMesh) {
                    child.visible = true;
                }
            });
        });
    }

    private setupPicking(): void {
        this.container.addEventListener("click", (event: MouseEvent) => {
            this.handleClick(event);
        });

        this.container.addEventListener("mousemove", (event: MouseEvent) => {
            this.handleMouseMove(event);
        });
    }

    private createModelListItem(
        modelId: number,
        fileName: string,
        model: IFCModel
    ): void {
        const modelsList = document.getElementById("models-list");
        if (!modelsList) return;

        const modelItem = document.createElement("div");
        modelItem.className = "model-item";
        modelItem.id = `model-${modelId}`;

        const modelHeader = document.createElement("div");
        modelHeader.className = "model-header";

        const modelName = document.createElement("div");
        modelName.className = "model-name";
        modelName.textContent = fileName;

        const modelControls = document.createElement("div");
        modelControls.className = "model-controls";

        // Visibility toggle button
        const visibilityBtn = document.createElement("button");
        visibilityBtn.className = "model-control-btn";
        visibilityBtn.innerHTML = '<i class="fas fa-eye"></i>';
        visibilityBtn.title = "Toggle Visibility";
        visibilityBtn.addEventListener("click", () => {
            model.visible = !model.visible;
            visibilityBtn.innerHTML = model.visible
                ? '<i class="fas fa-eye"></i>'
                : '<i class="fas fa-eye-slash"></i>';
        });

        // PDF Upload button
        const pdfUploadBtn = document.createElement("button");
        pdfUploadBtn.className = "model-control-btn";
        pdfUploadBtn.innerHTML = '<i class="fas fa-file-pdf"></i>';
        pdfUploadBtn.title = "Upload PDF";
        pdfUploadBtn.addEventListener("click", () => {
            pdfInput.click();
        });

        // Hidden PDF input for uploading PDFs
        const pdfInput = document.createElement("input");
        pdfInput.type = "file";
        pdfInput.accept = "application/pdf";
        pdfInput.style.display = "none";
        pdfInput.addEventListener("change", (event: Event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (file) {

                // Mark this model as having a PDF loaded and store a single random preview image.
                model.userData.hasPDF = true;
                model.userData.pdfPreviewImage = this.getRandomPdfImage();

                // PDF upload confirmation message with enhanced styling
                let confirmation = modelItem.querySelector(".pdf-upload-confirmation");
                if (!confirmation) {
                    confirmation = document.createElement("div");
                    confirmation.className = "pdf-upload-confirmation";
                    // Styling similar to the model tree / app alerts
                    (confirmation as HTMLElement).style.marginTop = "5px";
                    (confirmation as HTMLElement).style.fontSize = "14px";
                    (confirmation as HTMLElement).style.color = "#155724";
                    (confirmation as HTMLElement).style.backgroundColor = "#d4edda";
                    (confirmation as HTMLElement).style.border = "1px solid #c3e6cb";
                    (confirmation as HTMLElement).style.borderRadius = "4px";
                    (confirmation as HTMLElement).style.padding = "4px 8px";
                    (confirmation as HTMLElement).style.maxWidth = "80%";
                    (confirmation as HTMLElement).style.margin = "5px auto";
                    modelItem.appendChild(confirmation);
                }
                confirmation.textContent = `PDF uploaded successfully: ${file.name}`;

                // Handle the PDF file as needed (e.g., store or display it)
            }
        });

        // Delete button
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "model-control-btn";
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = "Delete Model";
        deleteBtn.addEventListener("click", async () => {
            this.scene.remove(model);
            this.models.delete(modelId);
            modelItem.remove();
        });

        // Append the buttons to the controls container
        modelControls.appendChild(visibilityBtn);
        modelControls.appendChild(pdfUploadBtn);
        modelControls.appendChild(deleteBtn);
        modelHeader.appendChild(modelName);
        modelHeader.appendChild(modelControls);
        modelItem.appendChild(modelHeader);
        // Append the hidden PDF input to the model card
        modelItem.appendChild(pdfInput);

        // Model info section
        const modelInfo = document.createElement("div");
        modelInfo.className = "model-info";

        // Get model information
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        modelInfo.innerHTML = `
      <div>Size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(
            2
        )}</div>
      <div>Center: (${center.x.toFixed(2)}, ${center.y.toFixed(
            2
        )}, ${center.z.toFixed(2)})</div>
    `;

        // Add spatial tree section to model card
        const treeSection = document.createElement("div");
        treeSection.className = "model-tree-section";
        const treeContent = document.createElement("div");
        treeContent.className = "model-tree-content";
        treeContent.id = `model-tree-${modelId}`;
        treeSection.appendChild(treeContent);

        modelItem.appendChild(modelInfo);
        modelItem.appendChild(treeSection);
        modelsList.appendChild(modelItem);
    }



    private setupClashEventListeners(): void {
        document.addEventListener("clash-selection-change", (e: any) => {
            const guids: string[] = e?.detail?.guids ?? [];
            const focusPoints: [number, number, number][] = e?.detail?.focusPoints ?? [];

            if (guids.length > 0) {
                this.isolateByGuids(guids, { zoom: true, focusPoints });
            } else {
                this.clearClashIsolation();
            }
        });
    }

    private setupZoomPrevention(): void {
        // Prevent browser zoom when scrolling on the canvas
        const canvas = this.renderer.domElement;
        canvas.addEventListener('wheel', (event: WheelEvent) => {
            event.preventDefault();
        }, { passive: false });

        // Also prevent zoom on container
        this.container.addEventListener('wheel', (event: WheelEvent) => {
            event.preventDefault();
        }, { passive: false });
    }

    private setupCursorBasedOrbit(): void {
        const canvas = this.renderer.domElement;

        // Update orbit center immediately on pointerdown for left mouse button (orbit)
        // Using setOrbitPoint ensures no camera movement, preventing jumps
        canvas.addEventListener('pointerdown', (event: PointerEvent) => {
            // Only handle left mouse button (button 0) for orbit
            if (event.button === 0) {
                // Update orbit center using pointerdown position
                const rect = canvas.getBoundingClientRect();
                const isOnCanvas = (
                    event.clientX >= rect.left &&
                    event.clientX <= rect.right &&
                    event.clientY >= rect.top &&
                    event.clientY <= rect.bottom
                );

                this.updateOrbitCenter(event, isOnCanvas);
            }
        }, true);
    }

    private updateOrbitCenter(event: MouseEvent | PointerEvent, isCursorOnCanvas: boolean): void {
        // Determine the new orbit center point
        let newTargetPoint: THREE.Vector3;
        if (isCursorOnCanvas) {
            // Use cursor position as orbit center
            newTargetPoint = this.getWorldPointUnderCursor(event);
        } else {
            // Use center of canvas as orbit center
            newTargetPoint = this.getWorldPointAtCanvasCenter();
        }

        // Use CameraControls' setOrbitPoint method - this changes the orbit center
        // without moving the camera, preventing any visual jump
        this.controls.setOrbitPoint(
            newTargetPoint.x,
            newTargetPoint.y,
            newTargetPoint.z
        );
    }

    private getWorldPointUnderCursor(event: MouseEvent | PointerEvent): THREE.Vector3 {
        const rect = this.container.getBoundingClientRect();
        const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update raycaster with mouse position
        this.raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), this.camera);

        // Find intersections with all models
        let intersects: THREE.Intersection[] = [];
        this.models.forEach((model) => {
            const modelIntersects = this.raycaster.intersectObject(model, true);
            intersects = intersects.concat(modelIntersects);
        });

        if (intersects.length > 0) {
            // Use the first intersection point
            return intersects[0].point;
        }

        // If no intersection, calculate point at a reasonable distance along the ray
        // Use the current camera distance as reference
        const currentTarget = this.getControlsTarget();
        const distance = this.camera.position.distanceTo(currentTarget);
        const direction = this.raycaster.ray.direction.clone().normalize();
        return this.camera.position.clone().add(
            direction.multiplyScalar(distance)
        );
    }

    private getWorldPointAtCanvasCenter(): THREE.Vector3 {
        // Calculate center of canvas in normalized device coordinates (0, 0)
        const centerNDC = new THREE.Vector2(0, 0);
        this.raycaster.setFromCamera(centerNDC, this.camera);

        // Find intersections with all models
        let intersects: THREE.Intersection[] = [];
        this.models.forEach((model) => {
            const modelIntersects = this.raycaster.intersectObject(model, true);
            intersects = intersects.concat(modelIntersects);
        });

        if (intersects.length > 0) {
            // Use the first intersection point
            return intersects[0].point;
        }

        // If no intersection, use current target or calculate point at reasonable distance
        const currentTarget = this.getControlsTarget();
        const distance = this.camera.position.distanceTo(currentTarget);
        const direction = this.raycaster.ray.direction.clone().normalize();
        return this.camera.position.clone().add(
            direction.multiplyScalar(distance)
        );
    }

    private setupViewCube(): void {

        // Create view cube directly on the renderer's DOM element (3D canvas)
        this.viewCube = new ViewCube(this.renderer.domElement.parentElement || this.container, this.camera, this.controls, this, {
            size: 100,
            position: { x: 20, y: 20 },
            backgroundColor: 0x1a1a1a,
            faceColors: {
                front: 0x4a90e2,   // Blue
                back: 0xe24a4a,    // Red
                left: 0x4ae24a,    // Green
                right: 0xe2e24a,   // Yellow
                top: 0xe24ae2,     // Magenta
                bottom: 0x4ae2e2   // Cyan
            },
            animationDuration: 600,
            showZoomControls: true
        });
    }

    private createElementGroup(
        expressID: number,
        modelID: number,
        ifcType: string
    ): THREE.Group {
        const elementGroup = new THREE.Group();
        elementGroup.name = `Element_${expressID}`;
        elementGroup.userData = {
            modelID,
            expressID,
            type: "element",
            ifcType,
        };
        return elementGroup;
    }

    private createMesh(
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        expressID: number,
        modelID: number
    ): THREE.Mesh {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `Mesh_${expressID}_${this.meshCounter++}`;
        mesh.userData = {
            modelID,
            expressID,
            type: "mesh",
        };
        return mesh;
    }

    // Add these getter methods to the IFCViewer class
    public getModels(): Map<number, IFCModel> {
        return this.models;
    }

    public setModelVisibility(modelId: number, visible: boolean): void {
        const model = this.models.get(modelId)
        if (model) model.visible = visible
    }

    public setModelOpacity(modelId: number, opacity: number): void {
        const model = this.models.get(modelId)
        if (!model) return
        model.traverse((obj) => {
            const mesh = obj as THREE.Mesh
            if (!mesh.isMesh) return
            const mat = mesh.material as THREE.MeshPhongMaterial
            if (!mat) return
            mat.opacity = opacity
            mat.transparent = opacity < 1
            mat.needsUpdate = true
        })
    }

    public getCamera(): THREE.Camera {
        return this.camera;
    }

    public getControls(): any {
        return this.controls;
    }

    public getScene(): THREE.Scene {
        return this.scene;
    }

    public getIfcAPI(): IfcAPI {
        return this.ifcAPI;
    }

    // Helper methods for CameraControls target access
    private getControlsTarget(): THREE.Vector3 {
        const target = new THREE.Vector3();
        this.controls.getTarget(target);
        return target;
    }


    public setSectionBox(bbox: THREE.Box3 | null): void {
        // Remove existing section box if bbox is null
        if (!bbox) {
            if (this.sectionBoxHelper) {
                this.scene.remove(this.sectionBoxHelper);
                this.sectionBoxHelper = null;
            }
            // Reset clipping planes
            this.renderer.clippingPlanes = [];
            this.renderer.localClippingEnabled = false;
            return;
        }

        // Remove existing helper
        if (this.sectionBoxHelper) {
            this.scene.remove(this.sectionBoxHelper);
        }

        // Create custom material for dotted lines
        const material = new THREE.LineDashedMaterial({
            color: 0x000000, // Black color
            dashSize: 0.2, // Length of the dashes
            gapSize: 0.1, // Length of the gaps
            linewidth: 1,
            scale: 1, // Scale of the dashes
        });

        // Create box geometry
        const geometry = new THREE.BoxGeometry(
            bbox.max.x - bbox.min.x,
            bbox.max.y - bbox.min.y,
            bbox.max.z - bbox.min.z
        );
        const edges = new THREE.EdgesGeometry(geometry);

        this.sectionBoxHelper = new THREE.LineSegments(edges, material);

        // Position the box at center of bounds
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        this.sectionBoxHelper.position.copy(center);

        // Compute line distances (required for dashed lines)
        this.sectionBoxHelper.computeLineDistances();

        this.scene.add(this.sectionBoxHelper);

        // Update clipping planes
        const planes = [
            new THREE.Plane(new THREE.Vector3(-1, 0, 0), bbox.max.x),
            new THREE.Plane(new THREE.Vector3(1, 0, 0), -bbox.min.x),
            new THREE.Plane(new THREE.Vector3(0, -1, 0), bbox.max.y),
            new THREE.Plane(new THREE.Vector3(0, 1, 0), -bbox.min.y),
            new THREE.Plane(new THREE.Vector3(0, 0, -1), bbox.max.z),
            new THREE.Plane(new THREE.Vector3(0, 0, 1), -bbox.min.z),
        ];

        this.renderer.clippingPlanes = planes;
        this.renderer.localClippingEnabled = true;

        // Zoom to fit section box
        this.zoomToBox(bbox);
    }

    private async zoomToBox(bbox: THREE.Box3): Promise<void> {
        // Cancel any ongoing zoom animation
        if (this.currentZoomAnimation !== null) {
            cancelAnimationFrame(this.currentZoomAnimation);
            this.currentZoomAnimation = null;
        }

        // Validate bounding box
        if (bbox.isEmpty()) {
            console.warn('[IFCViewer] Cannot zoom to empty bounding box');
            return;
        }

        const size = bbox.getSize(new THREE.Vector3());
        const minSize = 0.001; // Minimum size threshold

        if (size.x < minSize && size.y < minSize && size.z < minSize) {
            console.warn('[IFCViewer] Bounding box too small to zoom');
            return;
        }

        // CRITICAL: Set viewport to match renderer size for accurate fitToBox calculation
        const containerWidth = this.container.clientWidth || 800;
        const containerHeight = this.container.clientHeight || 600;
        this.controls.setViewport(0, 0, containerWidth, containerHeight);

        // Use CameraControls fitToBox with cover: true to FILL THE ENTIRE SCREEN
        // This is the key - cover: true fills the viewport, cover: false fits with margins
        await this.controls.fitToBox(bbox, true, {
            cover: true,         // TRUE = fill entire screen (may crop slightly)
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0
        });

        // Ensure camera updates after transition
        const delta = this.clock.getDelta();
        this.controls.update(delta);
    }

    private async zoomToClashPoints(clashPoints: [number, number, number][], targets: THREE.Object3D[]): Promise<void> {
        // Cancel any ongoing animation
        if (this.currentZoomAnimation !== null) {
            cancelAnimationFrame(this.currentZoomAnimation);
            this.currentZoomAnimation = null;
        }

        // If only one clash point, use the single point zoom
        if (clashPoints.length === 1) {
            await this.zoomToClashPoint(clashPoints[0], targets);
            return;
        }

        // Create a bounding box that encompasses all clash points
        const clashBounds = new THREE.Box3();
        clashPoints.forEach(point => {
            const p = new THREE.Vector3(point[0], point[1], point[2]);
            clashBounds.expandByPoint(p);
        });

        // Also include all target objects in the bounding box
        // CRITICAL: Update matrixWorld first
        this.scene.updateMatrixWorld(true);

        for (const obj of targets) {
            obj.updateMatrixWorld(true);
            const wasVisible = obj.visible;
            obj.visible = true;

            const objBox = new THREE.Box3();
            objBox.setFromObject(obj);

            obj.visible = wasVisible;

            if (!objBox.isEmpty()) {
                clashBounds.union(objBox);
            }
        }

        // Validate bounding box
        if (clashBounds.isEmpty()) {
            console.warn('[IFCViewer] Cannot zoom to empty bounding box for clash points');
            return;
        }

        // CRITICAL: Set viewport to match renderer size for accurate fitToBox calculation
        const containerWidth = this.container.clientWidth || 800;
        const containerHeight = this.container.clientHeight || 600;
        this.controls.setViewport(0, 0, containerWidth, containerHeight);

        // Use CameraControls fitToBox with cover: true to FILL THE ENTIRE SCREEN
        await this.controls.fitToBox(clashBounds, true, {
            cover: true,         // TRUE = fill entire screen
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0
        });

        // Ensure camera updates after transition
        const delta = this.clock.getDelta();
        this.controls.update(delta);
    }

    private async zoomToClashPoint(clashPoint: [number, number, number], targets: THREE.Object3D[]): Promise<void> {
        // Cancel any ongoing animation
        if (this.currentZoomAnimation !== null) {
            cancelAnimationFrame(this.currentZoomAnimation);
            this.currentZoomAnimation = null;
        }

        // Calculate bounding box of ALL target objects
        // CRITICAL: Update matrixWorld first to ensure accurate bounding box calculation
        this.scene.updateMatrixWorld(true);

        const boundingBox = new THREE.Box3();
        let hasObjects = false;

        for (const obj of targets) {
            // Update this object's matrixWorld
            obj.updateMatrixWorld(true);

            // Use setFromObject which includes all descendants
            // Make sure object is visible for accurate calculation
            const wasVisible = obj.visible;
            obj.visible = true;

            const objBox = new THREE.Box3();
            objBox.setFromObject(obj);

            // Restore visibility
            obj.visible = wasVisible;

            if (!objBox.isEmpty()) {
                boundingBox.union(objBox);
                hasObjects = true;
            }
        }

        // Ensure the clash point is included
        const focusPoint = new THREE.Vector3(clashPoint[0], clashPoint[1], clashPoint[2]);
        boundingBox.expandByPoint(focusPoint);

        if (!hasObjects) {
            // Fallback: create a small box around the clash point
            const fallbackSize = 5;
            boundingBox.set(
                new THREE.Vector3(focusPoint.x - fallbackSize, focusPoint.y - fallbackSize, focusPoint.z - fallbackSize),
                new THREE.Vector3(focusPoint.x + fallbackSize, focusPoint.y + fallbackSize, focusPoint.z + fallbackSize)
            );
        }

        // Validate bounding box
        if (boundingBox.isEmpty()) {
            console.warn('[IFCViewer] Cannot zoom to empty bounding box for clash point');
            return;
        }

        const boxSize = boundingBox.getSize(new THREE.Vector3());
        const minSize = 0.001; // Minimum size threshold

        if (boxSize.x < minSize && boxSize.y < minSize && boxSize.z < minSize) {
            // Expand the bounding box if it's too small
            const expandSize = 2;
            boundingBox.expandByScalar(expandSize);
        }

        // CRITICAL: Set viewport to match renderer size for accurate fitToBox calculation
        const containerWidth = this.container.clientWidth || 800;
        const containerHeight = this.container.clientHeight || 600;
        this.controls.setViewport(0, 0, containerWidth, containerHeight);

        // Use CameraControls fitToBox with cover: true to FILL THE ENTIRE SCREEN
        await this.controls.fitToBox(boundingBox, true, {
            cover: true,         // TRUE = fill entire screen
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0
        });

        // Ensure camera updates after transition
        const delta = this.clock.getDelta();
        this.controls.update(delta);
    }



    public getContainer(): HTMLElement {
        return this.container;
    }

    // Add method to toggle connection mode
    public setConnectionMode(active: boolean): void {
        this.isConnectionMode = active;
        this.picker.setConnectionMode(active);

        if (active) {
            this.clearSelection();
            this.traverse((object: THREE.Object3D) => {
                if ((object as THREE.Mesh).isMesh) {
                    const material = (object as THREE.Mesh)
                        .material as THREE.MeshPhongMaterial;
                    if (material) {
                        material.transparent = true;
                        material.opacity = 0.3;
                        material.depthWrite = false;
                    }
                }
            });
        } else {
            this.traverse((object: THREE.Object3D) => {
                if ((object as THREE.Mesh).isMesh) {
                    const material = (object as THREE.Mesh)
                        .material as THREE.MeshPhongMaterial;
                    if (material) {
                        if (!object.userData.selected) {
                            material.transparent = false;
                            material.opacity = 1;
                        }
                        material.depthWrite = true;
                    }
                }
            });
        }
    }

    // Modify the handleMouseMove method
    private handleMouseMove(event: MouseEvent): void {
        if (this.isConnectionMode) return; // Skip hover effects in connection mode

        // Update mouse position
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Find intersected objects
        let intersects: THREE.Intersection[] = [];
        this.models.forEach((model) => {
            const modelIntersects = this.raycaster.intersectObject(model, true);
            intersects = intersects.concat(modelIntersects);
        });

        // Check if an object is being hovered and if its model has a PDF loaded.
        if (intersects.length > 0) {
            const intersect = intersects[0]; // take the nearest intersect
            const model = this.getModelFromObject(intersect.object);
            if (model && model.userData.hasPDF) {
                if (this.lastHoveredModel !== model) {
                    // New hover event for this model: update (cycle) the displayed image.
                    if (typeof model.userData.pdfPreviewImageIndex !== "number") {
                        model.userData.pdfPreviewImageIndex = 0;
                    } else {
                        model.userData.pdfPreviewImageIndex =
                            (model.userData.pdfPreviewImageIndex + 1) %
                            this.pdfImagePaths.length;
                    }
                    model.userData.pdfPreviewImage =
                        this.pdfImagePaths[model.userData.pdfPreviewImageIndex];
                    this.lastHoveredModel = model;
                }
                this.showPdfPreview(intersect, model);
            } else {
                this.hidePdfPreview();
                this.lastHoveredModel = null;
            }
        } else {
            this.hidePdfPreview();
            this.lastHoveredModel = null;
        }

        // Pass the event to the picker
        this.picker.handleMouseMove(event);
    }

    // Modify the handleClick method
    private handleClick(event: MouseEvent): void {
        if (this.isConnectionMode) return; // Skip selection in connection mode

        // Update mouse position
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Find intersected objects
        let intersects: THREE.Intersection[] = [];
        this.models.forEach((model) => {
            const modelIntersects = this.raycaster.intersectObject(model, true);
            intersects = intersects.concat(modelIntersects);
        });

        // Pass the event to the picker
        this.picker.handleClick(event);
    }

    public traverse(callback: (object: THREE.Object3D) => void): void {
        this.models.forEach((model) => model.traverse(callback));
    }

    public clearSelection(): void {
        this.picker.clearSelection();
    }

    // Add these getter methods
    public getGrid(): THREE.GridHelper {
        return this.grid;
    }

    public getAxes(): THREE.AxesHelper {
        return this.axes;
    }

    public getRenderer(): THREE.WebGLRenderer {
        return this.renderer;
    }

    // Enhanced zoom control methods
    public zoomToFit(): void {
        if (this.models.size === 0) return;

        const box = new THREE.Box3();
        let hasModels = false;

        for (const [, model] of this.models) {
            // Update matrix world to ensure accurate bounding box calculation
            model.updateMatrixWorld(true);
            const modelBox = new THREE.Box3().setFromObject(model);
            if (!hasModels) {
                box.copy(modelBox);
                hasModels = true;
            } else {
                box.union(modelBox);
            }
        }

        if (!hasModels) return;

        // Ensure bounding box is valid
        if (box.isEmpty()) {
            console.warn('[IFCViewer] Cannot zoom to fit - bounding box is empty');
            return;
        }

        this.zoomToBox(box);
    }

    public zoomIn(factor: number = 0.9): void {
        const target = this.getControlsTarget();
        const currentDistance = this.camera.position.distanceTo(target);
        const newDistance = currentDistance * factor;
        const clampedDistance = Math.max(this.controls.minDistance, newDistance);

        const direction = new THREE.Vector3()
            .subVectors(this.camera.position, target)
            .normalize()
            .multiplyScalar(clampedDistance);

        const newPosition = new THREE.Vector3()
            .addVectors(target, direction);

        // Use CameraControls setPosition for smooth transition
        this.controls.setPosition(newPosition.x, newPosition.y, newPosition.z, false);
        const delta = this.clock.getDelta();
        this.controls.update(delta);
    }

    public zoomOut(factor: number = 1.1): void {
        const target = this.getControlsTarget();
        const currentDistance = this.camera.position.distanceTo(target);
        const newDistance = currentDistance * factor;
        const clampedDistance = Math.min(this.controls.maxDistance, newDistance);

        const direction = new THREE.Vector3()
            .subVectors(this.camera.position, target)
            .normalize()
            .multiplyScalar(clampedDistance);

        const newPosition = new THREE.Vector3()
            .addVectors(target, direction);

        // Use CameraControls setPosition for smooth transition
        this.controls.setPosition(newPosition.x, newPosition.y, newPosition.z, false);
        const delta = this.clock.getDelta();
        this.controls.update(delta);
    }

    public getModelMap(): Map<number, IFCModel> {
        return this.models;
    }

    private getRandomPdfImage(): string {
        const randomIndex = Math.floor(Math.random() * this.pdfImagePaths.length);
        return this.pdfImagePaths[randomIndex];
    }

    private getModelFromObject(object: THREE.Object3D): IFCModel | null {
        let current: THREE.Object3D | null = object;
        while (current) {
            if (current.userData && current.userData.viewerModel) {
                return current as IFCModel;
            }
            current = current.parent;
        }
        return null;
    }

    private showPdfPreview(intersect: THREE.Intersection, model: IFCModel): void {
        if (!model.userData.hasPDF) {
            this.hidePdfPreview();
            return;
        }
        let image: string;
        if (model.userData.pdfPreviewImage) {
            image = model.userData.pdfPreviewImage;
        } else {
            image = this.getRandomPdfImage();
            model.userData.pdfPreviewImage = image;
        }


        // Populate preview window content with a single PNG image.
        this.pdfPreviewWindow.innerHTML = "";
        const img = document.createElement("img");
        img.src = image;
        img.style.width = "100%";
        img.style.height = "auto";
        this.pdfPreviewWindow.appendChild(img);

        // Compute the screen coordinates of the intersect point.
        const pos = intersect.point.clone();
        pos.project(this.camera); // convert to normalized device coordinates
        const halfWidth = window.innerWidth / 2;
        const halfHeight = window.innerHeight / 2;
        const x = pos.x * halfWidth + halfWidth;
        const y = -(pos.y * halfHeight) + halfHeight;

        // Offset the preview window so it does not obscure the object.
        this.pdfPreviewWindow.style.left = `${x + 10}px`;
        this.pdfPreviewWindow.style.top = `${y - 10}px`;
        this.pdfPreviewWindow.style.display = "block";
    }

    private hidePdfPreview(): void {
        this.pdfPreviewWindow.style.display = "none";
        this.lastHoveredModel = null;
    }

    // Clash isolation methods
    public isolateByGuids(guids: string[], opts: { zoom?: boolean; focusPoints?: [number, number, number][] } = { zoom: true }): void {
        // Cancel any ongoing zoom animation when switching clashes
        if (this.currentZoomAnimation !== null) {
            cancelAnimationFrame(this.currentZoomAnimation);
            this.currentZoomAnimation = null;
        }

        // Store initial camera position before first clash selection
        if (this.lastIsolatedGuids.size === 0 && guids.length > 0) {
            this.initialCameraPosition = this.camera.position.clone();
            this.initialCameraTarget = this.getControlsTarget().clone();
        }

        // Union of target objects from the index
        const targets: THREE.Object3D[] = [];
        const missing: string[] = [];

        const uniq = new Set(guids.filter(Boolean).map((guid) => this.normalizeGuid(guid)));
        this.lastIsolatedGuids = uniq;

        uniq.forEach((g) => {
            const arr = this.guidIndex.get(g);

            if (arr && arr.length) targets.push(...arr);
            else missing.push(g);
        });

        if (targets.length === 0) {
            console.warn("No targets found for GUIDs", Array.from(uniq));
            return;
        }

        // 1) Hide everything
        this.models.forEach((model) => {
            model.traverse((obj) => {
                if ((obj as THREE.Mesh).isMesh) obj.visible = false;
            });
        });

        // 2) Show only targets
        for (const o of targets) {
            o.traverse((obj) => {
                if ((obj as THREE.Mesh).isMesh) {
                    obj.visible = true;
                }
            });
        }

        // 3) Zoom to clash points or union box
        if (opts.zoom) {
            // Small delay to ensure visibility changes are applied
            setTimeout(async () => {
                if (opts.focusPoints && opts.focusPoints.length > 0) {
                    // Focus on all clash points
                    await this.zoomToClashPoints(opts.focusPoints, targets);
                } else {
                    // Fallback to bounding box zoom
                    // CRITICAL: Update matrixWorld first
                    this.scene.updateMatrixWorld(true);

                    const union = new THREE.Box3();
                    let inited = false;
                    for (const o of targets) {
                        o.updateMatrixWorld(true);
                        const wasVisible = o.visible;
                        o.visible = true;

                        const b = new THREE.Box3();
                        b.setFromObject(o);

                        o.visible = wasVisible;

                        union.copy(inited ? union.union(b) : b);
                        inited = true;
                    }
                    if (inited) {
                        await this.zoomToBox(union);
                    }
                }
            }, 50);
        }

        if (missing.length) {
            console.warn("Some GUIDs not found in index", missing);
        }
    }

    public clearClashIsolation(): void {
        // Cancel any ongoing zoom animation
        if (this.currentZoomAnimation !== null) {
            cancelAnimationFrame(this.currentZoomAnimation);
            this.currentZoomAnimation = null;
        }

        this.lastIsolatedGuids.clear();
        this.showAll();

        // Restore camera to initial position if we have it stored
        if (this.initialCameraPosition && this.initialCameraTarget) {
            // Use CameraControls setLookAt for smooth restore
            this.controls.setLookAt(
                this.initialCameraPosition.x,
                this.initialCameraPosition.y,
                this.initialCameraPosition.z,
                this.initialCameraTarget.x,
                this.initialCameraTarget.y,
                this.initialCameraTarget.z,
                true
            );

            // Clear the stored positions after restoring
            this.initialCameraPosition = null;
            this.initialCameraTarget = null;
        }
    }



    private async findIFCOrigin(_modelID: number, model: IFCModel): Promise<THREE.Vector3> {
        const ifcOrigin = new THREE.Vector3(0, 0, 0);
        ifcOrigin.applyMatrix4(model.matrixWorld);
        return ifcOrigin;
    }

    private alignModelToWorldOrigin(model: IFCModel, ifcOrigin: THREE.Vector3): void {
        const offset = new THREE.Vector3(-ifcOrigin.x, -ifcOrigin.y, -ifcOrigin.z);
        model.position.copy(offset);
    }

    private updateCameraForAllModels(): void {
        if (this.models.size === 0) return;

        let combinedBox = new THREE.Box3();
        let hasModels = false;

        for (const [_modelId, model] of this.models) {
            const modelBox = new THREE.Box3().setFromObject(model);
            if (!hasModels) {
                combinedBox.copy(modelBox);
                hasModels = true;
            } else {
                combinedBox.union(modelBox);
            }
        }

        if (!hasModels) return;

        const center = combinedBox.getCenter(new THREE.Vector3());
        const size = combinedBox.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

        const cameraPos = new THREE.Vector3(
            center.x + cameraZ * 0.5,
            center.y + cameraZ * 0.5,
            center.z + cameraZ
        );
        this.controls.setLookAt(
            cameraPos.x, cameraPos.y, cameraPos.z,
            center.x, center.y, center.z,
            false
        );
        const delta = this.clock.getDelta();
        this.controls.update(delta);
    }

    /**
     * Capture a screenshot of the current 3D view
     * @returns Base64 encoded PNG data URL
     */
    public captureScreenshot(): string {
        // Force render before capture
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement.toDataURL('image/png');
    }

    /**
     * Zoom to a clash and capture a screenshot
     * @param guids The GlobalIds of the clashing elements
     * @param focusPoints The clash points to focus on
     * @returns Promise with base64 PNG data
     */
    public async zoomToClashAndCapture(
        guids: string[],
        focusPoints: [number, number, number][]
    ): Promise<string> {
        return new Promise((resolve) => {
            // Isolate and zoom to the clash
            this.isolateByGuids(guids, { zoom: true, focusPoints });

            // Wait for zoom animation to complete (adjust delay as needed)
            setTimeout(() => {
                // Force a render update
                this.renderer.render(this.scene, this.camera);

                // Capture screenshot
                const screenshot = this.renderer.domElement.toDataURL('image/png');
                resolve(screenshot);
            }, 600); // 600ms to allow zoom animation to complete
        });
    }

    /**
     * Capture screenshots for multiple clashes
     * @param clashes Array of clash objects with guids and points
     * @param onProgress Optional callback for progress updates
     * @returns Promise with array of {clashId, screenshot} objects
     */
    public async captureClashScreenshots(
        clashes: Array<{
            id: string;
            a_global_id: string;
            b_global_id: string;
            p1: [number, number, number];
        }>,
        onProgress?: (current: number, total: number) => void
    ): Promise<Array<{ clashId: string; screenshot: string }>> {
        const results: Array<{ clashId: string; screenshot: string }> = [];

        for (let i = 0; i < clashes.length; i++) {
            const clash = clashes[i];
            const guids = [clash.a_global_id, clash.b_global_id].filter(Boolean);
            const focusPoints: [number, number, number][] = [clash.p1];

            const screenshot = await this.zoomToClashAndCapture(guids, focusPoints);
            results.push({ clashId: clash.id, screenshot });

            if (onProgress) {
                onProgress(i + 1, clashes.length);
            }
        }

        // Restore view after capturing all screenshots
        this.clearClashIsolation();

        return results;
    }
}

// Note: IFCViewer is now initialized by React in App.tsx
// The automatic DOM initialization has been removed to avoid conflicts
